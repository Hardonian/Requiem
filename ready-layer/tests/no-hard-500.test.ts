import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { withTenantContext } from '../src/lib/big4-http';

function authHeaders(tenantId = 'tenant-hard500-1'): HeadersInit {
  return {
    authorization: 'Bearer hard500-token',
    'x-tenant-id': tenantId,
    'x-actor-id': 'hard500-tester',
    'x-trace-id': 'trace-hard500',
  };
}

afterEach(() => {
  vi.resetModules();
  vi.unmock('@/lib/engine-client');
});

describe('No hard 500 behavior', () => {
  it('withTenantContext converts thrown exceptions to Problem+JSON', async () => {
    const req = new NextRequest('http://localhost/api/test/hard500', {
      method: 'GET',
      headers: authHeaders(),
    });

    const response = await withTenantContext(req, async () => {
      throw new Error('forced failure');
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Internal Server Error');
    expect(typeof body.trace_id).toBe('string');
  });

  it('route-level downstream failures return Problem+JSON envelope', async () => {
    vi.doMock('@/lib/engine-client', () => ({
      fetchEngineStatus: async () => {
        throw new Error('forced_engine_failure');
      },
    }));

    const { GET } = await import('../src/app/api/engine/status/route');
    const req = new NextRequest('http://localhost/api/engine/status', {
      method: 'GET',
      headers: authHeaders('tenant-engine-fail'),
    });

    const response = await GET(req);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Engine Status Unavailable');
    expect(typeof body.trace_id).toBe('string');
  });
});
