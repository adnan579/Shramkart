import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeEnv, registerEmployer, registerWorker, loginAdmin, type TestEnv } from './helpers/app.ts';
import request from './helpers/native-client.ts';
import { JOB } from './helpers/scenario.ts';
import { API_SECURITY_HEADERS } from '../server/lib/security-headers.ts';
import { apiLimitKey } from '../server/lib/api-limit.ts';

/**
 * The checks every `nativeRoute` endpoint shares: rate limit, body size and JSON, same-origin writes, session lookup,
 * security headers. They are tested through a few representative routes.
 */

let env: TestEnv;

beforeAll(() => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.SESSION_SECRET = 'x'.repeat(40);
  env = makeEnv();
});
beforeEach(() => env.reset());
afterAll(() => env.close());

async function verifiedEmployer() {
  const a = env.agent();
  await registerEmployer(a);
  const admin = env.agent();
  await loginAdmin(env, admin, 'Trust & Safety');
  const rec = (await env.db.query(`SELECT id FROM verification_records WHERE kind = 'FACTORY_GSTIN_KYB' ORDER BY created_at DESC LIMIT 1`)).rows[0];
  await admin.post('/api/admin/verify').send({ recordId: rec.id, status: 'VERIFIED' });
  return a;
}

describe('GET /api/health and /api/bootstrap', () => {
  it('answers health', async () => {
    const res = await request(env.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('serves a visitor snapshot that is never cached', async () => {
    const res = await request(env.app).get('/api/bootstrap');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.session).toBeFalsy();
  });

  it('scopes the snapshot to a signed-in factory and a worker', async () => {
    const emp = await verifiedEmployer();
    expect((await emp.get('/api/bootstrap')).body.session?.role).toBe('employer');
    const wk = env.agent();
    await registerWorker(wk);
    expect((await wk.get('/api/bootstrap')).body.session?.role).toBe('worker');
  });

  it('ignores a forged session cookie', async () => {
    const res = await request(env.app).get('/api/bootstrap').set('Cookie', 'hj_session=not-a-real-token-not-a-real-token');
    expect(res.status).toBe(200);
    expect(res.body.session).toBeFalsy();
  });
});

describe('POST /api/jobs', () => {
  it('requires a session, an employer role and a valid body', async () => {
    expect((await request(env.app).post('/api/jobs').send(JOB)).status).toBe(401);
    const wk = env.agent();
    await registerWorker(wk);
    expect((await wk.post('/api/jobs').send(JOB)).status).toBe(403);
    const emp = await verifiedEmployer();
    const invalid = await emp.post('/api/jobs').send({ ...JOB, title: '' });
    expect(invalid.status).toBe(400);
    expect(typeof invalid.body.error).toBe('string');
  });

  it('creates a job and sends the API security headers', async () => {
    const emp = await verifiedEmployer();
    const res = await emp.post('/api/jobs').send(JOB);
    expect(res.status).toBe(201);
    expect(res.body.job.title).toBe(JOB.title);
    for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) expect(res.headers[name.toLowerCase()], name).toBe(value);
  });

  it('blocks cross-site writes and bad bodies before anything else', async () => {
    const emp = await verifiedEmployer();
    const cross = await emp.post('/api/jobs').set('Origin', 'https://evil.example').send(JOB);
    expect(cross.status).toBe(403);
    expect(cross.body).toEqual({ error: 'Cross-site request blocked.' });

    const malformed = await emp.post('/api/jobs').set('Content-Type', 'application/json').send('{"title": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: 'Malformed JSON.' });

    const tooBig = await emp.post('/api/jobs').set('Content-Type', 'application/json').send(`{"x":"${'x'.repeat(201 * 1024)}"}`);
    expect(tooBig.status).toBe(413);
    expect(tooBig.body).toEqual({ error: 'Request too large.' });
  });
});

describe('PUT /api/jobs/:id', () => {
  it('updates an own job and rejects unknown, anonymous and foreign callers', async () => {
    const emp = await verifiedEmployer();
    const id = (await emp.post('/api/jobs').send(JOB)).body.job.id as string;

    const ok = await emp.put(`/api/jobs/${id}`).send({ ...JOB, title: 'Fitter - Night Shift' });
    expect(ok.status).toBe(200);
    expect(ok.body.job.title).toBe('Fitter - Night Shift');

    expect((await emp.put('/api/jobs/job-does-not-exist').send(JOB)).status).toBe(404);
    expect((await request(env.app).put(`/api/jobs/${id}`).send(JOB)).status).toBe(401);
    const other = await verifiedEmployer();
    expect((await other.put(`/api/jobs/${id}`).send(JOB)).status).toBe(404);
  });
});

describe('API rate limit', () => {
  it('answers 429 to a write once the caller is over the limit', async () => {
    await env.db.query(`INSERT INTO throttles (key, count, window_start) VALUES ($1, 600, now())`, [apiLimitKey('127.0.0.1')]);
    const res = await request(env.app).post('/api/jobs').send(JOB);
    expect(res.status).toBe(429);
  });

  it('counts writes in the database', async () => {
    await request(env.app).post('/api/jobs').send(JOB);
    await request(env.app).post('/api/jobs').send(JOB);
    const { rows } = await env.db.query(`SELECT count FROM throttles WHERE key = $1`, [apiLimitKey('127.0.0.1')]);
    expect(rows[0].count).toBe(2);
  });

  it('counts reads in memory and never writes to the database for them', async () => {
    await request(env.app).get('/api/bootstrap');
    const { rows } = await env.db.query(`SELECT count FROM throttles WHERE key = $1`, [apiLimitKey('127.0.0.1')]);
    expect(rows).toHaveLength(0);
  });
});

describe('unknown API paths', () => {
  it('answer a JSON 404 for any method', async () => {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const res = await request(env.app)[method]('/api/does-not-exist');
      expect(res.status, method).toBe(404);
      expect(res.body).toEqual({ error: 'Not found.' });
    }
  });
});
