/**
 * API Route: /api/runs/[runId]/diff
 *
 * Returns diff data between two runs
 * Tenant-scoped, redacted by default
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateTenantAuth } from '@/lib/auth';

// Mock diff computation - in production this would use the engine
function computeDiff(runA: string, runB: string) {
  return {
    runA,
    runB,
    deterministic: runA === runB,
    inputChanged: false,
    outputChanged: runA !== runB,
    firstDivergenceStep: runA === runB ? null : 0,
    diffDigest: `diff_${runA.substring(0, 8)}_${runB.substring(0, 8)}`,
    topDeltas: runA === runB ? [] : [
      { type: 'output', severity: 'high', summary: 'Output fingerprint differs' }
    ],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const { searchParams } = new URL(request.url);
    const withRunId = searchParams.get('with');

    if (!withRunId) {
      return NextResponse.json(
        { error: 'Missing required parameter: with' },
        { status: 400 }
      );
    }

    // Verify tenant scope from Authorization header
    const auth = await validateTenantAuth(request);
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error ?? 'Unauthorized' },
        { status: auth.status ?? 401 }
      );
    }

    const diff = computeDiff(runId, withRunId);

    return NextResponse.json({
      success: true,
      data: diff,
      redacted: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to compute diff', message: (error as Error).message },
      { status: 500 }
    );
  }
}
