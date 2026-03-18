import { NextRequest, NextResponse } from "next/server";
import { parseQueryWithSchema, withTenantContext } from "@/lib/big4-http";
import { listDecisions } from "@/lib/control-plane-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

interface Decision {
  id: string;
  policy_id: string;
  result: string;
  timestamp: number;
}

interface DecisionsResponse {
  ok: boolean;
  data?: Decision[];
  total?: number;
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const decisions = listDecisions(ctx.tenant_id);
      const response: DecisionsResponse = {
        ok: true,
        data: decisions.slice(offset, offset + limit),
        total: decisions.length,
        trace_id: ctx.trace_id,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "decisions.list",
      cache: false,
    },
  );
}
