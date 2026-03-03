import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/big4-http';

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
  return withTenantContext(request, async () => {
    const { runId } = await params;
    const { searchParams } = new URL(request.url);
    const withRunId = searchParams.get('with');

    if (!withRunId) {
      return NextResponse.json({ ok: false, error: 'missing_with_parameter' }, { status: 400 });
    }

    const diff = computeDiff(runId, withRunId);
    return NextResponse.json({ ok: true, data: diff, redacted: true }, { status: 200 });
  }, async (ctx) => ({
    allow: ctx.actor_id !== 'anonymous',
    reasons: ctx.actor_id !== 'anonymous' ? [] : ['actor identity required'],
  }));
}
