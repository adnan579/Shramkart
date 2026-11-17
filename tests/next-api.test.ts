import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { GET as healthGET } from '../app/api/health/route.ts';
import { POST as webhookPOST } from '../app/api/webhooks/razorpay/route.ts';
import { POST as otpPOST } from '../app/api/otp/send/route.ts';
import { POST as verifyPOST } from '../app/api/auth/verify/route.ts';
import { contextOverride } from '../server/runtime.ts';
import { normalizeIndianPhone } from '../server/lib/phone.ts';
import { makeEnv, type TestEnv } from './helpers/app.ts';

/** Calls the route files with plain `Request` objects, the way the Next server does. */

const WEBHOOK_SECRET = 'route-test-webhook-secret';
let env: TestEnv;

beforeAll(() => {
  env = makeEnv({ RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET });
});
afterAll(() => env.close());

const call = <T>(fn: () => Promise<T>) => contextOverride.run(env.ctx, fn);

it('serves health through the Next route handler', async () => {
  const response = await call(() => healthGET());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});

it('preserves the raw webhook body', async () => {
  const body = '{ "event" : "ignored" }\n';
  const signature = createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  const request = (payload: string) => new Request('http://localhost/api/webhooks/razorpay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
    body: payload,
  });

  const accepted = await call(() => webhookPOST(request(body)));
  expect(accepted.status).toBe(200);
  expect(await accepted.json()).toEqual({ ok: true });

  const changed = await call(() => webhookPOST(request(body.replace('ignored', 'ignored '))));
  expect(changed.status).toBe(400);
  expect(await changed.json()).toEqual({ error: 'Bad signature' });
});

it('keeps the 200 KB JSON request limit', async () => {
  const body = `{"value":"${'x'.repeat(200 * 1024)}"}`;
  const response = await call(() => otpPOST(new Request('http://localhost/api/otp/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })));
  expect(response.status).toBe(413);
  expect(await response.json()).toEqual({ error: 'Request too large.' });
});

it('sets the session cookie with the expected attributes', async () => {
  const phone = `9${String(Date.now()).slice(-9)}`;
  await env.db.query("INSERT INTO accounts (phone, role) VALUES ($1, 'worker')", [normalizeIndianPhone(phone)!]);
  const otpResponse = await call(() => otpPOST(new Request('http://localhost/api/otp/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, role: 'worker' }),
  })));
  const otp = await otpResponse.json() as { demoCode: string };
  expect(otpResponse.status).toBe(200);

  const login = await call(() => verifyPOST(new Request('http://localhost/api/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone, role: 'worker', code: otp.demoCode, mode: 'login' }),
  })));
  const cookie = login.headers.get('set-cookie') ?? '';
  expect(login.status).toBe(200);
  expect(cookie).toContain('hj_session=');
  expect(cookie).toContain('Path=/');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Lax');
  expect(cookie).toContain('Max-Age=2592000');
  expect(cookie).not.toContain('Secure');
});
