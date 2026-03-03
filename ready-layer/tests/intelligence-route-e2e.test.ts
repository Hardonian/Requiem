import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

function authFixtureHeaders(tenantId = 'tenant-e2e'): Record<string, string> {
  return {
    authorization: 'Bearer test-auth-secret',
    'x-tenant-id': tenantId,
    'x-actor-id': 'e2e-tester',
    'x-trace-id': 'trace-e2e',
  };
}

afterEach(() => {
  vi.resetModules();
  vi.unmock('@/lib/engine-client');
  delete process.env.REQUIEM_AUTH_SECRET;
  delete process.env.REQUIEM_ROUTE_VERIFY_MODE;
});

describe('intelligence/api e2e route handlers with middleware-auth fixtures', () => {
  it('GET /api/intelligence/calibration returns 400 Problem+JSON for invalid window', async () => {
    const { GET } = await import('../src/app/api/intelligence/calibration/route');

    const req = new NextRequest('http://localhost/api/intelligence/calibration?window=bad-window', {
      method: 'GET',
      headers: authFixtureHeaders(),
    });

    const response = await GET(req);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Invalid Calibration Window');
    expect(body.status).toBe(400);
    expect(typeof body.trace_id).toBe('string');
  });



  it('runs middleware proxy + intelligence route handler in one harness', async () => {
    process.env.REQUIEM_ROUTE_VERIFY_MODE = '1';

    const { middleware } = await import('../src/middleware/proxy');
    const { GET } = await import('../src/app/api/intelligence/calibration/route');

    const req = new NextRequest('http://localhost/api/intelligence/calibration?window=30d', {
      method: 'GET',
      headers: authFixtureHeaders('tenant-middleware-harness'),
    });

    const middlewareResponse = await middleware(req);
    expect(middlewareResponse.status).toBe(200);

    const routeResponse = await GET(req);
    const body = (await routeResponse.json()) as Record<string, unknown>;

    expect(routeResponse.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tenant_id).toBe('tenant-middleware-harness');
  });

  it('GET /api/engine/status succeeds with auth fixture and mocked engine client', async () => {
    process.env.REQUIEM_AUTH_SECRET = 'test-auth-secret';

    vi.doMock('@/lib/engine-client', () => ({
      fetchEngineStatus: async () => ({
        ok: true,
        runtime: {
          worker_id: 'worker-1',
          version: 'v1',
          uptime_sec: 1,
          now_unix_ms: Date.now(),
        },
      }),
    }));

    const { GET } = await import('../src/app/api/engine/status/route');
    const req = new NextRequest('http://localhost/api/engine/status', {
      method: 'GET',
      headers: authFixtureHeaders('tenant-auth-fixture'),
    });

    const response = await GET(req);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.runtime).toBe('object');
  });
});
