// ready-layer/src/app/api/caps/route.ts
//
// Phase B: Capabilities API — /api/caps
// Mint, inspect, list, and revoke capability tokens.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Capability {
  fingerprint: string;
  subject: string;
  scopes: string[];
  not_before: number;
  not_after: number;
}

interface CapsResponse {
  ok: boolean;
  data?: Capability[];
  fingerprint?: string;
  error?: { code: string; message: string; retryable: boolean };
  trace_id: string;
}

// GET - List capabilities
export async function GET(_request: Request): Promise<NextResponse<CapsResponse>> {
  // const { searchParams } = new URL(_request.url);

  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  // TODO: Replace with actual CLI call
  const response: CapsResponse = {
    ok: true,
    data: [],
    trace_id,
  };

  return NextResponse.json(response, { status: 200 });
}

// POST - Mint capability
export async function POST(request: Request): Promise<NextResponse<CapsResponse>> {
  const trace_id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await request.json();
    const { subject, scopes } = body;

    if (!subject || !scopes || !Array.isArray(scopes)) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: 'invalid_request', message: 'subject and scopes required', retryable: false },
          trace_id,
        },
        { status: 400 }
      );
    }

    // TODO: Replace with actual CLI call - mint capability
    // Note: Never return the full token, only fingerprint
    const response: CapsResponse = {
      ok: true,
      fingerprint: 'cap:abc123...',
      trace_id,
    };

    return NextResponse.json(response, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'parse_error', message: 'Invalid JSON', retryable: false }, trace_id },
      { status: 400 }
    );
  }
}
