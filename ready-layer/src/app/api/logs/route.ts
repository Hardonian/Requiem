// ready-layer/src/app/api/logs/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import type { EventLogEntry } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  from: z.coerce.number().int().min(0).optional(),
  to: z.coerce.number().int().min(0).optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

function createResponse<T>(data: T, trace_id: string) {
  return {
    v: 1,
    kind: 'logs.list',
    data,
    error: null,
    trace_id,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const from = query.from ?? 0;
      const to = query.to ?? 999999999;
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;
      void query.q;

      const mockEvents: EventLogEntry[] = [];
      for (let i = 0; i < Math.min(limit, 10); i++) {
        const seq = from + offset + i;
        if (seq > to) break;

        mockEvents.push({
          seq,
          prev: seq === 1
            ? '0000000000000000000000000000000000000000000000000000000000000000'
            : `hash_${seq - 1}`,
          ts_logical: seq,
          event_type: i % 3 === 0 ? 'exec.complete' : i % 3 === 1 ? 'cap.mint' : 'plan.run.complete',
          actor: 'system',
          data_hash: `data_hash_${seq}`,
          execution_id: `exec_${seq}`,
          tenant_id: ctx.tenant_id,
          request_digest: `req_digest_${seq}`,
          result_digest: `res_digest_${seq}`,
          engine_semver: '1.0.0',
          engine_abi_version: 2,
          hash_algorithm_version: 1,
          cas_format_version: 2,
          replay_verified: true,
          ok: true,
          error_code: '',
          duration_ns: 1000000 + (i * 100000),
          worker_id: 'w-001',
          node_id: 'n-001',
        });
      }

      const response = createResponse(
        {
          ok: true,
          data: mockEvents,
          total: mockEvents.length,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: mockEvents.length === limit,
          trace_id: ctx.trace_id,
        },
        ctx.trace_id,
      );

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'logs.list',
      cache: { ttlMs: 5_000, visibility: 'private', staleWhileRevalidateMs: 5_000 },
    },
  );
}
