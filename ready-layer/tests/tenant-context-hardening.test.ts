import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('withTenantContext hardening', () => {
  it('ignores spoofed x-actor-id on bearer-authenticated routes', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    });

    const { withTenantContext } = await import('../src/lib/big4-http');
    const req = new NextRequest('http://localhost/api/test', {
      method: 'GET',
      headers: {
        authorization: 'Bearer prod-secret',
        'x-tenant-id': 'tenant-a',
        'x-actor-id': 'attacker-controlled-actor',
      },
    });

    const res = await withTenantContext(req, async (ctx) => Response.json({ actor_id: ctx.actor_id }));
    const body = (await res.json()) as { actor_id: string };

    expect(res.status).toBe(200);
    expect(body.actor_id).toBe('tenant-a');
  });

  it('forces public routes to use public tenant scope even if tenant header is injected', async () => {
    const { withTenantContext } = await import('../src/lib/big4-http');
    const req = new NextRequest('http://localhost/api/public-probe', {
      method: 'GET',
      headers: {
        'x-tenant-id': 'attacker-tenant',
      },
    });

    const res = await withTenantContext(
      req,
      async (ctx) => Response.json({ tenant_id: ctx.tenant_id, actor_id: ctx.actor_id }),
      async () => ({ allow: true, reasons: [] }),
      { requireAuth: false, routeId: 'public.probe', cache: false, rateLimit: false },
    );
    const body = (await res.json()) as { tenant_id: string; actor_id: string };

    expect(body.tenant_id).toBe('public');
    expect(body.actor_id).toBe('public');
  });
});
