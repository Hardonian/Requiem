import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  run_id: z.string().optional(),
  compare_to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

interface ReplayStep {
  seq: number;
  step_type: string;
  tool_id?: string;
  input_hash: string;
  output_hash?: string;
  policy_decision?: string;
  duration_ms: number;
  match: boolean;
}

interface ReplayLabResponse {
  ok: boolean;
  run_id: string;
  replay_id: string;
  match: boolean;
  match_percentage: number;
  steps: ReplayStep[];
  policy_match: boolean;
  artifact_match: boolean;
  divergence_point?: number;
  divergence_reason?: string;
  diff?: {
    diff_id: string;
    run_a_id: string;
    run_b_id: string;
    overall_match_percentage: number;
    step_diffs: Array<{
      seq: number;
      status: 'identical' | 'modified' | 'added' | 'removed';
    }>;
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const query = parseQueryWithSchema(request, querySchema);
      const runId = query.run_id || 'run_demo_001';

      const steps: ReplayStep[] = [
        { seq: 0, step_type: 'policy_check', input_hash: 'a'.repeat(64), policy_decision: 'allow', duration_ms: 1, match: true },
        { seq: 1, step_type: 'tool_call', tool_id: 'web.fetch', input_hash: 'b'.repeat(64), output_hash: 'c'.repeat(64), duration_ms: 234, match: true },
        { seq: 2, step_type: 'cas_write', input_hash: 'd'.repeat(64), output_hash: 'e'.repeat(64), duration_ms: 12, match: true },
        { seq: 3, step_type: 'llm_call', tool_id: 'anthropic:claude-3', input_hash: 'f'.repeat(64), output_hash: '1'.repeat(64), duration_ms: 1523, match: true },
        { seq: 4, step_type: 'checkpoint', input_hash: '2'.repeat(64), duration_ms: 2, match: true },
      ];

      const result: ReplayLabResponse = {
        ok: true,
        run_id: runId,
        replay_id: `replay_${Date.now().toString(36)}`,
        match: true,
        match_percentage: 100,
        steps,
        policy_match: true,
        artifact_match: true,
      };

      if (query.compare_to) {
        result.diff = {
          diff_id: `diff_${Date.now().toString(36)}`,
          run_a_id: runId,
          run_b_id: query.compare_to,
          overall_match_percentage: 96.5,
          step_diffs: [
            { seq: 0, status: 'identical' },
            { seq: 1, status: 'identical' },
            { seq: 2, status: 'identical' },
            { seq: 3, status: 'modified' },
            { seq: 4, status: 'identical' },
          ],
        };
      }

      const response: ApiResponse<ReplayLabResponse> = {
        v: 1,
        kind: 'replay.lab',
        data: result,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'replay.lab' },
  );
}
