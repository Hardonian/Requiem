import { NextRequest, NextResponse } from "next/server";
import { parseQueryWithSchema, withTenantContext } from "@/lib/big4-http";
import { listRunSummaries } from "@/lib/control-plane-store";
import { z } from "zod";
import { writeAudit } from "@/lib/big4-audit";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const limit = query.limit ?? 25;
      const offset = query.offset ?? 0;
      const allRuns = await listRunSummaries(ctx.tenant_id);
      const runs = allRuns.slice(offset, offset + limit);

      await writeAudit({
        tenant_id: ctx.tenant_id,
        actor_id: ctx.actor_id,
        request_id: ctx.request_id,
        trace_id: ctx.trace_id,
        event_type: "RUN_LIST_VIEWED",
        payload: { route: "/api/runs", limit, offset, returned: runs.length },
      });

      return NextResponse.json(
        {
          v: 1,
          ok: true,
          data: runs,
          total: allRuns.length,
          trace_id: ctx.trace_id,
        },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "runs.list",
      cache: false,
    },
  );
}
