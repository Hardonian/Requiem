import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseQueryWithSchema, withTenantContext } from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import { hasCasObject, listCasObjects } from "@/lib/control-plane-store";
import type { ApiResponse, CasObject, PaginatedResponse } from "@/types/engine";

export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  prefix: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const headQuerySchema = z.object({
  hash: z.string().min(1),
});

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, listQuerySchema);
      const prefix = query.prefix ?? "";
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;
      const objects = listCasObjects(ctx.tenant_id, prefix);
      const pageData = objects.slice(offset, offset + limit);

      const paginatedData: PaginatedResponse<CasObject> = {
        ok: true,
        data: pageData,
        total: objects.length,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + pageData.length < objects.length,
        trace_id: ctx.trace_id,
      };

      const response: ApiResponse<PaginatedResponse<CasObject>> = {
        v: 1,
        kind: "cas.objects.list",
        data: paginatedData,
        error: null,
      };

      return withDemoHeaders(NextResponse.json(response, { status: 200 }));
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "objects.list",
      cache: false,
    },
  );
}

export async function HEAD(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, headQuerySchema);
      if (!query.hash) {
        throw new ProblemError(400, "Missing Hash", "hash required", {
          code: "missing_hash",
        });
      }

      return new NextResponse(null, {
        status: hasCasObject(ctx.tenant_id, query.hash) ? 200 : 404,
      });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "objects.head",
      cache: false,
    },
  );
}
