import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('GET /api/tenants/isolation truth semantics', () => {
  it('reports stub source and does not publish fabricated quota numbers when API is unconfigured', async () => {
    delete process.env.REQUIEM_API_URL;
    Object.assign(process.env, {
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'test-token',
    });

    const { GET } = await import('../src/app/api/tenants/isolation/route');
    const request = new NextRequest('http://localhost/api/tenants/isolation', {
      headers: {
        authorization: 'Bearer test-token',
        'x-tenant-id': 'tenant-truth',
      },
    });

    const response = await GET(request);
    const body = (await response.json()) as {
      data?: {
        source?: string;
        configured?: boolean;
        quotas?: { storage?: { used_bytes?: number | null } };
      };
    };

    expect(response.status).toBe(200);
    expect(body.data?.source).toBe('stub');
    expect(body.data?.configured).toBe(false);
    expect(body.data?.quotas?.storage?.used_bytes).toBeNull();
  });
});
