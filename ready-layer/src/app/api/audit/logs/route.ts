import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import { fetchAuditLogs } from '@/lib/engine-client';
import type { AuditLogEntry } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  return withTenantContext(
    req,
    async (ctx) => {
      const query = parseQueryWithSchema(req, querySchema);
      const limit = query.limit ?? 50;

      try {
        const entries = await fetchAuditLogs(
          { tenant_id: ctx.tenant_id, auth_token: ctx.auth_token },
          limit,
        );
        return NextResponse.json(
          {
            ok: true,
            count: entries.length,
            entries: entries satisfies AuditLogEntry[],
          },
          { status: 200 },
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'unknown error';
        throw new ProblemError(502, 'Audit Log Unavailable', msg, { code: 'audit_log_unavailable' });
      }
    },
    async () => ({ allow: true, reasons: [] }),
    {
      routeId: 'audit.logs',
      cache: { ttlMs: 5000, visibility: 'private', staleWhileRevalidateMs: 5000 },
    },
  );
}
