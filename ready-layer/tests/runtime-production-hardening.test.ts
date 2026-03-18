import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('production fail-closed hardening', () => {
  it('rejects protected routes in production when shared coordination is not configured', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    };

    const { withTenantContext } = await import('../src/lib/big4-http');
    const response = await withTenantContext(
      new NextRequest('http://localhost/api/test-hardening', {
        headers: {
          authorization: 'Bearer prod-secret',
          'x-tenant-id': 'tenant-prod',
        },
      }),
      async () => Response.json({ ok: true }),
    );

    expect(response.status).toBe(503);
    const body = await response.json() as { code?: string };
    expect(body.code).toBe('shared_runtime_coordination_unconfigured');
  });

  it('rejects control-plane store access in production when durable store config is missing', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    };

    const { getBudget } = await import('../src/lib/control-plane-store');
    await expect(getBudget('tenant-prod')).rejects.toMatchObject({
      code: 'control_plane_store_unconfigured',
    });
  });
});
