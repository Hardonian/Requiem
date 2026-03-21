import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { listRunSummaries } from '@/lib/control-plane-store';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

interface AgentInfo {
  agent_id: string;
  adapter_type: string;
  capabilities: Array<{
    name: string;
    description: string;
  }>;
  health: { ok: boolean; error?: string };
  last_invocation?: string;
  total_invocations: number;
  source: 'control-plane';
}

interface AgentsResponse {
  ok: boolean;
  agents: AgentInfo[];
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (ctx) => {
      // Derive agent activity from real plan run history
      const runs = await listRunSummaries(ctx.tenant_id);

      const agent: AgentInfo = {
        agent_id: 'control-plane-executor',
        adapter_type: 'control-plane',
        capabilities: [
          { name: 'plan_execution', description: 'Execute multi-step plans with deterministic replay' },
          { name: 'durable_queue', description: 'Process durable queued plan jobs with lease-based recovery' },
        ],
        health: { ok: true },
        last_invocation: runs[0]?.created_at ?? undefined,
        total_invocations: runs.length,
        source: 'control-plane',
      };

      const response: ApiResponse<AgentsResponse> = {
        v: 1,
        kind: 'agents.list',
        data: { ok: true, agents: [agent] },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'agents.list' },
  );
}
