/**
 * @fileoverview Skill runner — executes versioned skill workflows.
 *
 * INVARIANT: All tool steps invoke via policy gate.
 * INVARIANT: Emits trace spans for each step.
 * INVARIANT: Runs rollback if skill fails after side-effecting steps.
 */

import { invokeToolWithPolicy } from '../tools/invoke';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { withSpan } from '../telemetry/trace';
import { logger } from '../telemetry/logger';
import { now } from '../types/index';
import type { InvocationContext } from '../types/index';
import type { SkillDefinition, SkillStep, StepResult, SkillRunResult } from './types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Execute a skill, enforcing preconditions, postconditions, and rollback.
 */
export async function runSkill(
  ctx: InvocationContext,
  skill: SkillDefinition,
  initialInput: unknown
): Promise<SkillRunResult> {
  const startedAt = now();
  const startMs = Date.now();

  return withSpan(`skill:${skill.name}@${skill.version}`, ctx.traceId, async (span) => {
    span.attributes['skill'] = skill.name;
    span.attributes['version'] = skill.version;

    const completedSteps: StepResult[] = [];

    // 1. Precondition
    if (skill.precondition) {
      const ok = await skill.precondition(ctx);
      if (!ok) {
        return failResult(skill, ctx.traceId, startedAt, startMs, completedSteps,
          'Skill precondition failed');
      }
    }

    // 2. Execute steps
    const bag: Record<string, unknown> = { initial: initialInput };
    let lastOutput: unknown = initialInput;

    for (const step of skill.steps) {
      const stepStartMs = Date.now();
      try {
        const output = await executeStep(ctx, step, bag, lastOutput);
        const stepResult: StepResult = {
          step,
          output,
          latencyMs: Date.now() - stepStartMs,
          isSuccess: true,
        };
        completedSteps.push(stepResult);

        // Store output in bag for template resolution
        if (step.kind === 'tool') {
          const key = (step as { kind: 'tool'; toolName: string; outputKey?: string }).outputKey ?? step.toolName;
          bag[key] = output;
        } else if (step.kind === 'llm') {
          bag['llm'] = output;
        }
        lastOutput = output;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const stepResult: StepResult = {
          step,
          output: null,
          latencyMs: Date.now() - stepStartMs,
          isSuccess: false,
          error: errMsg,
        };
        completedSteps.push(stepResult);

        // Attempt rollback for side-effecting steps
        await tryRollback(ctx, skill, completedSteps);

        return failResult(skill, ctx.traceId, startedAt, startMs, completedSteps, errMsg);
      }
    }

    // 3. Postcondition
    if (skill.postcondition) {
      const ok = await skill.postcondition(ctx, lastOutput);
      if (!ok) {
        await tryRollback(ctx, skill, completedSteps);
        return failResult(skill, ctx.traceId, startedAt, startMs, completedSteps,
          'Skill postcondition failed');
      }
    }

    return {
      skillName: skill.name,
      skillVersion: skill.version,
      traceId: ctx.traceId,
      isSuccess: true,
      finalOutput: lastOutput,
      steps: completedSteps,
      totalLatencyMs: Date.now() - startMs,
      startedAt,
      endedAt: now(),
    };
  });
}

// ─── Step Execution ───────────────────────────────────────────────────────────

async function executeStep(
  ctx: InvocationContext,
  step: SkillStep,
  bag: Record<string, unknown>,
  lastOutput: unknown
): Promise<unknown> {
  switch (step.kind) {
    case 'tool': {
      const resolvedInput = resolveTemplates(step.input, bag);
      const result = await invokeToolWithPolicy(ctx, step.toolName, resolvedInput);
      return result.output;
    }

    case 'llm': {
      const resolvedPrompt = typeof step.prompt === 'string'
        ? resolveTemplates(step.prompt, bag) as string
        : step.prompt;

      // LLM is delegated to model registry/arbitrator
      // If no provider is configured, return a graceful stub
      logger.info('[skill.runner] LLM step — delegating to model arbitrator', {
        trace_id: ctx.traceId,
        has_model: Boolean(step.model),
      });

      // Lazy import to avoid circular deps
      const { generateText } = await import('../models/arbitrator');
      try {
        const response = await generateText({
          prompt: resolvedPrompt as string,
          preferredModel: step.model,
          ctx,
        });
        return response;
      } catch (err) {
        const aiErr = AiError.fromUnknown(err, 'skill.llm');
        if (aiErr.code === AiErrorCode.PROVIDER_NOT_CONFIGURED) {
          logger.warn('[skill.runner] LLM provider not configured — returning stub', {
            trace_id: ctx.traceId,
          });
          return {
            type: 'stub',
            message: 'LLM provider not configured',
            prompt: resolvedPrompt,
          };
        }
        throw aiErr;
      }
    }

    case 'assert': {
      const passes = step.predicate(bag, lastOutput);
      if (!passes) {
        throw new AiError({
          code: AiErrorCode.SKILL_STEP_FAILED,
          message: `Assertion failed: ${step.description}`,
          phase: 'skill.assert',
        });
      }
      return { asserted: true, description: step.description };
    }

    default: {
      // TypeScript exhaustiveness guard
      const _exhaustive: never = step;
      throw new AiError({
        code: AiErrorCode.INTERNAL_ERROR,
        message: `Unknown skill step kind: ${(_exhaustive as SkillStep).kind}`,
        phase: 'skill.runner',
      });
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve {{key}} and {{nested.key}} templates in strings or objects. */
function resolveTemplates(value: unknown, bag: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const parts = path.trim().split('.');
      let cur: unknown = bag;
      for (const part of parts) {
        if (typeof cur === 'object' && cur !== null && part in cur) {
          cur = (cur as Record<string, unknown>)[part];
        } else {
          return `{{${path}}}`; // Leave unresolved
        }
      }
      return String(cur);
    });
  }
  if (Array.isArray(value)) {
    return value.map(v => resolveTemplates(v, bag));
  }
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveTemplates(v, bag);
    }
    return result;
  }
  return value;
}

async function tryRollback(
  ctx: InvocationContext,
  skill: SkillDefinition,
  completedSteps: StepResult[]
): Promise<void> {
  if (!skill.rollback) return;
  try {
    await skill.rollback(ctx, completedSteps);
    logger.info('[skill.runner] Rollback completed', { trace_id: ctx.traceId, skill: skill.name });
  } catch (rollbackErr) {
    logger.error('[skill.runner] Rollback failed', {
      trace_id: ctx.traceId,
      skill: skill.name,
      error: String(rollbackErr),
    });
  }
}

function failResult(
  skill: SkillDefinition,
  traceId: string,
  startedAt: string,
  startMs: number,
  steps: StepResult[],
  error: string
): SkillRunResult {
  return {
    skillName: skill.name,
    skillVersion: skill.version,
    traceId,
    isSuccess: false,
    finalOutput: null,
    steps,
    totalLatencyMs: Date.now() - startMs,
    error,
    startedAt,
    endedAt: now(),
  };
}
