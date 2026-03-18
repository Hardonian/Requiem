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
  it('rejects spoofed middleware auth headers without signed proof', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    });

    const { validateTenantAuth } = await import('../src/lib/auth');
    const req = new Request('http://localhost/api/runs', {
      headers: {
        'x-requiem-authenticated': '1',
        'x-tenant-id': 'tenant-a',
        'x-user-id': 'user-a',
      },
    });

    const result = await validateTenantAuth(req as never);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_auth_context');
    expect(result.status).toBe(401);
  });

  it('accepts signed middleware auth context only when proof matches request path and method', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'prod-secret',
    });

    const { validateTenantAuth } = await import('../src/lib/auth');
    const { createInternalAuthProof, INTERNAL_AUTH_PROOF_HEADER } = await import('../src/lib/internal-auth-proof');
    const proof = await createInternalAuthProof({
      tenantId: 'tenant-a',
      actorId: 'user-a',
      method: 'GET',
      pathname: '/api/runs',
    });

    const req = new Request('http://localhost/api/runs', {
      headers: {
        'x-requiem-authenticated': '1',
        'x-tenant-id': 'tenant-a',
        'x-user-id': 'user-a',
        [INTERNAL_AUTH_PROOF_HEADER]: proof ?? '',
      },
    });

    const result = await validateTenantAuth(req as never);
    expect(result.ok).toBe(true);
    expect(result.tenant?.tenant_id).toBe('tenant-a');
    expect(result.actor_id).toBe('user-a');
  });

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

  it('rejects route verify mode outside test environment', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      REQUIEM_ROUTE_VERIFY_MODE: '1',
    });

    const { validateTenantAuth } = await import('../src/lib/auth');
    const req = new Request('http://localhost/api/runs', {
      headers: {
        'x-tenant-id': 'tenant-verify',
      },
    });

    const result = await validateTenantAuth(req as never);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_auth');
    expect(result.status).toBe(401);
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
    expect(result.error).toBe('invalid_auth_context');
    expect(result.status).toBe(401);
  });
});
