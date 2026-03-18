import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQueryWithSchema, withTenantContext } from "@/lib/big4-http";
import { listLogs } from "@/lib/control-plane-store";

export const dynamic = "force-dynamic";

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
    kind: "logs.list",
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
      const to = query.to ?? Number.MAX_SAFE_INTEGER;
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;
      const search = query.q?.trim().toLowerCase() ?? "";

      const filtered = listLogs(ctx.tenant_id).filter((entry) => {
        if (entry.seq < from || entry.seq > to) return false;
        if (!search) return true;
        return [
          entry.event_type,
          entry.actor,
          entry.message,
          JSON.stringify(entry.payload),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      });
      const pageData = filtered.slice(offset, offset + limit);

      const response = createResponse(
        {
          ok: true,
          data: pageData,
          total: filtered.length,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: offset + pageData.length < filtered.length,
          trace_id: ctx.trace_id,
        },
        ctx.trace_id,
      );

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "logs.list",
      cache: false,
    },
  );
}
