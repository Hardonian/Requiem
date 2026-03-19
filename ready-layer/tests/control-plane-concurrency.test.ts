import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const execFileAsync = promisify(execFile);
const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('control-plane concurrency and idempotency', () => {
  it('preserves all concurrent multi-process plan mutations for one tenant', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-concurrency-'));
    const readyLayerDir = process.cwd();
    const workerCount = 6;

    await Promise.all(
      Array.from({ length: workerCount }, (_, index) =>
        execFileAsync('pnpm', ['exec', 'tsx', 'scripts/control-plane-concurrency-worker.ts', controlPlaneDir, 'tenant-lock', String(index)], {
          cwd: readyLayerDir,
        }),
      ),
    );

    process.env = {
      ...originalEnv,
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const { listPlans } = await import('../src/lib/control-plane-store');
    const plans = await listPlans('tenant-lock');
    expect(plans).toHaveLength(workerCount);
    expect(new Set(plans.map((plan) => plan.plan_id)).size).toBe(workerCount);

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  }, 20_000);

  it('replays concurrent duplicate submissions through idempotency cache', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-idempotency-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      REQUIEM_AUTH_SECRET: 'idempotency-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const { POST } = await import('../src/app/api/snapshots/route');
    const makeRequest = () => POST(
      new NextRequest('http://localhost/api/snapshots', {
        method: 'POST',
        headers: {
          authorization: 'Bearer idempotency-secret',
          'x-tenant-id': 'tenant-idempotency',
          'content-type': 'application/json',
          'idempotency-key': 'snapshot-burst-1',
        },
        body: JSON.stringify({ action: 'create' }),
      }),
    );

    const responses = await Promise.all([makeRequest(), makeRequest(), makeRequest()]);
    const bodies = await Promise.all(responses.map((response) => response.json() as Promise<{ data?: { snapshot?: { snapshot_hash?: string } } }>));

    expect(new Set(bodies.map((body) => body.data?.snapshot?.snapshot_hash)).size).toBe(1);
    expect(responses.slice(1).every((response) => response.headers.get('x-idempotency-replayed') === '1')).toBe(true);

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  });
});
