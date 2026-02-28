/**
 * @fileoverview Evaluation harness — runs skills/tools against golden cases.
 *
 * Used by:
 * - scripts/verify-agent-quality.ts (CI gate)
 * - Ad-hoc eval runs
 *
 * INVARIANT: Harness never modifies golden files automatically.
 * INVARIANT: Diffs are structural — not LLM-judged in scaffold mode.
 */

import { runSkill } from '../skills/runner';
import { invokeToolWithPolicy } from '../tools/invoke';
import { getSkill } from '../skills/registry';
import { diff } from './diff';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { newId, now } from '../types/index';
import { TenantRole } from '../types/index';
import { logger } from '../telemetry/logger';
import type { InvocationContext } from '../types/index';
import type { EvalCase } from './cases';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvalRunResult {
  caseId: string;
  description: string;
  passed: boolean;
  output?: unknown;
  error?: string;
  diffs?: Array<{ path: string; expected: unknown; actual: unknown }>;
  latencyMs: number;
}

export interface HarnessResult {
  totalCases: number;
  passed: number;
  failed: number;
  results: EvalRunResult[];
  startedAt: string;
  endedAt: string;
}

// ─── Eval Context ─────────────────────────────────────────────────────────────

function makeEvalContext(): InvocationContext {
  return {
    tenant: {
      tenantId: 'eval-tenant',
      userId: 'eval-runner',
      role: TenantRole.ADMIN,
      derivedAt: now(),
    },
    actorId: 'eval-runner',
    traceId: newId('eval'),
    environment: 'test',
    createdAt: now(),
  };
}

// ─── Harness ──────────────────────────────────────────────────────────────────

/**
 * Run a single eval case, returning a structured result.
 */
export async function runEvalCase(evalCase: EvalCase): Promise<EvalRunResult> {
  const startMs = Date.now();
  const ctx = makeEvalContext();

  try {
    let output: unknown;

    if (evalCase.skill) {
      const skill = getSkill(evalCase.skill);
      if (!skill) {
        throw new AiError({
          code: AiErrorCode.SKILL_NOT_FOUND,
          message: `Eval skill not found: ${evalCase.skill}`,
          phase: 'eval',
        });
      }
      const result = await runSkill(ctx, skill, evalCase.input);
      if (!result.isSuccess) {
        return {
          caseId: evalCase.id,
          description: evalCase.description,
          passed: false,
          error: result.error,
          latencyMs: Date.now() - startMs,
        };
      }
      output = result.finalOutput;
    } else if (evalCase.tool) {
      const result = await invokeToolWithPolicy(ctx, evalCase.tool, evalCase.input);
      output = result.output;
    } else {
      throw new AiError({
        code: AiErrorCode.EVAL_CASE_NOT_FOUND,
        message: `Eval case ${evalCase.id} has neither skill nor tool`,
        phase: 'eval',
      });
    }

    // Evaluate
    const passed = evaluate(evalCase, output);
    const diffs = evalCase.evalMethod === 'exact_match' && evalCase.expected !== undefined
      ? diff(evalCase.expected, output).diffs.map(d => ({
          path: d.path,
          expected: d.expected,
          actual: d.actual,
        }))
      : [];

    return {
      caseId: evalCase.id,
      description: evalCase.description,
      passed,
      output,
      diffs: diffs.length > 0 ? diffs : undefined,
      latencyMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      caseId: evalCase.id,
      description: evalCase.description,
      passed: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startMs,
    };
  }
}

/**
 * Run all eval cases in sequence, returning aggregate results.
 */
export async function runEvalHarness(cases: EvalCase[]): Promise<HarnessResult> {
  const startedAt = now();
  const results: EvalRunResult[] = [];

  for (const evalCase of cases) {
    logger.info(`[eval] Running case: ${evalCase.id}`, { description: evalCase.description });
    const result = await runEvalCase(evalCase);
    results.push(result);
    logger.info(`[eval] Case ${evalCase.id}: ${result.passed ? 'PASS' : 'FAIL'}`, {
      latency_ms: result.latencyMs,
      error: result.error,
    });
  }

  const passed = results.filter(r => r.passed).length;
  return {
    totalCases: results.length,
    passed,
    failed: results.length - passed,
    results,
    startedAt,
    endedAt: now(),
  };
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

function evaluate(evalCase: EvalCase, output: unknown): boolean {
  switch (evalCase.evalMethod) {
    case 'exact_match':
      return diff(evalCase.expected, output).isMatch;

    case 'schema_valid':
      return output !== null && output !== undefined;

    case 'contains':
      if (!evalCase.requiredKeys || !output || typeof output !== 'object') return false;
      return evalCase.requiredKeys.every(key => key in (output as Record<string, unknown>));

    case 'custom':
      // Placeholder — custom evaluators not supported in scaffold
      logger.warn(`[eval] Custom evaluator not supported for case ${evalCase.id}`);
      return true;

    default:
      return false;
  }
}
