import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

function authHeaders(tenantId = 'tenant-truth'): Record<string, string> {
  return {
    authorization: 'Bearer tenant-secret',
    'x-tenant-id': tenantId,
    'x-actor-id': `actor-${tenantId}`,
    'content-type': 'application/json',
  };
}

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('demo-backed route truth semantics', () => {
  it.each([
    ['caps', '../src/app/api/caps/route', 'data'],
    ['objects', '../src/app/api/objects/route', 'data'],
    ['policies', '../src/app/api/policies/route', 'data'],
    ['snapshots', '../src/app/api/snapshots/route', 'data'],
    ['plans', '../src/app/api/plans/route', 'plans'],
  ] as const)(
    'GET /api/%s does not fabricate list records',
    async (label, modulePath, field) => {
      Object.assign(process.env, {
        NODE_ENV: 'production',
        REQUIEM_AUTH_SECRET: 'tenant-secret',
      });
      const mod = await import(modulePath);
      const req = new NextRequest(`http://localhost/api/${label}`, {
        headers: authHeaders(),
      });

      const res = await mod.GET(req);
      const body = await res.json() as { data?: Record<string, unknown> };
      const inner = body.data ?? {};
      const records = (inner[field] ?? inner.data) as unknown;

      expect(res.status).toBe(200);
      expect(res.headers.get('x-requiem-mode')).toBe('demo');
      expect(Array.isArray(records)).toBe(true);
      expect((records as unknown[]).length).toBe(0);
    },
  );

  it('HEAD /api/objects fails closed instead of claiming objects exist', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'tenant-secret',
    });
    const { HEAD } = await import('../src/app/api/objects/route');
    const req = new NextRequest('http://localhost/api/objects?hash=abc123', {
      method: 'HEAD',
      headers: authHeaders(),
    });

    const res = await HEAD(req);

    expect(res.status).toBe(503);
    expect(res.headers.get('x-requiem-mode')).toBe('demo');
    expect(res.headers.get('x-requiem-truth')).toBe('unavailable');
  });

  it.each([
    ['caps', '../src/app/api/caps/route', { action: 'mint', subject: 'svc', permissions: ['exec.run'] }],
    ['policies', '../src/app/api/policies/route', { action: 'eval', policy_hash: 'pol_1', context: { actor: 'svc' } }],
    ['snapshots', '../src/app/api/snapshots/route', { action: 'create' }],
    ['plans', '../src/app/api/plans/route', { action: 'run', plan_hash: 'plan_1' }],
  ] as const)(
    'POST /api/%s rejects fake mutation success when no runtime backend exists',
    async (label, modulePath, payload) => {
      Object.assign(process.env, {
        NODE_ENV: 'production',
        REQUIEM_AUTH_SECRET: 'tenant-secret',
      });
      const mod = await import(modulePath);
      const req = new NextRequest(`http://localhost/api/${label}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const res = await mod.POST(req);
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(503);
      expect(res.headers.get('x-requiem-mode')).toBe('demo');
      expect(body.code).toBe('runtime_backend_unavailable');
    },
  );
});
