// ready-layer/src/app/api/budgets/route.ts

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenantContext } from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import type {
  BudgetSetResponse,
  BudgetShowResponse,
  BudgetResetResponse,
  ApiResponse,
} from "@/types/engine";

export const dynamic = "force-dynamic";

const postSchema = z
  .object({
    action: z.enum(["set", "reset-window"]),
    unit: z.string().min(1).optional(),
    limit: z.number().positive().optional(),
  })
  .passthrough();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const mockBudget = {
        tenant_id: ctx.tenant_id,
        budgets: {
          exec: { limit: 1000, used: 42, remaining: 958 },
          cas_put: { limit: 5000, used: 150, remaining: 4850 },
          cas_get: { limit: 10000, used: 2300, remaining: 7700 },
          policy_eval: { limit: 5000, used: 89, remaining: 4911 },
          plan_step: { limit: 2000, used: 12, remaining: 1988 },
        },
        budget_hash: "abc123def456",
        version: 1,
      };

      const response: ApiResponse<BudgetShowResponse> = {
        v: 1,
        kind: "budget.show",
        data: { ok: true, budget: mockBudget },
        error: null,
      };

      return NextResponse.json(response, {
        status: 200,
        headers: { "x-requiem-mode": "demo" },
      });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "budget.show",
      cache: {
        ttlMs: 10_000,
        visibility: "private",
        staleWhileRevalidateMs: 10_000,
      },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const body = postSchema.parse(await request.json());

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

        const response: ApiResponse<BudgetSetResponse> = {
          v: 1,
          kind: "budget.set",
          data: { ok: true },
          error: null,
        };
        return NextResponse.json(response, {
          status: 200,
          headers: { "x-requiem-mode": "demo" },
        });
      }

      const response: ApiResponse<BudgetResetResponse> = {
        v: 1,
        kind: "budget.reset_window",
        data: { ok: true, message: "Budget window reset successfully" },
        error: null,
      };
      return NextResponse.json(response, {
        status: 200,
        headers: { "x-requiem-mode": "demo" },
      });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "budget.mutate",
      idempotency: { required: false },
    },
  );
}
