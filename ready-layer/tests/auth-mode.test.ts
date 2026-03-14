import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

afterEach(() => {
  vi.resetModules();
  restoreEnv();
});

describe('validateTenantAuth strict vs local mode', () => {
  it('fails closed in strict mode when REQUIEM_AUTH_SECRET is missing', async () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.REQUIEM_AUTH_SECRET;
    delete process.env.REQUIEM_ALLOW_INSECURE_DEV_AUTH;

    const { validateTenantAuth } = await import('../src/lib/auth');
    const req = new Request('http://localhost/api/runs', {
      headers: {
        authorization: 'Bearer any-token',
        'x-tenant-id': 'tenant-a',
      },
    });

    const result = await validateTenantAuth(req as never);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('auth_secret_required');
    expect(result.status).toBe(503);
  });

  it('allows explicit insecure local dev mode only when opt-in flag is set', async () => {
    Object.assign(process.env, { NODE_ENV: 'development' });
    process.env.REQUIEM_AUTH_MODE = 'local-dev';
    process.env.REQUIEM_ALLOW_INSECURE_DEV_AUTH = '1';
    delete process.env.REQUIEM_AUTH_SECRET;

    const { validateTenantAuth } = await import('../src/lib/auth');
    const req = new Request('http://localhost/api/runs', {
      headers: {
        authorization: 'Bearer local-token',
        'x-tenant-id': 'tenant-local',
      },
    });

    const result = await validateTenantAuth(req as never);
    expect(result.ok).toBe(true);
    expect(result.tenant?.tenant_id).toBe('tenant-local');
  });

  it('rejects x-user-id fallback when x-tenant-id is missing', async () => {
    Object.assign(process.env, { NODE_ENV: 'development' });
    process.env.REQUIEM_AUTH_SECRET = 'dev-secret';

    const { validateTenantAuth } = await import('../src/lib/auth');
    const req = new Request('http://localhost/api/runs', {
      headers: {
        authorization: 'Bearer dev-secret',
        'x-user-id': 'legacy-user',
      },
    });

    const result = await validateTenantAuth(req as never);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_tenant_id');
    expect(result.status).toBe(400);
  });
});
