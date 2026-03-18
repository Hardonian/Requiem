import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import { getRunSummary } from "@/lib/control-plane-store";

function computeDiff(
  runA: { run_id: string; result_digest: string },
  runB: { run_id: string; result_digest: string },
) {
  return {
    runA: runA.run_id,
    runB: runB.run_id,
    deterministic: runA.result_digest === runB.result_digest,
    inputChanged: false,
    outputChanged: runA.result_digest !== runB.result_digest,
    firstDivergenceStep: runA.result_digest === runB.result_digest ? null : 0,
    diffDigest: `${runA.result_digest.slice(0, 16)}${runB.result_digest.slice(0, 16)}`,
    topDeltas:
      runA.result_digest === runB.result_digest
        ? []
        : [
            {
              type: "output",
              severity: "high",
              summary: "Output fingerprint differs",
              taxonomy: "STRUCTURAL_MISMATCH",
            },
          ],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const { runId } = await params;
      const { searchParams } = new URL(request.url);
      const withRunId = searchParams.get("with");

      if (!withRunId) {
        throw new ProblemError(
          400,
          "Missing Query Parameter",
          "with query parameter is required",
          {
            code: "missing_with_parameter",
          },
        );
      }

      const primary = await getRunSummary(ctx.tenant_id, runId);
      const comparison = await getRunSummary(ctx.tenant_id, withRunId);
      if (!primary || !comparison) {
        throw new ProblemError(
          404,
          "Run Not Found",
          "One or both run IDs were not found in the current tenant.",
          {
            code: "run_not_found",
          },
        );
      }

      const diff = computeDiff(primary, comparison);
      return NextResponse.json(
        { ok: true, data: diff, redacted: false },
        { status: 200 },
      );
    },
    async (ctx) => ({
      allow: ctx.actor_id !== "anonymous",
      reasons: ctx.actor_id !== "anonymous" ? [] : ["actor identity required"],
    }),
    {
      routeId: "runs.diff",
      cache: {
        ttlMs: 5_000,
        visibility: "private",
        staleWhileRevalidateMs: 5_000,
      },
    },
  );
}
