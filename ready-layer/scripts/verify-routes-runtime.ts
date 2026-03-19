import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const auditPaths = ['.requiem/audit/events.ndjson', 'ready-layer/.requiem/audit/events.ndjson'];
const originalEnv = { ...process.env };

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
  const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-routes-runtime-'));

  try {
    for (const auditPath of auditPaths) {
      if (!fs.existsSync(path.dirname(auditPath))) fs.mkdirSync(path.dirname(auditPath), { recursive: true });
      fs.writeFileSync(auditPath, '', 'utf8');
    }

    process.env = {
      ...originalEnv,
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_ENV: 'test',
      REQUIEM_AUTH_SECRET: 'verify-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const { GET: getRuns } = await import('../src/app/api/runs/route');
    const routesProbe = await import('../src/app/api/routes-probe/route');

    const authHeaders = {
      authorization: 'Bearer verify-secret',
      'x-tenant-id': 'tenant-route-test',
      'x-request-id': 'req-route-test',
      'x-trace-id': 'trace-route-test',
    };

    const runsRes = await getRuns(new NextRequest('http://localhost/api/runs?limit=2&offset=0', {
      headers: authHeaders,
    }));

    if (runsRes.status !== 200) throw new Error(`Expected /api/runs 200, got ${runsRes.status}`);
    if (runsRes.headers.get('x-request-id') !== 'req-route-test') {
      throw new Error('Expected x-request-id propagation from route wrapper');
    }
    if (runsRes.headers.get('x-trace-id') !== 'trace-route-test') {
      throw new Error('Expected x-trace-id propagation from route wrapper');
    }
    if (runsRes.headers.get('x-requiem-execution-model') !== 'request-bound-same-runtime') {
      throw new Error('Expected execution model truth header on /api/runs');
    }

    const lines = auditPaths.flatMap((auditPath) => fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean));
    if (lines.length === 0) throw new Error('Expected audit event write for /api/runs');
    const last = JSON.parse(lines.at(-1) as string) as {
      tenant_id: string;
      actor_id: string;
      request_id: string;
      trace_id: string;
      event_type: string;
    };
    if (last.tenant_id !== 'tenant-route-test') throw new Error(`Unexpected tenant in audit event: ${last.tenant_id}`);
    if (last.actor_id !== 'tenant-route-test') throw new Error(`Unexpected actor in audit event: ${last.actor_id}`);
    if (last.request_id !== 'req-route-test') throw new Error(`Unexpected request_id in audit event: ${last.request_id}`);
    if (last.trace_id !== 'trace-route-test') throw new Error(`Unexpected trace_id in audit event: ${last.trace_id}`);
    if (last.event_type !== 'RUN_LIST_VIEWED') throw new Error(`Unexpected event_type in audit event: ${last.event_type}`);

    const probe404 = await routesProbe.GET(new NextRequest('http://localhost/api/routes-probe?missing=1', {
      headers: authHeaders,
    }));
    await expectProblemContract(probe404, 404, 'routes-probe-404');

    const methodNotAllowed = await routesProbe.POST(new NextRequest('http://localhost/api/routes-probe', {
      method: 'POST',
      headers: authHeaders,
    }));
    await expectProblemContract(methodNotAllowed, 405, 'routes-probe-405');

    let limited = false;
    for (let i = 0; i < 130; i += 1) {
      const burstRes = await getRuns(new NextRequest('http://localhost/api/runs', {
        headers: {
          authorization: 'Bearer verify-secret',
          'x-tenant-id': 'tenant-burst',
        },
      }));
      if (burstRes.status === 429) {
        await expectProblemContract(burstRes, 429, 'runs-rate-limit');
        limited = true;
        break;
      }
    }
    if (!limited) {
      throw new Error('verify-routes-runtime expected local rate limiter to trigger under burst traffic');
    }

    console.log('verify-routes-runtime passed');
  } finally {
    process.env = { ...originalEnv };
    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
