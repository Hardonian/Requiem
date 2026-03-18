import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonWithSchema, withTenantContext } from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import {
  getBudget,
  resetBudgetWindow,
  setBudgetLimit,
} from "@/lib/control-plane-store";
import type {
  ApiResponse,
  BudgetResetResponse,
  BudgetSetResponse,
  BudgetShowResponse,
} from "@/types/engine";

export const dynamic = "force-dynamic";

const postSchema = z
  .object({
    action: z.enum(["set", "reset-window"]),
    unit: z
      .enum(["exec", "cas_put", "cas_get", "policy_eval", "plan_step"])
      .optional(),
    limit: z.number().positive().optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const response: ApiResponse<BudgetShowResponse> = {
        v: 1,
        kind: "budget.show",
        data: { ok: true, budget: getBudget(ctx.tenant_id) },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "budget.show",
      cache: false,
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const body = await parseJsonWithSchema(request, postSchema);

      if (body.action === "set") {
        if (!body.unit || body.limit === undefined) {
          throw new ProblemError(
            400,
            "Missing Argument",
            "unit and limit required for action=set",
            {
              code: "missing_argument",
            },
          );
        }

        const budget = setBudgetLimit(
          ctx.tenant_id,
          ctx.actor_id,
          body.unit,
          body.limit,
        );
        const response: ApiResponse<BudgetSetResponse> = {
          v: 1,
          kind: "budget.set",
          data: { ok: true, budget },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const budget = resetBudgetWindow(ctx.tenant_id, ctx.actor_id);
      const response: ApiResponse<BudgetResetResponse> = {
        v: 1,
        kind: "budget.reset_window",
        data: { ok: true, message: "Budget window reset successfully", budget },
        error: null,
      } as ApiResponse<BudgetResetResponse>;
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "budget.mutate",
      idempotency: { required: true },
    },
  );
}
