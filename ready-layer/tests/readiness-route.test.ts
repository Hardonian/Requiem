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
  it('fails closed when auth configuration is missing', async () => {
    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }>; deployment_contract: { topology: string; execution_model: string } };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.status).toBe('not_ready');
    expect(body.checks.some((check) => check.name === 'auth_configuration_present' && check.ok === false)).toBe(true);
    expect(body.checks.some((check) => check.name === 'engine_api_reachable' && check.ok === true)).toBe(true);
  });

  it('reports ready for console-only deployments when auth and persistence succeed', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-readiness-console-only-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean; detail: string }> };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ready');
    expect(body.checks.find((check) => check.name === 'engine_api_reachable')?.detail).toContain('console-only mode');

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  });

  it('reports ready when auth, persistence, and configured engine probes succeed', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-readiness-'));
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

  it('fails when external runtime is configured but unreachable', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-readiness-unreachable-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
      REQUIEM_API_URL: 'http://127.0.0.1:9',
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean; detail: string }> };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.find((check) => check.name === 'engine_api_reachable')?.ok).toBe(false);

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  });

  it('fails when control-plane persistence cannot write', async () => {
    const badPath = path.join(os.tmpdir(), `ready-layer-bad-root-${Date.now()}`);
    fs.writeFileSync(badPath, 'not-a-directory', 'utf8');
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
