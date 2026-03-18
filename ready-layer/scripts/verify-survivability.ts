import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { NextRequest } from 'next/server';

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-survivability-'));
  const repoReadyLayerDir = process.cwd();
  const workerCount = 8;
  const tenantId = 'survivability-tenant';

  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('failed to bind readiness probe server');
  }

  process.env = {
    ...process.env,
    NODE_ENV: 'production',
    REQUIEM_AUTH_SECRET: 'survivability-secret',
    REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    REQUIEM_API_URL: `http://127.0.0.1:${address.port}`,
  };

  await Promise.all(
    Array.from({ length: workerCount }, (_, index) =>
      execFileAsync('pnpm', ['exec', 'tsx', 'scripts/control-plane-concurrency-worker.ts', controlPlaneDir, tenantId, String(index)], {
        cwd: repoReadyLayerDir,
      }),
    ),
  );

  const { listPlans } = await import('../src/lib/control-plane-store');
  const plans = listPlans(tenantId);
  if (plans.length !== workerCount) {
    throw new Error(`expected ${workerCount} plans after concurrent writes, saw ${plans.length}`);
  }

  const { POST } = await import('../src/app/api/snapshots/route');
  const headers = {
    authorization: 'Bearer survivability-secret',
    'x-tenant-id': tenantId,
    'content-type': 'application/json',
    'idempotency-key': 'survivability-snapshot-1',
    'x-trace-id': 'survivability-trace',
  };

  const responses = await Promise.all(
    Array.from({ length: 4 }, () =>
      POST(
        new NextRequest('http://localhost/api/snapshots', {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'create' }),
        }),
      ),
    ),
  );

  const bodies = await Promise.all(responses.map((response) => response.json() as Promise<{ data?: { snapshot?: { snapshot_hash?: string } } }>));
  const snapshotHashes = new Set(bodies.map((body) => body.data?.snapshot?.snapshot_hash).filter(Boolean));
  if (snapshotHashes.size !== 1) {
    throw new Error(`expected one replayed snapshot result, saw ${snapshotHashes.size}`);
  }

  const { GET: readinessGET } = await import('../src/app/api/readiness/route');
  const readinessResponse = await readinessGET(new NextRequest('http://localhost/api/readiness'));
  const readinessBody = await readinessResponse.json() as { ok: boolean; status: string; checks: Array<{ name: string; ok: boolean }> };
  if (readinessResponse.status !== 200 || !readinessBody.ok) {
    throw new Error(`readiness should pass under configured dependencies: ${JSON.stringify(readinessBody)}`);
  }

  const summary = {
    workerCount,
    planCount: plans.length,
    snapshotHash: [...snapshotHashes][0],
    readiness: readinessBody.status,
  };

  console.log(JSON.stringify(summary));
  server.close();
  fs.rmSync(controlPlaneDir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
