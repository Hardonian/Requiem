import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('middleware proxy auth behavior', () => {
  it('allows protected page access in route verify mode without supabase config', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      REQUIEM_ROUTE_VERIFY_MODE: '1',
      REQUIEM_ROUTE_VERIFY_TENANT: 'evidence-tenant',
      REQUIEM_ROUTE_VERIFY_ACTOR: 'evidence-actor',
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { middleware } = await import('../src/middleware/proxy');
    const request = new NextRequest('http://localhost/console/overview');

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-requiem-authenticated')).toBe('1');
    expect(response.headers.get('x-tenant-id')).toBe('evidence-tenant');
  });



  it('authenticates protected API routes with direct bearer auth when REQUIEM_AUTH_SECRET is configured', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      REQUIEM_AUTH_SECRET: 'api-secret',
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { middleware } = await import('../src/middleware/proxy');
    const request = new NextRequest('http://localhost/api/budgets', {
      headers: {
        authorization: 'Bearer api-secret',
        'x-tenant-id': 'tenant-direct',
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-requiem-authenticated')).toBe('1');
    expect(response.headers.get('x-tenant-id')).toBe('tenant-direct');
  });

  it('derives production direct bearer tenant and actor only from token claims', async () => {
    Object.assign(process.env, { NODE_ENV: 'production', REQUIEM_AUTH_SECRET: 'api-secret' });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { createDirectBearerToken } = await import('../src/lib/direct-bearer');
    const { middleware } = await import('../src/middleware/proxy');
    const token = await createDirectBearerToken({ tenant_id: 'bound-tenant', actor_id: 'bound-actor' }, 'api-secret');
    const response = await middleware(new NextRequest('http://localhost/api/budgets', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'forged-tenant',
        'x-user-id': 'forged-actor',
        'x-actor-id': 'forged-legacy-actor',
      },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-tenant-id')).toBe('bound-tenant');
    expect(response.headers.get('x-user-id')).toBe('bound-actor');
    expect(response.headers.get('x-actor-id')).toBeNull();
  });

  it('fails closed for production direct bearer requests with forged tenant and actor headers', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'api-secret',
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { middleware } = await import('../src/middleware/proxy');
    const response = await middleware(new NextRequest('http://localhost/api/budgets', {
      headers: {
        authorization: 'Bearer api-secret',
        'x-tenant-id': 'forged-tenant',
        'x-actor-id': 'forged-actor',
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('identity_claims_required');
  });

  it('does not activate route verify mode in staging', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'staging',
      REQUIEM_ROUTE_VERIFY_MODE: '1',
      REQUIEM_ROUTE_VERIFY_TENANT: 'forged-tenant',
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { middleware } = await import('../src/middleware/proxy');
    const response = await middleware(new NextRequest('http://localhost/api/budgets', {
      headers: { 'x-tenant-id': 'forged-tenant', 'x-actor-id': 'forged-actor' },
    }));

    expect(response.status).toBe(503);
    expect(response.headers.get('x-requiem-authenticated')).toBeNull();
  });

  it('keeps tokenized proof diff route public', async () => {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      REQUIEM_ROUTE_VERIFY_MODE: '0',
    });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { middleware } = await import('../src/middleware/proxy');
    const request = new NextRequest('http://localhost/proof/diff/public-token');

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});
