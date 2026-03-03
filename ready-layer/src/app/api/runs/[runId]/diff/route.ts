import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';

function computeDiff(runA: string, runB: string) {
  return {
    runA,
    runB,
    deterministic: runA === runB,
    inputChanged: false,
    outputChanged: runA !== runB,
    firstDivergenceStep: runA === runB ? null : 0,
    diffDigest: `diff_${runA.substring(0, 8)}_${runB.substring(0, 8)}`,
    topDeltas: runA === runB
      ? []
      : [{ type: 'output', severity: 'high', summary: 'Output fingerprint differs', taxonomy: 'STRUCTURAL_MISMATCH' }],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const { runId } = await params;
      const { searchParams } = new URL(request.url);
      const withRunId = searchParams.get('with');

      if (!withRunId) {
        throw new ProblemError(400, 'Missing Query Parameter', 'with query parameter is required', {
          code: 'missing_with_parameter',
        });
      }

      const diff = computeDiff(runId, withRunId);
      return NextResponse.json({ ok: true, data: diff, redacted: true }, { status: 200 });
    },
    async (ctx) => ({
      allow: ctx.actor_id !== 'anonymous',
      reasons: ctx.actor_id !== 'anonymous' ? [] : ['actor identity required'],
    }),
    {
      routeId: 'runs.diff',
      cache: { ttlMs: 5_000, visibility: 'private', staleWhileRevalidateMs: 5_000 },
    },
  );
}
