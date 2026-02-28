/**
 * @fileoverview Core types for the Requiem Skills system.
 *
 * A Skill is a versioned, auditable, testable workflow that composes
 * tool calls, LLM prompts, and assertions.
 *
 * INVARIANT: All tool calls within a skill MUST go through invokeToolWithPolicy.
 * INVARIANT: Skills with rollback semantics must handle partial failures.
 */

import type { InvocationContext } from '../types/index';

// ─── Skill Steps ──────────────────────────────────────────────────────────────

export interface ToolStep {
  kind: 'tool';
  toolName: string;
  input: unknown;
  /** Optional label for this step's output in the context bag */
  outputKey?: string;
}

export interface LlmStep {
  kind: 'llm';
  prompt: string;
  /** Preferred model identifier (falls back to arbitrator if absent) */
  model?: string;
  /** JSON Schema for expected output (enables structured output) */
  outputSchema?: Record<string, unknown>;
}

export interface AssertStep {
  kind: 'assert';
  /** Assertion description for error messages */
  description: string;
  /**
   * Predicate function: receives current context bag + last step output.
   * Must return true for assertion to pass.
   */
  predicate: (bag: Record<string, unknown>, lastOutput: unknown) => boolean;
}

export type SkillStep = ToolStep | LlmStep | AssertStep;

// ─── Skill Definition ─────────────────────────────────────────────────────────

export interface SkillDefinition {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  /** Tool names (optionally with @semver range) required before run */
  readonly requiredTools: readonly string[];
  /** Optional async precondition check */
  precondition?: (ctx: InvocationContext) => Promise<boolean>;
  /** Optional async postcondition validation */
  postcondition?: (ctx: InvocationContext, finalOutput: unknown) => Promise<boolean>;
  readonly steps: readonly SkillStep[];
  /**
   * Rollback function called when skill fails after side-effecting steps.
   * Receives the partial results produced so far.
   */
  rollback?: (ctx: InvocationContext, partialResults: StepResult[]) => Promise<void>;
}

// ─── Run Result ───────────────────────────────────────────────────────────────

export interface StepResult {
  readonly step: SkillStep;
  readonly output: unknown;
  readonly latencyMs: number;
  readonly isSuccess: boolean;
  readonly error?: string;
}

export interface SkillRunResult {
  readonly skillName: string;
  readonly skillVersion: string;
  readonly traceId: string;
  readonly isSuccess: boolean;
  readonly finalOutput: unknown;
  readonly steps: readonly StepResult[];
  readonly totalLatencyMs: number;
  readonly error?: string;
  readonly startedAt: string;
  readonly endedAt: string;
}
