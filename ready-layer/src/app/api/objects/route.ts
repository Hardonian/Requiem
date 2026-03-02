// ready-layer/src/app/api/objects/route.ts
//
// Phase B: CAS Objects API — /api/objects
// List and manage content-addressable storage objects.

import { NextResponse } from 'next/server';
import type { CasObject, PaginatedResponse, TypedError, ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

// Generate trace_id for correlation
function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Create typed error envelope
function createError(code: string, message: string, retryable = false): TypedError {
  return { code, message, details: {}, retryable };
}

export async function GET(request: Request): Promise<NextResponse> {
  const trace_id = generateTraceId();
  
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Replace with actual CLI call
    // For now, return mock data with proper envelope structure
    const mockObjects: CasObject[] = [];
    
    // Generate some mock objects for demonstration
    for (let i = 0; i < Math.min(limit, 20); i++) {
      const digest = `${prefix}abcdef${i.toString(16).padStart(58, '0')}`.slice(0, 64);
      mockObjects.push({
        digest,
        encoding: i % 3 === 0 ? 'zstd' : 'identity',
        original_size: 1024 * (i + 1),
        stored_size: i % 3 === 0 ? 512 * (i + 1) : 1024 * (i + 1),
        created_at_unix_ms: Date.now() - (i * 3600000),
      });
    }

    const paginatedData: PaginatedResponse<CasObject> = {
      ok: true,
      data: mockObjects,
      total: 100, // Mock total count
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
      has_more: offset + mockObjects.length < 100,
      trace_id,
    };

    const response: ApiResponse<PaginatedResponse<CasObject>> = {
      v: 1,
      kind: 'cas.objects.list',
      data: paginatedData,
      error: null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorResponse: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError(
        'internal_error',
        error instanceof Error ? error.message : 'Unknown error occurred',
        false
      ),
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// HEAD - Check object existence
export async function HEAD(request: Request): Promise<NextResponse> {
  const trace_id = generateTraceId();
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');

  if (!hash) {
    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('missing_hash', 'hash required', false),
    };
    return NextResponse.json(response, { status: 400 });
  }

  // TODO: Replace with actual CLI call
  const response: ApiResponse<{ exists: boolean }> = {
    v: 1,
    kind: 'cas.object.head',
    data: { exists: true },
    error: null,
  };

  return NextResponse.json(response, { status: 200 });
}
