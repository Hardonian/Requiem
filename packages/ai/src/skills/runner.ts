/**
 * @fileoverview A runner for executing AI Skills.
 */

import { SkillDefinition, SkillStep } from './types';
import { InvocationContext, invokeToolWithPolicy } from '../policy/gate';

/**
 * The result of a single step's execution.
 */
export interface StepResult {
  step: SkillStep;
  output: any;
  error?: string;
  isSuccess: boolean;
}

/**
 * The final result of a skill's execution.
 */
export interface SkillResult {
  skill: SkillDefinition;
  trace: StepResult[];
  finalOutput: any;
  isSuccess: boolean;
  error?: string;
}

/**
 * Executes a skill's steps sequentially.
 *
 * @param ctx The invocation context.
 * @param skill The skill definition to execute.
 * @param initialInput The initial input to the skill, available to all steps.
 * @returns The final result of the skill execution.
 */
export async function runSkill(
  ctx: InvocationContext,
  skill: SkillDefinition,
  initialInput: any
): Promise<SkillResult> {
  const trace: StepResult[] = [];
  let stepOutputs: Record<string, any> = { initial: initialInput };

  // 1. Check precondition
  if (skill.precondition && !(await skill.precondition(ctx))) {
    const error = 'Skill precondition failed.';
    return { skill, trace, finalOutput: null, isSuccess: false, error };
  }

  // 2. Execute steps
  for (const step of skill.steps) {
    let result: StepResult;
    try {
      const output = await executeStep(ctx, step, stepOutputs);
      result = { step, output, isSuccess: true };
      stepOutputs[step.kind === 'tool' ? step.toolName : step.kind] = output;
    } catch (error: any) {
      result = { step, output: null, error: error.message, isSuccess: false };
      trace.push(result);
      return { skill, trace, finalOutput: null, isSuccess: false, error: error.message };
    }
    trace.push(result);
  }

  const finalOutput = trace.length > 0 ? trace[trace.length - 1].output : null;

  // 3. Check postcondition
  if (skill.postcondition && !(await skill.postcondition(ctx, finalOutput))) {
    const error = 'Skill postcondition failed.';
    return { skill, trace, finalOutput, isSuccess: false, error };
  }

  return { skill, trace, finalOutput, isSuccess: true };
}

/**
 * Executes a single skill step.
 */
async function executeStep(
  ctx: InvocationContext,
  step: SkillStep,
  stepOutputs: Record<string, any>
): Promise<any> {
  // Simple input templating: replace {{stepName.outputKey}}
  const resolveInput = (input: any): any => {
    if (typeof input === 'string') {
        const match = input.match(/{{(.*?)}}/);
        if (match) {
            const parts = match[1].split('.');
            const stepName = parts.shift();
            if (stepName && stepOutputs[stepName]) {
                return parts.reduce((acc, key) => acc?.[key], stepOutputs[stepName]);
            }
        }
    }
    if (typeof input === 'object' && input !== null) {
        for (const key in input) {
            input[key] = resolveInput(input[key]);
        }
    }
    return input;
  };
  
  const resolvedInput = resolveInput(step.input);


  switch (step.kind) {
    case 'tool':
      return await invokeToolWithPolicy(ctx, step.toolName, resolvedInput);
    case 'llm':
      // Placeholder for LLM call (Phase 6)
      console.log(`[LLM Step] Prompt: ${step.prompt}`);
      return { response: `Mock LLM response for: ${step.prompt}` };
    case 'assert':
      // Placeholder for assertion
      console.log(`[Assert Step] Condition: ${step.condition}`);
      if (!resolvedInput) { // Simplified assertion
        throw new Error(`Assertion failed: ${step.condition}`);
      }
      return { success: true };
    default:
      throw new Error(`Unknown skill step kind`);
  }
}
