import crypto from 'node:crypto';
import { unauthorized } from '../lib/errors.ts';
import { pingHeartbeat } from '../lib/monitoring.ts';
import type { NativeHandler } from '../next/native.ts';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Housekeeping. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Audit logs are never deleted. */
export const cronCleanup: NativeHandler = async ({ ctx, request }) => {
  const secret = ctx.config.cronSecret;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || !header.startsWith('Bearer ') || !sameSecret(header.slice(7), secret)) throw unauthorized('Not allowed.');
  const db = ctx.db;
  const otp = await db.query(`DELETE FROM otp_challenges WHERE expires_at < now() - interval '1 day'`);
  const thr = await db.query(`DELETE FROM throttles WHERE window_start < now() - interval '1 day' AND (locked_until IS NULL OR locked_until < now())`);
  const ses = await db.query(`DELETE FROM sessions WHERE expires_at < now() OR revoked_at < now() - interval '30 days'`);
  const notes = await db.query(`DELETE FROM notifications WHERE created_at < now() - interval '180 days'`);
  // Tell the dead-man's-switch monitor the job finished. If this ping stops arriving, the monitor raises the alert.
  const heartbeat = await pingHeartbeat(ctx.config.monitoring.cronHeartbeatUrl, ctx.deps.fetch);
  return { heartbeat: ctx.config.monitoring.cronHeartbeatUrl ? heartbeat : undefined, otpChallenges: otp.rowCount, throttles: thr.rowCount, sessions: ses.rowCount, notifications: notes.rowCount };
};
