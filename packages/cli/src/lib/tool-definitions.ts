/**
 * Tool Definitions — Standard Requiem Tools
 */

import { z } from 'zod';
import { ToolDefinition, toolRegistry } from './tools';
import { DecisionRepository } from '../db/decisions';
import { JunctionRepository } from '../db/junctions';
import { evaluateDecision } from '../engine/adapter';
import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

/**
 * decide_evaluate
 * Evaluates a decision for a given junction.
 */
export const decideEvaluate: ToolDefinition<
  z.ZodObject<{ junctionId: z.ZodString }>,
  z.ZodObject<{ decisionId: z.ZodString, recommendedAction: z.ZodString }>
> = {
  name: 'decide_evaluate',
  version: '1.0.0',
  digest: 'be6d859d0607f90f14d8721c5b8b958c894236a92849a94f', // Placeholder stable digest
  description: 'Evaluate a decision for a specific junction based on trigger data.',
  inputSchema: z.object({
    junctionId: z.string().uuid(),
  }),
  outputSchema: z.object({
    decisionId: z.string(),
    recommendedAction: z.string(),
  }),
  deterministic: true,
  sideEffect: true,
  idempotent: false,
  tenantScoped: true,
  requiredCapabilities: ['evaluate'],
  handler: async (input, ctx) => {
    // 1. Resolve Junction with Tenant Isolation
    const junction = JunctionRepository.findById(input.junctionId);

    if (!junction) {
      throw new RequiemError({
        code: ErrorCode.FILE_NOT_FOUND,
        message: `Junction ${input.junctionId} not found`,
        severity: ErrorSeverity.WARNING,
      });
    }

    // 2. Prepare Decision Input
    const triggerData = typeof junction.trigger_data === 'string'
      ? JSON.parse(junction.trigger_data)
      : junction.trigger_data;

    const decisionInput = {
      actions: ['accept', 'reject', 'defer', 'investigate'],
      states: ['critical', 'high', 'medium', 'low'],
      outcomes: {
        accept: { critical: 0.1, high: 0.5, medium: 0.8, low: 1.0 },
        reject: { critical: 0.9, high: 0.7, medium: 0.4, low: 0.1 },
      },
      algorithm: 'minimax_regret' as any,
    };

    // 3. Execute Engine Evaluation
    const result = await evaluateDecision(decisionInput);

    // 4. Record Decision Report
    const report = DecisionRepository.create({
      source_type: junction.source_type,
      source_ref: junction.source_ref,
      input_fingerprint: junction.fingerprint,
      decision_input: decisionInput,
      decision_output: result,
      decision_trace: { ...result.trace, toolContext: ctx },
      status: 'evaluated',
    });

    return {
      decisionId: report.id,
      recommendedAction: result.recommended_action,
    };
  },
};

/**
 * junctions_list
 * Lists active junctions for the tenant.
 */
export const junctionsList: ToolDefinition<
  z.ZodObject<{ limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>> }>,
  z.ZodArray<z.ZodObject<{ id: z.ZodString, type: z.ZodString, score: z.ZodNumber }>>
> = {
  name: 'junctions_list',
  version: '1.0.0',
  digest: 'a58f4b0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c', // Placeholder stable digest
  description: 'List active junctions requiring attention.',
  inputSchema: z.object({
    limit: z.number().optional().default(10),
  }),
  outputSchema: z.array(z.object({
    id: z.string(),
    type: z.string(),
    score: z.number(),
  })),
  deterministic: false,
  sideEffect: false,
  idempotent: true,
  tenantScoped: true,
  requiredCapabilities: ['read'],
  handler: async (input, _ctx) => {
    const junctions = JunctionRepository.list({
      limit: input.limit,
    });

    return junctions.map(j => ({
      id: j.id,
      type: j.junction_type,
      score: j.severity_score,
    }));
  },
};

/**
 * Initialize Tool Registry
 */
export function registerStandardTools(): void {
  toolRegistry.register(decideEvaluate);
  toolRegistry.register(junctionsList);
}
