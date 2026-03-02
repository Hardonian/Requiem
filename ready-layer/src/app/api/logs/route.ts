// ready-layer/src/app/api/logs/route.ts
//
// Phase B: Event Logs API — /api/logs
// Returns event log entries with pagination and search.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface LogEntry {
  seq: number;
  prev: string;
  ts_logical: number;
  event_type: string;
  actor: string;
  data_hash: string;
  execution_id: string;
  tenant_id: string;
  ok: boolean;
}

interface LogsResponse {
  ok: boolean;
  data: LogEntry[];
  total: number;
  trace_id: string;
}

export async function GET(_request: Request): Promise<NextResponse<LogsResponse>> {
  // const { searchParams } = new URL(_request.url);
  // const from = searchParams.get('from') || '0';
  // const to = searchParams.get('to') || '999999999';
  // const q = searchParams.get('q') || '';
  // const limit = parseInt(searchParams.get('limit') || '100', 10);
  // const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Generate trace_id for correlation
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual engine call when CLI is available
  // For now, return empty data with proper envelope
  const response: LogsResponse = {
    ok: true,
    data: [],
    total: 0,
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}
