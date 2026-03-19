import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('readiness route', () => {
  it('fails closed when auth configuration is missing', async () => {
    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }> };

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
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
      REQUIEM_API_URL: `http://127.0.0.1:${address.port}`,
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }> };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe('ready');
    expect(body.checks.every((check) => check.ok)).toBe(true);

    server.close();
    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
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
      REQUIEM_CONTROL_PLANE_DIR: badPath,
      REQUIEM_API_URL: 'http://127.0.0.1:9',
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as { checks: Array<{ name: string; ok: boolean; detail: string }> };

    expect(response.status).toBe(503);
    expect(body.checks.find((check) => check.name === 'control_plane_persistence')?.ok).toBe(false);

    fs.rmSync(badPath, { force: true });
  });
});
