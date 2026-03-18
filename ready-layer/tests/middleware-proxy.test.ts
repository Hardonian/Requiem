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
