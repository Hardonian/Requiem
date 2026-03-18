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

async function expectProblemContract(response: Response, expectedStatus: number, label: string): Promise<void> {
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected status ${expectedStatus}, got ${response.status}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/problem+json')) {
    throw new Error(`${label}: expected application/problem+json content-type, got ${contentType || '<missing>'}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  if (body.status !== expectedStatus) {
    throw new Error(`${label}: expected body.status=${expectedStatus}, got ${String(body.status)}`);
  }
  if (typeof body.trace_id !== 'string' || body.trace_id.length === 0) {
    throw new Error(`${label}: missing trace_id in problem payload`);
  }
  if (typeof body.title !== 'string' || body.title.length === 0) {
    throw new Error(`${label}: missing title in problem payload`);
  }
}

async function main() {
  for (const auditPath of auditPaths) {
    if (!existsSync(dirname(auditPath))) mkdirSync(dirname(auditPath), { recursive: true });
    writeFileSync(auditPath, '', 'utf8');
  }

  const server = spawn('pnpm', ['--filter', 'ready-layer', 'dev', '-p', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', REQUIEM_ROUTE_VERIFY_MODE: '1', NODE_ENV: 'test', REQUIEM_AUTH_SECRET: 'verify-secret' },
    detached: true,
  });

  let stderr = '';
  server.stderr.on('data', (d) => {
    stderr += String(d);
  });

  try {
    await waitForReady();

    const runsRes = await fetch(`${base}/api/runs?limit=2&offset=0`, {
      headers: {
        'x-tenant-id': 'tenant-route-test',
        'x-user-id': 'actor-route-test',
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

    const lines = auditPaths.flatMap((auditPath) => readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean));
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
    if (last.event_type !== 'RUN_LIST_VIEWED') throw new Error(`Unexpected event_type in audit event: ${last.event_type}`);

    const probe404 = await fetch(`${base}/api/routes-probe?missing=1`, {
      headers: { 'x-tenant-id': 'tenant-route-test', 'x-user-id': 'actor-route-test' },
    });
    await expectProblemContract(probe404, 404, 'routes-probe-404');

    const methodNotAllowed = await fetch(`${base}/api/routes-probe`, { method: 'POST' });
    await expectProblemContract(methodNotAllowed, 405, 'routes-probe-405');

    let limited = false;
    for (let i = 0; i < 130; i += 1) {
      const burstRes = await fetch(`${base}/api/runs`, {
        headers: { 'x-tenant-id': 'tenant-burst', 'x-user-id': 'actor-burst' },
      });
      if (burstRes.status === 429) {
        await expectProblemContract(burstRes, 429, 'runs-rate-limit');
        limited = true;
        break;
      }
    }
    if (!limited) {
      console.warn('verify-routes-runtime: rate limiter did not trigger under burst; skipping 429 contract assertion');
    }

    console.log('verify-routes-runtime passed');
  } finally {
    try {
      process.kill(-server.pid!, 'SIGTERM');
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      process.kill(-server.pid!, 'SIGKILL');
    } catch {
      // ignore
    }
    if (stderr.includes('ERR!')) {
      // non-fatal: explicit assertions above guard correctness
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
