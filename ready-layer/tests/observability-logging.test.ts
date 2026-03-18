import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  process.env = { ...originalEnv };
});

describe('structured observability logs', () => {
  it('emits machine-parseable request and mutation lifecycle logs with correlation fields', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-logs-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      REQUIEM_AUTH_SECRET: 'log-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { POST } = await import('../src/app/api/budgets/route');
    const response = await POST(
      new NextRequest('http://localhost/api/budgets', {
        method: 'POST',
        headers: {
          authorization: 'Bearer log-secret',
          'x-tenant-id': 'tenant-log',
          'content-type': 'application/json',
          'idempotency-key': 'budget-log-1',
          'x-trace-id': 'trace-log-1',
          'x-request-id': 'request-log-1',
        },
        body: JSON.stringify({ action: 'set', unit: 'exec', limit: 123 }),
      }),
    );

    expect(response.status).toBe(200);

    const events = infoSpy.mock.calls
      .map((call) => call[0])
      .map((line) => JSON.parse(String(line)) as { event: string; trace_id?: string; request_id?: string; route_id?: string });

    expect(events.some((entry) => entry.event === 'api.request.received' && entry.trace_id === 'trace-log-1')).toBe(true);
    expect(events.some((entry) => entry.event === 'api.mutation.started' && entry.request_id === 'request-log-1')).toBe(true);
    expect(events.some((entry) => entry.event === 'control_plane.mutation.started' && entry.route_id === 'budget.mutate')).toBe(true);
    expect(events.some((entry) => entry.event === 'control_plane.mutation.completed' && entry.route_id === 'budget.mutate')).toBe(true);
    expect(events.some((entry) => entry.event === 'api.mutation.completed' && entry.request_id === 'request-log-1')).toBe(true);
    expect(events.some((entry) => entry.event === 'api.request.completed' && entry.trace_id === 'trace-log-1')).toBe(true);

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  });
});
