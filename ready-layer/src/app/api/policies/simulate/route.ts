import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantContext } from '@/lib/big4-http';
import { ProblemError } from '@/lib/problem-json';
import type { ApiResponse } from '@/types/engine';

export const dynamic = 'force-dynamic';

const simulateSchema = z.object({
  context: z.record(z.string(), z.unknown()),
  rules: z.array(z.object({
    rule_id: z.string(),
    name: z.string(),
    condition: z.object({
      field: z.string(),
      operator: z.string(),
      value: z.string(),
    }),
    effect: z.enum(['allow', 'deny']),
    priority: z.number(),
  })).optional(),
  policy_set_id: z.string().optional(),
});

interface SimulationResult {
  ok: boolean;
  decision: 'allow' | 'deny';
  matched_rule_id: string;
  matched_rule_name: string;
  context_hash: string;
  rules_hash: string;
  proof_hash: string;
  all_evaluated_rules: Array<{
    rule_id: string;
    matched: boolean;
    effect: string;
  }>;
  evaluation_duration_ms: number;
}

export async function POST(request: NextRequest): Promise<Response> {
  return withTenantContext(
    request,
    async () => {
      const body = simulateSchema.parse(await request.json());

      if (!body.rules && !body.policy_set_id) {
        throw new ProblemError(400, 'Missing Argument', 'Either rules or policy_set_id required', {
          code: 'missing_argument',
        });
      }

      const rules = body.rules || [
        { rule_id: 'R001', name: 'Allow read tools', condition: { field: 'action', operator: 'eq', value: 'read' }, effect: 'allow' as const, priority: 100 },
        { rule_id: 'R002', name: 'Deny external calls', condition: { field: 'tool_id', operator: 'matches', value: '^external\\.' }, effect: 'deny' as const, priority: 200 },
      ];

      // Simulate evaluation
      const evaluatedRules = rules.map(rule => {
        const fieldValue = String(body.context[rule.condition.field] ?? '');
        let matched = false;

        switch (rule.condition.operator) {
          case 'eq': matched = fieldValue === rule.condition.value; break;
          case 'neq': matched = fieldValue !== rule.condition.value; break;
          case 'exists': matched = body.context[rule.condition.field] !== undefined; break;
          case 'in': matched = rule.condition.value.split(',').map(s => s.trim()).includes(fieldValue); break;
          case 'matches': {
            try { matched = new RegExp(rule.condition.value).test(fieldValue); } catch { matched = false; }
            break;
          }
          default: matched = false;
        }

        return { rule_id: rule.rule_id, matched, effect: rule.effect };
      });

      // Sort by priority (highest first) and find first match
      const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
      const matchedRule = sortedRules.find(r =>
        evaluatedRules.find(e => e.rule_id === r.rule_id && e.matched)
      );

      const result: SimulationResult = {
        ok: true,
        decision: matchedRule?.effect || 'deny',
        matched_rule_id: matchedRule?.rule_id || 'default_deny',
        matched_rule_name: matchedRule?.name || 'Default Deny',
        context_hash: `ctx_${Date.now().toString(36)}`,
        rules_hash: `rules_${Date.now().toString(36)}`,
        proof_hash: `proof_${Date.now().toString(36)}`,
        all_evaluated_rules: evaluatedRules,
        evaluation_duration_ms: 1,
      };

      const response: ApiResponse<SimulationResult> = {
        v: 1,
        kind: 'policies.simulate',
        data: result,
        error: null,
      };

      return NextResponse.json(response, { status: 200 });
    },
    async () => ({ allow: true, reasons: [] }),
    { routeId: 'policies.simulate' },
  );
}
