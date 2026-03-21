import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonWithSchema, withTenantContext } from '@/lib/big4-http';
import { startWorkerLoop } from '@/lib/control-plane-store';
import { getActiveWorkers, workerKey } from '@/lib/worker-registry';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const postSchema = z.object({
  action: z.enum(['start', 'stop', 'status']),
  org_id: z.string().optional(),
  poll_interval_ms: z.number().int().min(100).max(300_000).optional(),
  batch_size: z.number().int().min(1).max(100).optional(),
}).strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const activeWorkers = getActiveWorkers();
      const workers = Array.from(activeWorkers.entries())
        .filter(([key]) => key.startsWith(`${ctx.tenant_id}:`))
        .map(([key, handle]) => ({
          key,
          worker_id: handle.workerId,
          started_at_unix_ms: handle.started_at_unix_ms,
          cycles_completed: handle.getCycles().length,
          last_cycle: handle.getCycles().at(-1) ?? null,
        }));

      const response: ApiResponse<{ ok: boolean; workers: typeof workers }> = {
        v: 1,
        kind: 'worker.list',
        data: { ok: true, workers },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'worker.list', cache: false },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);
      const key = workerKey(ctx.tenant_id, body.org_id);
      const activeWorkers = getActiveWorkers();

      if (body.action === 'status') {
        const handle = activeWorkers.get(key);
        if (!handle) {
          return NextResponse.json({
            v: 1, kind: 'worker.status',
            data: { ok: true, running: false, worker_id: null, cycles: [] },
            error: null,
          }, { status: 200 });
        }
        return NextResponse.json({
          v: 1, kind: 'worker.status',
          data: {
            ok: true,
            running: true,
            worker_id: handle.workerId,
            started_at_unix_ms: handle.started_at_unix_ms,
            cycles: handle.getCycles().slice(-20),
          },
          error: null,
        }, { status: 200 });
      }

      if (body.action === 'stop') {
        const handle = activeWorkers.get(key);
        if (!handle) {
          return NextResponse.json({
            v: 1, kind: 'worker.stop',
            data: { ok: true, was_running: false },
            error: null,
          }, { status: 200 });
        }
        handle.stop();
        activeWorkers.delete(key);
        return NextResponse.json({
          v: 1, kind: 'worker.stop',
          data: { ok: true, was_running: true, worker_id: handle.workerId, cycles_completed: handle.getCycles().length },
          error: null,
        }, { status: 200 });
      }

      // action === 'start'
      if (activeWorkers.has(key)) {
        const existing = activeWorkers.get(key)!;
        return NextResponse.json({
          v: 1, kind: 'worker.start',
          data: { ok: true, already_running: true, worker_id: existing.workerId, started_at_unix_ms: existing.started_at_unix_ms },
          error: null,
        }, { status: 200 });
      }

      const workerId = `worker-${ctx.tenant_id}-${Date.now().toString(36)}`;
      const handle = startWorkerLoop({
        tenantId: ctx.tenant_id,
        actorId: ctx.actor_id,
        workerId,
        orgId: body.org_id,
        pollIntervalMs: body.poll_interval_ms,
        batchSize: body.batch_size,
      });
      activeWorkers.set(key, handle);

      return NextResponse.json({
        v: 1, kind: 'worker.start',
        data: {
          ok: true,
          already_running: false,
          worker_id: workerId,
          started_at_unix_ms: handle.started_at_unix_ms,
          poll_interval_ms: body.poll_interval_ms ?? Number(process.env.REQUIEM_WORKER_POLL_MS ?? 5_000),
          batch_size: body.batch_size ?? Number(process.env.REQUIEM_WORKER_BATCH_SIZE ?? 10),
        },
        error: null,
      }, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'worker.control', idempotency: { required: true } },
  );
}
