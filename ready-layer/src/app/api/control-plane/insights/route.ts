import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import {
  computeReviewFixReadiness,
  diagnoseFailure,
  generateActionableInsights,
  type ConfigurationHierarchy,
  type RunFailureSample,
} from '@/lib/control-plane';

export const dynamic = 'force-dynamic';

function fromBool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseFailures(value: string | null): RunFailureSample[] {
  if (!value) return [];

  const parsed: RunFailureSample[] = [];
  for (const entry of value.split('|')) {
    const [run_id, message] = entry.split(':', 2);
    if (!run_id || !message) continue;
    parsed.push({ run_id, message, scope: 'run' });
  }

  return parsed;
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      const params = request.nextUrl.searchParams;
      const failures = parseFailures(params.get('failures'));
      const hierarchy: ConfigurationHierarchy = {
        org: {
          provider_enabled: fromBool(params.get('org_provider_enabled')),
          provider_name: params.get('org_provider_name') ?? undefined,
          api_key_present: fromBool(params.get('org_api_key_present')),
          review_model: params.get('org_review_model') ?? undefined,
          fixer_model: params.get('org_fixer_model') ?? undefined,
          allow_inheritance: fromBool(params.get('org_allow_inheritance')),
          permissions: params.get('org_permissions')?.split(',').filter(Boolean),
          repo_bound: fromBool(params.get('org_repo_bound')),
        },
        workspace: {
          provider_enabled: fromBool(params.get('workspace_provider_enabled')),
          provider_name: params.get('workspace_provider_name') ?? undefined,
          api_key_present: fromBool(params.get('workspace_api_key_present')),
          review_model: params.get('workspace_review_model') ?? undefined,
          fixer_model: params.get('workspace_fixer_model') ?? undefined,
          allow_inheritance: fromBool(params.get('workspace_allow_inheritance')),
          permissions: params.get('workspace_permissions')?.split(',').filter(Boolean),
          repo_bound: fromBool(params.get('workspace_repo_bound')),
        },
        project: {
          provider_enabled: fromBool(params.get('project_provider_enabled')),
          provider_name: params.get('project_provider_name') ?? undefined,
          api_key_present: fromBool(params.get('project_api_key_present')),
          review_model: params.get('project_review_model') ?? undefined,
          fixer_model: params.get('project_fixer_model') ?? undefined,
          allow_inheritance: fromBool(params.get('project_allow_inheritance')),
          permissions: params.get('project_permissions')?.split(',').filter(Boolean),
          repo_bound: fromBool(params.get('project_repo_bound')),
        },
      };

      if (params.get('strict') === 'true' && failures.length === 0) {
        throw new ProblemError(400, 'Missing Failure Samples', 'strict=true requires at least one failure sample', {
          code: 'failure_samples_required',
        });
      }

      const readiness = computeReviewFixReadiness(hierarchy);
      const failure_diagnoses = failures.map((failure) => ({
        run_id: failure.run_id,
        diagnosis: diagnoseFailure(failure.message),
      }));
      const insights = generateActionableInsights(failures, readiness);

      return NextResponse.json(
        {
          v: 1,
          ok: true,
          data: {
            tenant_id: ctx.tenant_id,
            readiness,
            failure_diagnoses,
            insights,
          },
          trace_id: ctx.trace_id,
        },
        { status: 200 },
      );
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'control-plane.insights',
      cache: { ttlMs: 15000, visibility: 'private' },
    },
  );
}
