import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  parseQueryWithSchema,
  withTenantContext,
} from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import {
  createSnapshot,
  listSnapshots,
  restoreSnapshot,
} from "@/lib/control-plane-store";
import type {
  ApiResponse,
  PaginatedResponse,
  Snapshot,
  SnapshotCreateResponse,
  SnapshotRestoreResponse,
} from "@/types/engine";

export const dynamic = "force-dynamic";

const getQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z
  .object({
    action: z.enum(["create", "restore"]),
    snapshot_hash: z.string().optional(),
    force: z.boolean().optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, getQuerySchema);
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;
      const snapshots = listSnapshots(ctx.tenant_id);
      const pageData = snapshots.slice(offset, offset + limit);

      const response: ApiResponse<PaginatedResponse<Snapshot>> = {
        v: 1,
        kind: "snapshots.list",
        data: {
          ok: true,
          data: pageData,
          total: snapshots.length,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: offset + pageData.length < snapshots.length,
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return withDemoHeaders(NextResponse.json(response, { status: 200 }));
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "snapshots.list",
      cache: false,
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === "create") {
        const snapshot = createSnapshot(ctx.tenant_id, ctx.actor_id);
        const response: ApiResponse<SnapshotCreateResponse> = {
          v: 1,
          kind: "snapshot.create",
          data: { ok: true, snapshot },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (!body.snapshot_hash) {
        throw new ProblemError(
          400,
          "Missing Argument",
          "snapshot_hash required",
          {
            code: "missing_argument",
          },
        );
      }

      if (!body.force) {
        throw new ProblemError(
          409,
          "Confirmation Required",
          "Snapshot restore requires force=true to acknowledge state replacement.",
          {
            code: "restore_confirmation_required",
          },
        );
      }

      const snapshot = restoreSnapshot(
        ctx.tenant_id,
        ctx.actor_id,
        body.snapshot_hash,
      );
      if (!snapshot) {
        throw new ProblemError(
          404,
          "Snapshot Not Found",
          "No snapshot matched the provided snapshot_hash",
          {
            code: "snapshot_not_found",
          },
        );
      }

      const response: ApiResponse<SnapshotRestoreResponse> = {
        v: 1,
        kind: "snapshot.restore",
        data: {
          ok: true,
          restored_logical_time: snapshot.logical_time,
          message: `Successfully restored snapshot ${body.snapshot_hash}`,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "snapshots.mutate",
      idempotency: { required: true },
    },
  );
}
