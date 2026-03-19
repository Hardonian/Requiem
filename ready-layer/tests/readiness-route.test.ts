import http from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

function mockSupabase(selectImpl: (table: string) => { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }) {
  vi.doMock('../src/lib/supabase-service', () => ({
    getSupabaseServiceClient: () => ({
      from(table: string) {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => selectImpl(table),
        };
      },
    }),
    isSupabaseServiceConfigured: () => true,
    assertSupabaseServiceConfigured: () => undefined,
    resetSupabaseServiceClientForTests: () => undefined,
  }));
}

afterEach(() => {
  vi.resetModules();
  vi.unmock('../src/lib/supabase-service');
  process.env = { ...originalEnv };
});

describe('readiness route', () => {
  it('fails closed when required config is missing', async () => {
    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }>; deployment_contract: { topology: string; execution_model: string } };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.status).toBe('not_ready');
    expect(body.checks.some((check) => check.name === 'auth_configuration_present' && check.ok === false)).toBe(true);
    expect(body.checks.some((check) => check.name === 'shared_runtime_coordination' && check.ok === false)).toBe(true);
    expect(body.checks.some((check) => check.name === 'engine_api_reachable' && check.ok === false)).toBe(true);
    expect(body.deployment_contract.execution_model).toBe('request-bound-same-runtime');
  });

  it('reports ready only when auth, persistence, and engine probes succeed', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('failed to bind test server');

    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      REQUIEM_API_URL: `http://127.0.0.1:${address.port}`,
    };
    mockSupabase(() => ({ data: null, error: null }));

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }>; deployment_contract: { topology: string; execution_model: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ready');
    expect(body.deployment_contract.topology).toBe('supabase-shared-request-bound');
    expect(body.deployment_contract.execution_model).toBe('request-bound-same-runtime');
    expect(body.checks.filter((check) => check.name !== 'execution_model_contract').every((check) => check.ok)).toBe(true);

    server.close();
  });

  it('fails when the durable control-plane probe cannot read shared state', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      REQUIEM_API_URL: 'http://127.0.0.1:9',
    };
    mockSupabase((table) => table === 'control_plane_state'
      ? { data: null, error: { message: 'control plane probe failed' } }
      : { data: null, error: null });

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { checks: Array<{ name: string; ok: boolean; detail: string }> };

    expect(response.status).toBe(503);
    expect(body.checks.find((check) => check.name === 'control_plane_persistence')?.ok).toBe(false);
  });
});
