import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

interface FailureAnalyticsResponse {
  ok: boolean;
  total_failures: number;
  by_category: Record<string, number>;
  top_patterns: Array<{
    pattern_id: string;
    category: string;
    occurrence_count: number;
    severity: string;
    suggested_fix: {
      action: string;
      description: string;
      auto_applicable: boolean;
    };
    affected_tools: string[];
  }>;
  trend: 'improving' | 'stable' | 'degrading';
  auto_fixable_count: number;
  action_triggers: Array<{
    condition: string;
    action: string;
    triggered: boolean;
  }>;
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async (_ctx) => {
      const analytics: FailureAnalyticsResponse = {
        ok: true,
        total_failures: 47,
        by_category: {
          environment_mismatch: 12,
          tool_permission: 8,
          api_key_absent: 7,
          rate_limit: 6,
          network_failure: 5,
          timeout: 4,
          tool_schema_mismatch: 3,
          budget_exceeded: 2,
        },
        top_patterns: [
          {
            pattern_id: 'pat_a1b2c3d4e5f67890',
            category: 'api_key_absent',
            occurrence_count: 7,
            severity: 'high',
            suggested_fix: {
              action: 'set_env',
              description: 'Set missing environment variable: OPENAI_API_KEY',
              auto_applicable: false,
            },
            affected_tools: ['openai:gpt-4', 'openai:gpt-3.5-turbo'],
          },
          {
            pattern_id: 'pat_b2c3d4e5f6789012',
            category: 'rate_limit',
            occurrence_count: 6,
            severity: 'medium',
            suggested_fix: {
              action: 'retry_with_backoff',
              description: 'Retry with exponential backoff (2s, 4s, 8s, 16s)',
              auto_applicable: true,
            },
            affected_tools: ['anthropic:claude-3'],
          },
          {
            pattern_id: 'pat_c3d4e5f678901234',
            category: 'tool_permission',
            occurrence_count: 8,
            severity: 'high',
            suggested_fix: {
              action: 'update_policy',
              description: 'Update policy to grant tool access',
              auto_applicable: false,
            },
            affected_tools: ['web.fetch', 'file.write'],
          },
        ],
        trend: 'improving',
        auto_fixable_count: 11,
        action_triggers: [
          {
            condition: 'Tool failure rate > 10%',
            action: 'Suggest policy patch for web.fetch',
            triggered: true,
          },
          {
            condition: 'Rate limit errors > 5/hour',
            action: 'Enable automatic backoff',
            triggered: true,
          },
          {
            condition: 'Missing API key detected',
            action: 'Prompt environment configuration',
            triggered: true,
          },
        ],
      };

      const response: ApiResponse<FailureAnalyticsResponse> = {
        v: 1,
        kind: 'failures.analytics',
        data: analytics,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'failures.analytics' },
  );
}
