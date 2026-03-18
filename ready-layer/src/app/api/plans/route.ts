import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  parseQueryWithSchema,
  withTenantContext,
} from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import {
  addPlan,
  getPlanByHash,
  listPlans,
  replayPlanRun,
  runPlan,
} from "@/lib/control-plane-store";
import type {
  ApiResponse,
  Plan,
  PlanAddResponse,
  PlanListResponse,
  PlanReplayResponse,
  PlanRunResponse,
  PlanShowResponse,
  PlanStep,
} from "@/types/engine";

export const dynamic = "force-dynamic";

const getQuerySchema = z.object({
  "plan-hash": z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const stepSchema = z.object({
  step_id: z.string().min(1),
  kind: z.enum(["exec", "cas_put", "policy_eval", "gate"]),
  depends_on: z.array(z.string()),
  config: z.record(z.string(), z.unknown()),
});

const postSchema = z
  .object({
    action: z.enum(["add", "run", "replay"]),
    plan_id: z.string().optional(),
    steps: z.array(stepSchema).optional(),
    plan_hash: z.string().optional(),
    run_id: z.string().optional(),
    verify_exact: z.boolean().optional(),
  })
  .strict();

function toPlanResponse(
  plan: Plan | null,
  runs: Awaited<ReturnType<typeof getPlanByHash>>['runs'],
): ApiResponse<PlanShowResponse> {
  return {
    v: 1,
    kind: "plan.show",
    data: { ok: true, plan: plan ?? undefined, runs },
    error: null,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, getQuerySchema);
      const planHash = query["plan-hash"];
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      if (planHash) {
        const result = await getPlanByHash(ctx.tenant_id, planHash);
        if (!result.plan) {
          throw new ProblemError(
            404,
            "Plan Not Found",
            "No plan matched the provided plan-hash",
            {
              code: "plan_not_found",
            },
          );
        }
        return NextResponse.json(toPlanResponse(result.plan, result.runs), {
          status: 200,
        });
      }

      const tenantPlans = await listPlans(ctx.tenant_id);
      const pageData = tenantPlans.slice(offset, offset + limit);
      const response: ApiResponse<PlanListResponse> = {
        v: 1,
        kind: "plans.list",
        data: {
          ok: true,
          plans: pageData,
          total: tenantPlans.length,
        },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "plans.list_or_show",
      cache: false,
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === "add") {
        if (!body.plan_id || !body.steps?.length) {
          throw new ProblemError(
            400,
            "Missing Argument",
            "plan_id and steps array required",
            {
              code: "missing_argument",
            },
          );
        }

        const plan = await addPlan(ctx.tenant_id, ctx.actor_id, {
          plan_id: body.plan_id,
          steps: body.steps as PlanStep[],
        });

        const response: ApiResponse<PlanAddResponse> = {
          v: 1,
          kind: "plan.add",
          data: {
            ok: true,
            plan,
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === "run") {
        if (!body.plan_hash) {
          throw new ProblemError(
            400,
            "Missing Argument",
            "plan_hash required",
            {
              code: "missing_argument",
            },
          );
        }

        const runResult = await runPlan(ctx.tenant_id, ctx.actor_id, body.plan_hash);
        if (!runResult) {
          throw new ProblemError(
            404,
            "Plan Not Found",
            "No plan matched the provided plan_hash",
            {
              code: "plan_not_found",
            },
          );
        }

        const response: ApiResponse<PlanRunResponse> = {
          v: 1,
          kind: "plan.run",
          data: { ok: true, result: runResult },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (!body.run_id) {
        throw new ProblemError(400, "Missing Argument", "run_id required", {
          code: "missing_argument",
        });
      }

      const replayResult = await replayPlanRun(
        ctx.tenant_id,
        ctx.actor_id,
        body.run_id,
        body.verify_exact !== false,
      );
      if (!replayResult) {
        throw new ProblemError(
          404,
          "Run Not Found",
          "No run matched the provided run_id",
          {
            code: "run_not_found",
          },
        );
      }

      const response: ApiResponse<PlanReplayResponse> = {
        v: 1,
        kind: "plan.replay",
        data: {
          ok: true,
          original_run_id: body.run_id,
          replay_run_id: replayResult.run_id,
          exact_match: body.verify_exact !== false,
          receipt_hash_original: replayResult.replay_of_run_id
            ? ((await getPlanByHash(ctx.tenant_id, replayResult.plan_hash)).runs.find(
                (entry) => entry.run_id === body.run_id,
              )?.receipt_hash ?? replayResult.receipt_hash)
            : replayResult.receipt_hash,
          receipt_hash_replay: replayResult.receipt_hash,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "plans.mutate",
      idempotency: { required: true },
    },
  );
}
