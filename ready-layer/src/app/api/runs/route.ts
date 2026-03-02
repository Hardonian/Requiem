import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/runs - List all execution runs
 * 
 * Returns a paginated list of runs with metadata.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  
  try {
    // TODO: Query runs from database
    const runs: Array<{
      id: string;
      plan_id: string;
      status: string;
      started_at: string;
      completed_at?: string;
      error?: string;
    }> = [];
    
    return NextResponse.json({
      ok: true,
      data: runs,
      total: 0,
      limit,
      offset,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch runs', code: 'RUNS_FETCH_ERROR' },
      { status: 500 }
    );
  }
}
