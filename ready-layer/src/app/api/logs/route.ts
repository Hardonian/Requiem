// ready-layer/src/app/api/logs/route.ts
//
// Phase B: Event Logs API — /api/logs
// Returns event log entries with pagination and search.

import { NextResponse } from 'next/server';
import type { EventLogEntry, PaginatedResponse, TypedError } from '@/types/engine';

export const dynamic = 'force-dynamic';

// Generate trace_id for correlation
function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Create typed error envelope
function createError(code: string, message: string, retryable = false): TypedError {
  return { code, message, details: {}, retryable };
}

// Create API response envelope
function createResponse<T>(data: T, trace_id: string) {
  return {
    v: 1,
    kind: 'logs.list',
    data,
    error: null,
    trace_id,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const trace_id = generateTraceId();
  
  try {
    const { searchParams } = new URL(request.url);
    const from = parseInt(searchParams.get('from') || '0', 10);
    const to = parseInt(searchParams.get('to') || '999999999', 10);
    const q = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Replace with actual engine call when CLI is available
    // For now, return mock data with proper envelope structure
    const mockEvents: EventLogEntry[] = [];
    
    // Generate some mock events for demonstration
    for (let i = 0; i < Math.min(limit, 10); i++) {
      const seq = from + offset + i;
      if (seq > to) break;
      
      mockEvents.push({
        seq,
        prev: seq === 1 ? '0000000000000000000000000000000000000000000000000000000000000000' : `hash_${seq - 1}`,
        ts_logical: seq,
        event_type: i % 3 === 0 ? 'exec.complete' : i % 3 === 1 ? 'cap.mint' : 'plan.run.complete',
        actor: 'system',
        data_hash: `data_hash_${seq}`,
        execution_id: `exec_${seq}`,
        tenant_id: 'default',
        request_digest: `req_digest_${seq}`,
        result_digest: `res_digest_${seq}`,
        engine_semver: '1.0.0',
        engine_abi_version: 2,
        hash_algorithm_version: 1,
        cas_format_version: 2,
        replay_verified: true,
        ok: true,
        error_code: '',
        duration_ns: 1000000 + (i * 100000),
        worker_id: 'w-001',
        node_id: 'n-001',
      });
    }

    const response = createResponse({
      ok: true,
      data: mockEvents,
      total: mockEvents.length,
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      has_more: mockEvents.length === limit,
      trace_id,
    }, trace_id);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorResponse = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError(
        'internal_error',
        error instanceof Error ? error.message : 'Unknown error occurred',
        false
      ),
      trace_id,
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
