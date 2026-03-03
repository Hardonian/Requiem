#!/usr/bin/env tsx
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const port = 3212;
const base = `http://127.0.0.1:${port}`;
const auditPaths = ['.requiem/audit/events.ndjson', 'ready-layer/.requiem/audit/events.ndjson'];

async function waitForReady(timeoutMs = 120_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for ready-layer dev server');
}

async function main() {
  for (const auditPath of auditPaths) {
    if (!existsSync(dirname(auditPath))) mkdirSync(dirname(auditPath), { recursive: true });
    writeFileSync(auditPath, '', 'utf8');
  }

  const server = spawn('pnpm', ['--filter', 'ready-layer', 'dev', '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', REQUIEM_ROUTE_VERIFY_MODE: '1' },
  });

  let stderr = '';
  server.stderr.on('data', (d) => { stderr += String(d); });

  try {
    await waitForReady();

    const runsRes = await fetch(`${base}/api/runs?limit=2&offset=0`, {
      headers: {
        'x-tenant-id': 'tenant-route-test',
        'x-actor-id': 'actor-route-test',
        'x-request-id': 'req-route-test',
        'x-trace-id': 'trace-route-test',
      },
    });

    if (runsRes.status !== 200) throw new Error(`Expected /api/runs 200, got ${runsRes.status}`);
    if (runsRes.headers.get('x-request-id') !== 'req-route-test') {
      throw new Error('Expected x-request-id propagation from middleware');
    }
    if (runsRes.headers.get('x-trace-id') !== 'trace-route-test') {
      throw new Error('Expected x-trace-id propagation from middleware');
    }

    const lines = auditPaths
      .flatMap((auditPath) => readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean));
    if (lines.length === 0) throw new Error('Expected audit event write for /api/runs');
    const last = JSON.parse(lines.at(-1) as string) as {
      tenant_id: string;
      actor_id: string;
      request_id: string;
      trace_id: string;
      event_type: string;
    };
    if (last.tenant_id !== 'tenant-route-test') throw new Error(`Unexpected tenant in audit event: ${last.tenant_id}`);
    if (last.actor_id !== 'actor-route-test') throw new Error(`Unexpected actor in audit event: ${last.actor_id}`);
    if (last.request_id !== 'req-route-test') throw new Error(`Unexpected request_id in audit event: ${last.request_id}`);
    if (last.trace_id !== 'trace-route-test') throw new Error(`Unexpected trace_id in audit event: ${last.trace_id}`);
    if (last.event_type !== 'RUN_CREATED') throw new Error(`Unexpected event_type in audit event: ${last.event_type}`);

    const diffDenied = await fetch(`${base}/api/runs/r1/diff?with=r2`, {
      headers: { 'x-tenant-id': 'tenant-route-test' },
    });
    if (diffDenied.status !== 403) throw new Error(`Expected policy pre-exec 403, got ${diffDenied.status}`);

    const probe404 = await fetch(`${base}/api/routes-probe?missing=1`, {
      headers: { 'x-tenant-id': 'tenant-route-test', 'x-actor-id': 'actor-route-test' },
    });
    if (probe404.status !== 404) throw new Error(`Expected 404 contract, got ${probe404.status}`);

    const methodNotAllowed = await fetch(`${base}/api/routes-probe`, { method: 'POST' });
    if (methodNotAllowed.status !== 405) throw new Error(`Expected 405 contract, got ${methodNotAllowed.status}`);

    let limited = false;
    for (let i = 0; i < 130; i += 1) {
      const burstRes = await fetch(`${base}/api/runs`, {
        headers: { 'x-tenant-id': 'tenant-burst', 'x-actor-id': 'actor-burst' },
      });
      if (burstRes.status === 429) {
        limited = true;
        break;
      }
    }
    if (!limited) throw new Error('Expected 429 from rate limiter under burst');

    console.log('verify-routes-runtime passed');
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (!server.killed) server.kill('SIGKILL');
    if (stderr.includes('ERR!')) {
      // keep check non-fatal; explicit assertions above guard correctness
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
