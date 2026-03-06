import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
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
}

interface AgentsResponse {
  ok: boolean;
  agents: AgentInfo[];
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const agents: AgentInfo[] = [
        {
          agent_id: 'openai-gpt4',
          adapter_type: 'openai',
          capabilities: [
            { name: 'code_review', description: 'Review code for bugs and improvements' },
            { name: 'code_generation', description: 'Generate code from specifications' },
          ],
          health: { ok: true },
          last_invocation: new Date(Date.now() - 300000).toISOString(),
          total_invocations: 142,
        },
        {
          agent_id: 'cli-linter',
          adapter_type: 'cli',
          capabilities: [
            { name: 'eslint', description: 'Run ESLint on TypeScript/JavaScript files' },
          ],
          health: { ok: true },
          last_invocation: new Date(Date.now() - 600000).toISOString(),
          total_invocations: 89,
        },
        {
          agent_id: 'custom-test-runner',
          adapter_type: 'custom',
          capabilities: [
            { name: 'run_tests', description: 'Execute test suite and report results' },
            { name: 'generate_fixtures', description: 'Generate test fixtures from schemas' },
          ],
          health: { ok: true },
          last_invocation: new Date(Date.now() - 120000).toISOString(),
          total_invocations: 256,
        },
      ];

      const response: ApiResponse<AgentsResponse> = {
        v: 1,
        kind: 'agents.list',
        data: { ok: true, agents },
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'agents.list' },
  );
}
