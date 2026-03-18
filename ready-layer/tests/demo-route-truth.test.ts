import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

function authHeaders(tenantId = 'tenant-truth'): Record<string, string> {
  return {
    authorization: 'Bearer tenant-secret',
    'x-tenant-id': tenantId,
    'content-type': 'application/json',
  };
}

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('control-plane route truth semantics', () => {
  it.each([
    ['caps', '../src/app/api/caps/route', 'data'],
    ['objects', '../src/app/api/objects/route', 'data'],
    ['policies', '../src/app/api/policies/route', 'data'],
    ['snapshots', '../src/app/api/snapshots/route', 'data'],
    ['plans', '../src/app/api/plans/route', 'plans'],
  ] as const)(
    'GET /api/%s returns truthful empty state without demo headers',
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
      expect(res.headers.get('x-requiem-mode')).toBeNull();
      expect(Array.isArray(records)).toBe(true);
      expect((records as unknown[]).length).toBe(0);
    },
  );

  it('HEAD /api/objects fails closed without claiming demo availability', async () => {
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

    expect(res.status).toBe(404);
    expect(res.headers.get('x-requiem-mode')).toBeNull();
    expect(res.headers.get('x-requiem-truth')).toBeNull();
  });

  it.each([
    ['caps', '../src/app/api/caps/route', { action: 'revoke', fingerprint: 'missing-cap' }, 404, 'capability_not_found'],
    ['policies', '../src/app/api/policies/route', { action: 'eval', policy_hash: 'pol_1', context: { actor: 'svc' } }, 404, 'policy_not_found'],
    ['snapshots', '../src/app/api/snapshots/route', { action: 'restore', snapshot_hash: 'snap_1', force: true }, 404, 'snapshot_not_found'],
    ['plans', '../src/app/api/plans/route', { action: 'run', plan_hash: 'plan_1' }, 404, 'plan_not_found'],
  ] as const)(
    'POST /api/%s returns truthful missing-resource failure instead of fake success',
    async (_label, modulePath, payload, status, code) => {
      Object.assign(process.env, {
        NODE_ENV: 'production',
        REQUIEM_AUTH_SECRET: 'tenant-secret',
      });
      const mod = await import(modulePath);
      const req = new NextRequest('http://localhost/api/control', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'idempotency-key': `truth-${code}`,
        },
        body: JSON.stringify(payload),
      });

      const res = await mod.POST(req);
      const body = await res.json() as Record<string, unknown>;

      expect(res.status).toBe(status);
      expect(res.headers.get('x-requiem-mode')).toBeNull();
      expect(body.code).toBe(code);
    },
  );
});
