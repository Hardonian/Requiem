// ready-layer/src/app/api/policies/route.ts
//
// Phase B: Policies API — /api/policies
// Policy rule management and evaluation.

import { NextResponse } from 'next/server';
import type { 
  PolicyDecision,
  PolicyAddResponse,
  PolicyListItem,
  PolicyEvalResponse,
  PolicyVersionsResponse,
  PolicyTestResponse,
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

// GET - List policies or show versions
export async function GET(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId();
  
  try {
    const { searchParams } = new URL(request.url);
    const policy_id = searchParams.get('policy');
    const versions = searchParams.get('versions') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // If policy ID provided with versions flag, show versions
    if (policy_id && versions) {
      const response: ApiResponse<PolicyVersionsResponse> = {
        v: 1,
        kind: 'policy.versions',
        data: {
          ok: true,
          policy_id,
          versions: ['v1', 'v2', 'v3'], // Mock versions
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // Otherwise list policies
    const mockPolicies: PolicyListItem[] = [];
    
    for (let i = 0; i < Math.min(limit, 15); i++) {
      mockPolicies.push({
        hash: `policy_${(offset + i).toString(16).padStart(62, '0')}`,
        size: 1024 + (i * 100),
        created_at_unix_ms: Date.now() - (i * 86400000),
      });
    }

    const response: ApiResponse<PaginatedResponse<PolicyListItem>> = {
      v: 1,
      kind: 'policies.list',
      data: {
        ok: true,
        data: mockPolicies,
        total: 50,
        page: Math.floor(offset / limit) + 1,
        page_size: limit,
        has_more: offset + mockPolicies.length < 50,
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

// POST - Add, eval, or test policies
export async function POST(request: Request): Promise<NextResponse> {
  const traceId = generateTraceId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'add') {
      const { rules } = body;
      
      if (!rules || !Array.isArray(rules)) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'rules array required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const response: ApiResponse<PolicyAddResponse> = {
        v: 1,
        kind: 'policy.add',
        data: {
          ok: true,
          policy_hash: `pol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          size: JSON.stringify(rules).length,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (action === 'eval') {
      const { policy_hash, context } = body;
      
      if (!policy_hash || !context) {
        const response: ApiResponse<null> = {
          v: 1,
          kind: 'error',
          data: null,
          error: createError('missing_argument', 'policy_hash and context required', false),
        };
        return NextResponse.json(response, { status: 400 });
      }

      // TODO: Replace with actual CLI call
      const decision: PolicyDecision = {
        decision: 'allow',
        matched_rule_id: 'R001',
        context_hash: `ctx_${Date.now().toString(36)}`,
        rules_hash: policy_hash,
        proof_hash: `proof_${Date.now().toString(36)}`,
        evaluated_at_logical_time: Date.now(),
      };

      const response: ApiResponse<PolicyEvalResponse> = {
        v: 1,
        kind: 'policy.eval',
        data: { ok: true, decision },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    if (action === 'test') {
      const { policy_hash } = body; // eslint-disable-line @typescript-eslint/no-unused-vars
      
      // TODO: Replace with actual CLI call
      const response: ApiResponse<PolicyTestResponse> = {
        v: 1,
        kind: 'policy.test',
        data: {
          ok: true,
          tests_run: 10,
          tests_passed: 10,
          tests_failed: 0,
        },
        error: null,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ApiResponse<null> = {
      v: 1,
      kind: 'error',
      data: null,
      error: createError('invalid_action', 'Action must be "add", "eval", or "test"', false),
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
