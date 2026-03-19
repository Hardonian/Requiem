#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const repoRoot = process.cwd();
const port = Number(process.env.FIRST_CUSTOMER_PORT ?? 3100);
const baseUrl = `http://127.0.0.1:${port}`;
const controlPlaneDir = mkdtempSync(path.join(os.tmpdir(), 'requiem-first-customer-'));
const serverLogs = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`, { cache: 'no-store' });
      if (res.ok) return;
    } catch {}
    await wait(500);
  }
  throw new Error(`Timed out waiting for ${url}/api/health`);
}

const child = spawn('pnpm', ['--filter', 'ready-layer', 'exec', 'next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: repoRoot,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key',
    REQUIEM_AUTH_SECRET: process.env.REQUIEM_AUTH_SECRET ?? 'first-customer-secret',
    REQUIEM_AUTH_MODE: 'strict',
    REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => serverLogs.push(String(chunk)));
child.stderr.on('data', (chunk) => serverLogs.push(String(chunk)));

let exitCode = 0;
try {
  await waitForHealth(baseUrl);

  const smoke = spawn('bash', ['ready-layer/scripts/smoke-api.sh'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      AUTH_TOKEN: process.env.REQUIEM_AUTH_SECRET ?? 'first-customer-secret',
      TENANT_ID: 'first-customer-tenant',
      EXPECT_RUNTIME_SCOPE: 'local-single-runtime',
      SMOKE_MODE: 'full',
    },
    stdio: 'inherit',
  });

  exitCode = await new Promise((resolve, reject) => {
    smoke.on('exit', (code) => resolve(code ?? 1));
    smoke.on('error', reject);
  });

  if (exitCode !== 0) {
    throw new Error(`smoke-api exited with code ${exitCode}`);
  }

  console.log(JSON.stringify({ ok: true, mode: 'local-single-runtime', baseUrl }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error(serverLogs.join(''));
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await wait(1_000);
  if (!child.killed) {
    child.kill('SIGKILL');
  }
  rmSync(controlPlaneDir, { recursive: true, force: true });
}
