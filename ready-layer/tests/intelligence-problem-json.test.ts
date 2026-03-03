import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { withTenantContext } from '../src/lib/big4-http';
import { authErrorResponse } from '../src/lib/auth';

describe('Problem+JSON contracts for denied policy/auth paths', () => {
  it('withTenantContext returns Problem+JSON on policy deny', async () => {
    const req = new NextRequest('http://localhost/api/drift', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-test',
      },
    });

    const response = await withTenantContext(
      req,
      async () => Response.json({ ok: true }),
      async () => ({ allow: false, reasons: ['actor identity required'] }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Policy Denied');
    expect(body.status).toBe(403);
    expect(typeof body.detail).toBe('string');
    expect(typeof body.trace_id).toBe('string');
  });

  it('authErrorResponse returns Problem+JSON on auth deny', async () => {
    const response = authErrorResponse({ ok: false, error: 'missing_auth', status: 401 });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.title).toBe('Authentication Failed');
    expect(body.status).toBe(401);
    expect(typeof body.detail).toBe('string');
    expect(typeof body.trace_id).toBe('string');
  });
});
