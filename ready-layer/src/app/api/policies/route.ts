import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  parseQueryWithSchema,
  withTenantContext,
} from "@/lib/big4-http";
import { ProblemError } from "@/lib/problem-json";
import {
  addPolicy,
  evaluatePolicy,
  listPolicies,
  listPolicyVersions,
  runPolicyTests,
} from "@/lib/control-plane-store";
import type {
  ApiResponse,
  PaginatedResponse,
  PolicyAddResponse,
  PolicyDecision,
  PolicyEvalResponse,
  PolicyListItem,
  PolicyRule,
  PolicyTestResponse,
  PolicyVersionsResponse,
} from "@/types/engine";

export const dynamic = "force-dynamic";

const getQuerySchema = z.object({
  policy: z.string().optional(),
  versions: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const postSchema = z
  .object({
    action: z.enum(["add", "eval", "test"]),
    rules: z.array(z.custom<PolicyRule>()).optional(),
    policy_hash: z.string().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const query = parseQueryWithSchema(request, getQuerySchema);
      const policyId = query.policy;
      const versions = query.versions === "true";
      const limit = query.limit ?? 100;
      const offset = query.offset ?? 0;

      if (policyId && versions) {
        const response: ApiResponse<PolicyVersionsResponse> = {
          v: 1,
          kind: "policy.versions",
          data: {
            ok: true,
            policy_id: policyId,
            versions: listPolicyVersions(ctx.tenant_id, policyId),
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const policies = listPolicies(ctx.tenant_id);
      const pageData = policies.slice(offset, offset + limit);
      const response: ApiResponse<PaginatedResponse<PolicyListItem>> = {
        v: 1,
        kind: "policies.list",
        data: {
          ok: true,
          data: pageData,
          total: policies.length,
          page: Math.floor(offset / limit) + 1,
          page_size: limit,
          has_more: offset + pageData.length < policies.length,
          trace_id: ctx.trace_id,
        },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "policies.list",
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
        if (!body.rules?.length) {
          throw new ProblemError(
            400,
            "Missing Argument",
            "rules array required",
            {
              code: "missing_argument",
            },
          );
        }

        const policy = addPolicy(ctx.tenant_id, ctx.actor_id, body.rules);
        const response: ApiResponse<PolicyAddResponse> = {
          v: 1,
          kind: "policy.add",
          data: {
            ok: true,
            policy_hash: policy.hash,
            size: policy.size,
          },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      if (body.action === "eval") {
        if (!body.policy_hash || !body.context) {
          throw new ProblemError(
            400,
            "Missing Argument",
            "policy_hash and context required",
            {
              code: "missing_argument",
            },
          );
        }

        let decision: PolicyDecision;
        try {
          decision = evaluatePolicy(
            ctx.tenant_id,
            ctx.actor_id,
            body.policy_hash,
            body.context,
          );
        } catch (error) {
          if (error instanceof Error && error.message === "policy_not_found") {
            throw new ProblemError(
              404,
              "Policy Not Found",
              "No policy matched the provided policy_hash",
              {
                code: "policy_not_found",
              },
            );
          }
          throw error;
        }

        const response: ApiResponse<PolicyEvalResponse> = {
          v: 1,
          kind: "policy.eval",
          data: { ok: true, decision },
          error: null,
        };
        return NextResponse.json(response, { status: 200 });
      }

      const result = runPolicyTests(ctx.tenant_id, body.policy_hash);
      const response: ApiResponse<PolicyTestResponse> = {
        v: 1,
        kind: "policy.test",
        data: {
          ok: true,
          tests_run: result.tests_run,
          tests_passed: result.tests_passed,
          tests_failed: result.tests_failed,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: "policies.mutate",
      idempotency: { required: true },
    },
  );
}
