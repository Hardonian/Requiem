/**
 * @fileoverview Core types for the Requiem Skills system.
 */

import { z } from 'zod';
import { InvocationContext } from '../policy/gate';

// #region: Step Definitions

/** A single step in a skill's execution flow. */
export const SkillStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tool'),
    /** The name of the tool to call. */
    toolName: z.string(),
    /** The input to the tool. Can be a static value or a reference to a previous step's output. */
    input: z.any(),
  }),
  z.object({
    kind: z.literal('llm'),
    /** The prompt to send to the language model. */
    prompt: z.string(),
    /** The model to use. If not provided, the arbitrator will choose. */
    model: z.string().optional(),
  }),
  z.object({
    kind: z.literal('assert'),
    /** A condition to check. If it fails, the skill fails. */
    condition: z.string(), // For now, a simple string. Could be a predicate function.
  }),
]);
export type SkillStep = z.infer<typeof SkillStepSchema>;

// #endregion: Step Definitions


// #region: Skill Definition

/**
 * A formal definition of a Skill, which is a versioned, testable workflow.
 */
export const SkillDefinitionSchema = z.object({
  /** The unique name of the skill. */
  name: z.string().min(1),
  /** The semantic version of the skill. */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  /** A clear description of what the skill accomplishes. */
  description: z.string().min(1),
  /** The tools required by this skill, with version constraints (not yet enforced). */
  requiredTools: z.array(z.string()).default([]),
  /**
   * A function that runs before the skill starts to ensure the system is in the correct state.
   * @param ctx The invocation context.
   * @returns A boolean indicating if the precondition is met.
   */
  precondition: z.function().args(z.any()).returns(z.promise(z.boolean())).optional(),
  /**
   * A function that runs after the skill completes successfully to validate the final state.
   * @param ctx The invocation context.
   * @param result The result of the skill's execution.
   * @returns A boolean indicating if the postcondition is met.
   */
  postcondition: z.function().args(z.any(), z.any()).returns(z.promise(z.boolean())).optional(),
  /** The sequence of steps that make up the skill. */
  steps: z.array(SkillStepSchema),
  /** A structured definition of how to evaluate the skill's output. (For Phase 8) */
  evalCriteria: z.any().optional(),
  /** A strategy for rolling back side effects if the skill fails. (Not yet implemented) */
  rollback: z.any().optional(),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// #endregion: Skill Definition
