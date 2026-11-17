import crypto from 'node:crypto';
import { z } from 'zod';
import QRCode from 'qrcode';
import { parse } from '../lib/http.ts';
import { HttpError, badRequest, forbidden, tooMany, unauthorized } from '../lib/errors.ts';
import { audit } from '../lib/audit.ts';
import { hashPassword, verifyPassword, burnPasswordTime, passwordProblem } from '../lib/password.ts';
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from '../lib/totp.ts';
import { ROLE_PERMISSIONS } from '../lib/permissions.ts';
import { requireAdmin } from '../lib/guards.ts';
import { hit } from '../auth/throttle.ts';
import { ADMIN_COOKIE, adminCookie, clearedAdminCookie, createAdminSession, parseCookies } from '../auth/session.ts';
import { sha256 } from '../lib/ids.ts';
import { json, type NativeHandler } from '../next/native.ts';
import type { AppContext, AuthContext } from '../types.ts';
import type { Queryable } from '../db.ts';

const GENERIC = 'Wrong email or password.';
const MAX_FAILS = 5;
const NO_STORE = { 'cache-control': 'no-store' };

const loginInput = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });
const verifyInput = z.object({ challenge: z.string().min(10).max(500), code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.') });
const changeInput = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) });

// A short-lived proof that the password step succeeded. Signed, so it cannot be forged or edited.
function signChallenge(ctx: AppContext, accountId: string): string {
  const body = Buffer.from(JSON.stringify({ a: accountId, e: Date.now() + 5 * 60_000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', ctx.config.sessionSecret).update('admin-challenge:' + body).digest('base64url');
  return `${body}.${sig}`;
}
function readChallenge(ctx: AppContext, token: string): string {
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', ctx.config.sessionSecret).update('admin-challenge:' + (body ?? '')).digest('base64url');
  const ok = sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) throw unauthorized('Please sign in again.');
  const { a, e } = JSON.parse(Buffer.from(body ?? '', 'base64url').toString());
  if (typeof a !== 'string' || Date.now() > e) throw unauthorized('That sign-in took too long. Please start again.');
  return a;
}

interface Cred {
  account_id: string; email: string; display_name: string; password_hash: string; must_change_password: boolean;
  totp_secret_enc: string | null; totp_enabled: boolean; totp_last_step: string; failed_attempts: number; lock_count: number;
  locked_until: Date | null; admin_role: AuthContext['adminRole']; status: string;
}

const CRED_SELECT = `SELECT c.*, a.admin_role, a.status FROM admin_credentials c JOIN accounts a ON a.id = c.account_id AND a.role = 'admin'`;

function assertNotLocked(c: Cred) {
  if (c.locked_until && c.locked_until.getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((c.locked_until.getTime() - Date.now()) / 60_000));
    throw tooMany(`Too many wrong attempts. This account is locked for about ${mins} more minute(s).`);
  }
}

/** Counts a wrong password or code. After 5 in a row the account locks: 15 min, then 30, then 60. */
async function registerFailure(q: Queryable, c: Cred, ip: string): Promise<void> {
  const fails = c.failed_attempts + 1;
  if (fails >= MAX_FAILS) {
    const lockCount = c.lock_count + 1;
    const minutes = Math.min(15 * 2 ** (lockCount - 1), 60);
    await q.query(`UPDATE admin_credentials SET failed_attempts = 0, lock_count = $2, locked_until = now() + make_interval(mins => $3) WHERE account_id = $1`, [c.account_id, lockCount, minutes]);
    await audit(q, { actorAccountId: c.account_id, principalId: c.account_id, principalName: c.email, action: 'ADMIN_LOCKED', details: `Locked for ${minutes} minutes after ${MAX_FAILS} wrong attempts.`, ip });
  } else {
    await q.query('UPDATE admin_credentials SET failed_attempts = $2 WHERE account_id = $1', [c.account_id, fails]);
  }
}

async function loadCred(q: Queryable, where: string, value: string): Promise<Cred | undefined> {
  return (await q.query<Cred>(`${CRED_SELECT} WHERE ${where}`, [value])).rows[0];
}

function mePayload(a: AuthContext) {
  return {
    email: a.email, displayName: a.displayName, adminRole: a.adminRole,
    mustChangePassword: Boolean(a.mustChangePassword),
    permissions: a.adminRole ? ROLE_PERMISSIONS[a.adminRole] : [],
  };
}

export const adminLogin: NativeHandler = async ({ ctx, body, ip }) => {
  const { email, password } = parse(loginInput, body);
  const db = ctx.db;
  if ((await hit(db, `adminlogin:ip:${ip}`, 20, 900)).blocked) throw tooMany('Too many sign-in attempts from this network. Try again in 15 minutes.');

  const c = await loadCred(db, 'lower(c.email) = $1', email);
  if (!c || c.status !== 'active') {
    await burnPasswordTime(password);
    throw unauthorized(GENERIC);
  }
  assertNotLocked(c);
  if (!(await verifyPassword(password, c.password_hash))) {
    await registerFailure(db, c, ip);
    throw unauthorized(GENERIC);
  }

  const challenge = signChallenge(ctx, c.account_id);
  if (c.totp_enabled) return { next: 'totp', challenge };

  // First sign-in: show the authenticator setup. The same secret is shown until it is confirmed.
  let secret = c.totp_secret_enc ? decryptSecret(c.totp_secret_enc, ctx.config.admin.totpKey) : null;
  if (!secret) {
    secret = newTotpSecret();
    await db.query('UPDATE admin_credentials SET totp_secret_enc = $2 WHERE account_id = $1', [c.account_id, encryptSecret(secret, ctx.config.admin.totpKey)]);
  }
  const url = otpauthUrl(secret, c.email);
  return { next: 'enroll', challenge, secret, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
};

export const adminVerify: NativeHandler = async ({ ctx, request, body, ip }) => {
  const { challenge, code } = parse(verifyInput, body);
  const db = ctx.db;
  if ((await hit(db, `adminverify:ip:${ip}`, 40, 900)).blocked) throw tooMany('Too many attempts from this network. Try again in 15 minutes.');
  const accountId = readChallenge(ctx, challenge);
  const c = await loadCred(db, 'c.account_id = $1', accountId);
  if (!c || c.status !== 'active') throw unauthorized('Please sign in again.');
  assertNotLocked(c);
  if (!c.totp_secret_enc) throw badRequest('Authenticator is not set up. Please sign in again.');
  const secret = decryptSecret(c.totp_secret_enc, ctx.config.admin.totpKey);
  if (!secret) throw new HttpError(409, 'Your authenticator can no longer be read (the server security key changed). A Super Admin must reset it from Staff, or set ADMIN_BOOTSTRAP_RESET=true for one deploy.');

  const step = verifyTotp(secret, code, Number(c.totp_last_step));
  if (step === null) {
    await registerFailure(db, c, ip);
    throw unauthorized('That code is not right. Check your phone clock and try the newest code.');
  }

  const token = await db.tx(async (q) => {
    // A code can be used once only (blocks someone who watched it being typed).
    const used = await q.query('UPDATE admin_credentials SET totp_last_step = $2, totp_enabled = true, failed_attempts = 0, lock_count = 0, locked_until = NULL WHERE account_id = $1 AND totp_last_step < $2', [c.account_id, step]);
    if (!used.rowCount) throw unauthorized('That code was already used. Wait for the next one.');
    const s = await createAdminSession(q, { accountId: c.account_id, ip, device: request.headers.get('user-agent') ?? 'Browser' });
    await audit(q, { actorAccountId: c.account_id, principalId: c.account_id, principalName: c.email, action: 'ADMIN_LOGIN', details: `Signed in as ${c.admin_role}${c.totp_enabled ? '' : ' (authenticator set up)'}.`, ip });
    return s.token;
  });
  return json(
    { ok: true, me: { email: c.email, displayName: c.display_name, adminRole: c.admin_role, mustChangePassword: c.must_change_password, permissions: c.admin_role ? ROLE_PERMISSIONS[c.admin_role] : [] } },
    { headers: NO_STORE, cookies: [adminCookie(token, ctx.config.isProd)] }
  );
};

export const adminMe: NativeHandler = async ({ admin }) => json({ me: admin ? mePayload(admin) : null }, { headers: NO_STORE });

export const adminLogout: NativeHandler = async ({ ctx, request }) => {
  const token = parseCookies(request.headers.get('cookie') ?? undefined)[ADMIN_COOKIE];
  if (token) await ctx.db.query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [sha256(token)]);
  return json({ ok: true }, { cookies: [clearedAdminCookie(ctx.config.isProd)] });
};

export const adminChangePassword: NativeHandler = async (c) => {
  const admin = c.admin;
  if (!admin) throw unauthorized();
  const { current, next } = parse(changeInput, c.body);
  const cred = await loadCred(c.ctx.db, 'c.account_id = $1', admin.accountId);
  if (!cred) throw unauthorized();
  assertNotLocked(cred);
  if (!(await verifyPassword(current, cred.password_hash))) {
    await registerFailure(c.ctx.db, cred, c.ip);
    throw forbidden('Your current password is not right.');
  }
  const problem = passwordProblem(next, cred.email);
  if (problem) throw badRequest(problem);
  if (await verifyPassword(next, cred.password_hash)) throw badRequest('Choose a password you have not used just now.');
  const hash = await hashPassword(next);
  await c.ctx.db.tx(async (q) => {
    await q.query('UPDATE admin_credentials SET password_hash = $2, must_change_password = false, password_changed_at = now() WHERE account_id = $1', [cred.account_id, hash]);
    await q.query(`UPDATE sessions SET revoked_at = now() WHERE account_id = $1 AND kind = 'admin' AND id <> $2 AND revoked_at IS NULL`, [cred.account_id, admin.sessionId]);
    await audit(q, { actorAccountId: cred.account_id, principalId: cred.account_id, principalName: cred.email, action: 'ADMIN_PASSWORD_CHANGED', details: 'Password changed. Other sessions ended.', ip: c.ip });
  });
  return { ok: true };
};

export const adminSessions: NativeHandler = async (c) => {
  const admin = requireAdmin(c);
  const { rows } = await c.ctx.db.query(
    `SELECT id, device_label, ip, created_at, last_seen_at, expires_at FROM sessions
      WHERE account_id = $1 AND kind = 'admin' AND revoked_at IS NULL AND expires_at > now() AND absolute_expires_at > now() ORDER BY created_at DESC`,
    [admin.accountId]
  );
  return { sessions: rows.map((r: any) => ({ id: r.id, device: r.device_label, ip: r.ip, startedAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === admin.sessionId })) };
};

export const adminRevokeOthers: NativeHandler = async (c) => {
  const admin = requireAdmin(c);
  await c.ctx.db.query(`UPDATE sessions SET revoked_at = now() WHERE account_id = $1 AND kind = 'admin' AND id <> $2 AND revoked_at IS NULL`, [admin.accountId, admin.sessionId]);
  return { ok: true };
};
