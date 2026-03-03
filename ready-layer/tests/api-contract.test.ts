import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

function authHeaders(tenantId = 'tenant-contract-1'): HeadersInit {
  return {
    authorization: 'Bearer contract-token',
    'x-tenant-id': tenantId,
    'x-actor-id': 'contract-tester',
    'x-trace-id': 'trace-contract',
  };
}

describe('API contract routes', () => {
  it('GET /api/health returns 200 with health shape', async () => {
    const { GET } = await import('../src/app/api/health/route');
    const response = await GET(new NextRequest('http://localhost/api/health'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.status).toBe('string');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('GET /api/engine/status without auth returns Problem+JSON', async () => {
    const { GET } = await import('../src/app/api/engine/status/route');
    const response = await GET(new NextRequest('http://localhost/api/engine/status'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Authentication Failed');
    expect(typeof body.trace_id).toBe('string');
  });

  it('GET /api/budgets ignores tenant query override and uses auth tenant', async () => {
    const { GET } = await import('../src/app/api/budgets/route');
    const req = new NextRequest('http://localhost/api/budgets?tenant=evil-tenant', {
      headers: authHeaders('tenant-good'),
    });

    const response = await GET(req);
    const body = (await response.json()) as {
      data?: { budget?: { tenant_id?: string } };
    };

    expect(response.status).toBe(200);
    expect(body.data?.budget?.tenant_id).toBe('tenant-good');
  });

  it('POST /api/budgets invalid action returns 400 Problem+JSON', async () => {
    const { POST } = await import('../src/app/api/budgets/route');
    const req = new NextRequest('http://localhost/api/budgets', {
      method: 'POST',
      headers: {
        ...authHeaders('tenant-good'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'invalid' }),
    });

    const response = await POST(req);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(typeof body.trace_id).toBe('string');
  });

  it('POST /api/vector/search missing query returns 400 Problem+JSON', async () => {
    const { POST } = await import('../src/app/api/vector/search/route');
    const req = new NextRequest('http://localhost/api/vector/search', {
      method: 'POST',
      headers: {
        ...authHeaders('tenant-vector'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ limit: 5 }),
    });

    const response = await POST(req);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Validation Failed');
    expect(typeof body.trace_id).toBe('string');
  });
});
