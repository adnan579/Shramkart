import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '../proxy.ts';

const call = (method: string, path: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(`http://localhost${path}`, { method, headers: { host: 'localhost', ...headers } }));

describe('proxy: cross-site write guard for /api', () => {
  it('refuses a write from another site with a JSON 403 and API headers', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = call(method, '/api/jobs', { origin: 'https://evil.example' });
      expect(res.status, method).toBe(403);
      expect(await res.json()).toEqual({ error: 'Cross-site request blocked.' });
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    }
  });

  it('lets same-site writes, Origin-less callers (webhook, cron) and reads through', () => {
    expect(call('POST', '/api/jobs', { origin: 'http://localhost' }).status).toBe(200);
    expect(call('POST', '/api/webhooks/razorpay').status).toBe(200);
    expect(call('GET', '/api/bootstrap', { origin: 'https://evil.example' }).status).toBe(200);
  });

  it('does not touch page requests', () => {
    expect(call('POST', '/jobs', { origin: 'https://evil.example' }).status).toBe(200);
  });
});
