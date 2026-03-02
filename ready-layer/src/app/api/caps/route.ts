// ready-layer/src/app/api/caps/route.ts
//
// Phase B: Capabilities API — /api/caps
// Capability token management.

import { NextResponse } from 'next/server';
import type { 
  CapabilityToken, 
  CapabilityMintRequest, 
  CapabilityMintResponse,
  CapabilityListItem,
  CapabilityListResponse,
  CapabilityRevokeResponse,
  TypedError, 
  ApiResponse,
  PaginatedResponse 
} from '@/types/engine';

export const dynamic = 'force-dynamic';

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createError(code: string, message: string, retryable = false): TypedError {
  return { code, message, details: {}, retryable };
}

// GET - List capabilities
export async function GET(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get('tenant') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Replace with actual CLI call
    const mockCaps: CapabilityListItem[] = [];
    
    for (let i = 0; i < Math.min(limit, 10); i++) {
      mockCaps.push({
        actor: tenant || `tenant_${i % 3}`,
        seq: offset + i + 1,
        data_hash: `cap_hash_${offset + i}`,
        event_type: 'cap.mint',
      });
    }

    const response: ApiResponse<PaginatedResponse<CapabilityListItem>> = {
      v: 1,
      kind: 'caps.list',
      data: {
        ok: true,
        data: mockCaps,
        total: 100,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + mockCaps.length < 100,
        trace_id: traceId,
      },
      error: null,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('internal_error', error instanceof Error ? error.message : 'Unknown error', false),
    };
    return NextResponse.json(response, { status: 500 });
  }
}

// POST - Mint or revoke a capability
export async function POST(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'mint') {
      const { subject, permissions, not_before, not_after }: CapabilityMintRequest = body;
      
      if (!subject || !permissions || !Array.isArray(permissions)) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'subject and permissions array required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const response: ApiResponse<CapabilityMintResponse> = {
        v: 1,
        kind: 'caps.mint',
        data: {
          ok: true,
          fingerprint: `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          subject,
          scopes: permissions,
          not_before: not_before || 0,
          not_after: not_after || 0,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (action === 'revoke') {
      const { fingerprint } = body;
      
      if (!fingerprint) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'fingerprint required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const response: ApiResponse<CapabilityRevokeResponse> = {
        v: 1,
        kind: 'caps.revoke',
        data: { ok: true, fingerprint, revoked: true },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('invalid_action', 'Action must be "mint" or "revoke"', false),
    };
    return NextResponse.json(response, { status: 400 });
  } catch (error) {
    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('internal_error', error instanceof Error ? error.message : 'Unknown error', false),
    };
    return NextResponse.json(response, { status: 500 });
  }
}
