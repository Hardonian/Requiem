import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext, parseQueryWithSchema } from '@/lib/big4-http';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  artifact_id: z.string().optional(),
  run_id: z.string().optional(),
  depth: z.coerce.number().int().positive().max(50).optional(),
});

interface TrustNode {
  id: string;
  type: 'run' | 'artifact' | 'policy' | 'tool' | 'agent' | 'proof';
  label: string;
  hash: string;
  created_at: string;
}

interface TrustEdge {
  id: string;
  source: string;
  target: string;
  type: 'generated_by' | 'verified_by' | 'evaluated_by' | 'derived_from' | 'input_to' | 'output_of' | 'governed_by' | 'executed_by';
}

interface TrustGraphResponse {
  ok: boolean;
  nodes: TrustNode[];
  edges: TrustEdge[];
  provenance_chain?: {
    artifact_id: string;
    root_run_id: string;
    total_depth: number;
  };
  stats: {
    total_nodes: number;
    total_edges: number;
    max_depth: number;
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const query = parseQueryWithSchema(request, querySchema);

      const nodes: TrustNode[] = [
        { id: 'run_001', type: 'run', label: 'Run #001', hash: 'a'.repeat(64), created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 'run_002', type: 'run', label: 'Run #002', hash: 'b'.repeat(64), created_at: new Date(Date.now() - 1800000).toISOString() },
        { id: 'art_001', type: 'artifact', label: 'output.json', hash: 'c'.repeat(64), created_at: new Date(Date.now() - 3500000).toISOString() },
        { id: 'art_002', type: 'artifact', label: 'report.md', hash: 'd'.repeat(64), created_at: new Date(Date.now() - 1700000).toISOString() },
        { id: 'pol_001', type: 'policy', label: 'Default Policy v3', hash: 'e'.repeat(64), created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 'tool_web_fetch', type: 'tool', label: 'web.fetch', hash: 'f'.repeat(64), created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 'tool_file_write', type: 'tool', label: 'file.write', hash: '1'.repeat(64), created_at: new Date(Date.now() - 86400000).toISOString() },
        { id: 'proof_001', type: 'proof', label: 'Proof Bundle #001', hash: '2'.repeat(64), created_at: new Date(Date.now() - 3400000).toISOString() },
      ];

      const edges: TrustEdge[] = [
        { id: 'e1', source: 'run_001', target: 'art_001', type: 'generated_by' },
        { id: 'e2', source: 'art_001', target: 'run_002', type: 'input_to' },
        { id: 'e3', source: 'run_002', target: 'art_002', type: 'generated_by' },
        { id: 'e4', source: 'run_001', target: 'pol_001', type: 'governed_by' },
        { id: 'e5', source: 'run_002', target: 'pol_001', type: 'governed_by' },
        { id: 'e6', source: 'run_001', target: 'tool_web_fetch', type: 'executed_by' },
        { id: 'e7', source: 'run_002', target: 'tool_file_write', type: 'executed_by' },
        { id: 'e8', source: 'proof_001', target: 'run_001', type: 'verified_by' },
        { id: 'e9', source: 'art_002', target: 'art_001', type: 'derived_from' },
      ];

      const result: TrustGraphResponse = {
        ok: true,
        nodes,
        edges,
        stats: {
          total_nodes: nodes.length,
          total_edges: edges.length,
          max_depth: 3,
        },
      };

      if (query.artifact_id) {
        result.provenance_chain = {
          artifact_id: query.artifact_id,
          root_run_id: 'run_001',
          total_depth: 2,
        };
      }

      const response: ApiResponse<TrustGraphResponse> = {
        v: 1,
        kind: 'trust-graph',
        data: result,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'trust-graph' },
  );
}
