import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  parseQueryWithSchema,
  withTenantContext,
} from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import {
  listCapabilities,
  mintCapability,
  revokeCapability,
} from "@/lib/control-plane-store";
import type {
  ApiResponse,
  CapabilityMintResponse,
  CapabilityRevokeResponse,
  PaginatedResponse,
  CapabilityListItem,
} from "@/types/engine";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z
  .object({
    action: z.enum(["mint", "revoke"]),
    subject: z.string().min(1).optional(),
    permissions: z.array(z.string().min(1)).optional(),
    not_before: z.number().int().optional(),
    not_after: z.number().int().optional(),
    fingerprint: z.string().min(1).optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, querySchema);
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;
      const capabilities = listCapabilities(ctx.tenant_id);
      const pageData = capabilities.slice(offset, offset + limit);

      const response: ApiResponse<PaginatedResponse<CapabilityListItem>> = {
        v: 1,
        kind: "caps.list",
        data: {
          ok: true,
          data: pageData,
          total: capabilities.length,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: offset + pageData.length < capabilities.length,
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return withDemoHeaders(NextResponse.json(response, { status: 200 }));
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "caps.list",
      cache: false,
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === "mint") {
        if (!body.subject || !body.permissions?.length) {
          throw new ProblemError(
            400,
            "Missing Argument",
            "subject and permissions array required",
            {
              code: "missing_argument",
            },
          );
        }

        const token = mintCapability(ctx.tenant_id, ctx.actor_id, {
          subject: body.subject,
          permissions: body.permissions,
          not_before: body.not_before,
          not_after: body.not_after,
        });
        const response: ApiResponse<CapabilityMintResponse> = {
          v: 1,
          kind: "caps.mint",
          data: {
            ok: true,
            fingerprint: token.fingerprint,
            subject: token.subject,
            scopes: token.permissions,
            not_before: token.not_before,
            not_after: token.not_after,
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (!body.fingerprint) {
        throw new ProblemError(
          400,
          "Missing Argument",
          "fingerprint required",
          {
            code: "missing_argument",
          },
        );
      }

      const revoked = revokeCapability(
        ctx.tenant_id,
        ctx.actor_id,
        body.fingerprint,
      );
      if (!revoked) {
        throw new ProblemError(
          404,
          "Capability Not Found",
          "No capability matched the provided fingerprint",
          {
            code: "capability_not_found",
          },
        );
      }

      const response: ApiResponse<CapabilityRevokeResponse> = {
        v: 1,
        kind: "caps.revoke",
        data: { ok: true, fingerprint: revoked.fingerprint, revoked: true },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "caps.mutate",
      idempotency: { required: true },
    },
  );
}
