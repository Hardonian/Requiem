import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
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
    getSupabaseServiceConfig: () => ({
      url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
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
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      REQUIEM_AUTH_SECRET: '',
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }>; deployment_contract: { topology: string; execution_model: string } };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.status).toBe('not_ready');
    expect(body.checks.some((check) => check.name === 'auth_bearer_secret' && check.ok === false)).toBe(true);
    expect(body.checks.some((check) => check.name === 'engine_api_reachable' && check.ok === true)).toBe(true);
  });

  it('reports ready for local single-runtime deployments when auth UI env and local persistence succeed', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-readiness-local-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean; detail: string; skipped?: boolean }>; deployment_contract: { topology_mode: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ready');
    expect(body.deployment_contract.topology_mode).toBe('local-single-runtime');
    expect(body.checks.find((check) => check.name === 'engine_api_reachable')?.skipped).toBe(true);

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  });

  it('reports ready when auth, shared coordination, and configured engine probes succeed', async () => {
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
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      REQUIEM_API_URL: `http://127.0.0.1:${address.port}`,
    };
    mockSupabase(() => ({ data: null, error: null }));

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }>; deployment_contract: { topology: string; topology_mode: string; execution_model: string } };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ready');
    expect(body.deployment_contract.topology).toBe('shared-supabase-request-bound-external-api');
    expect(body.deployment_contract.topology_mode).toBe('shared-supabase-request-bound-external-api');
    expect(body.deployment_contract.execution_model).toBe('request-bound-same-runtime');
    expect(body.checks.filter((check) => check.name !== 'execution_model_contract').every((check) => check.ok)).toBe(true);

    server.close();
  });

  it('reports ready for production-like console-only deployments when shared backing is healthy and REQUIEM_API_URL is unset', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
    };
    delete process.env.REQUIEM_API_URL;
    mockSupabase(() => ({ data: null, error: null }));

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as {
      ok: boolean;
      status: string;
      checks: Array<{ name: string; ok: boolean; skipped?: boolean }>;
      deployment_contract: { topology: string; topology_mode: string; external_runtime_configured: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ready');
    expect(body.deployment_contract.topology).toBe('shared-supabase-request-bound');
    expect(body.deployment_contract.topology_mode).toBe('shared-supabase-request-bound');
    expect(body.deployment_contract.external_runtime_configured).toBe(false);
    expect(body.checks.find((check) => check.name === 'engine_api_reachable')?.skipped).toBe(true);
  });

  it('fails when external runtime is configured but unreachable', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      REQUIEM_API_URL: 'http://127.0.0.1:9',
    };
    mockSupabase(() => ({ data: null, error: null }));

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean; detail: string }> };

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.find((check) => check.name === 'engine_api_reachable')?.ok).toBe(false);
  });

  it('fails when production-like topology is missing shared control-plane backing', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { checks: Array<{ name: string; ok: boolean; detail: string }> };

    expect(response.status).toBe(503);
    expect(body.checks.find((check) => check.name === 'shared_service_role')?.ok).toBe(false);
  });

  it('fails on malformed configuration values', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'readiness-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      REQUIEM_API_URL: 'bad-url',
    };
    mockSupabase(() => ({ data: null, error: null }));

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { checks: Array<{ name: string; ok: boolean }> };

    expect(response.status).toBe(503);
    expect(body.checks.find((check) => check.name === 'supabase_public_url')?.ok).toBe(false);
    expect(body.checks.find((check) => check.name === 'external_runtime_url')?.ok).toBe(false);
  });
});
