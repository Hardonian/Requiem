/**
 * Run Lifecycle State Machine
 *
 * Models the execution lifecycle as a formal state machine.
 *
 * States:
 *   INIT → POLICY_CHECKED → ARBITRATED → EXECUTED →
 *   MANIFEST_BUILT → SIGNED → LEDGER_COMMITTED → COMPLETE
 *   (any) → DIVERGENT
 *
 * INVARIANT: No state can skip a required predecessor.
 * INVARIANT: No state can regress (except to DIVERGENT).
 * INVARIANT: Transitions are validated in code.
 */

import { StateMachine } from './state-machine';
import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

// ─── Run lifecycle states ────────────────────────────────────────────────────────

export const RunLifecycleStates = {
  INIT: 'init',
  POLICY_CHECKED: 'policy_checked',
  ARBITRATED: 'arbitrated',
  EXECUTED: 'executed',
  MANIFEST_BUILT: 'manifest_built',
  SIGNED: 'signed',
  LEDGER_COMMITTED: 'ledger_committed',
  COMPLETE: 'complete',
  DIVERGENT: 'divergent',
} as const;

export type RunLifecycleState = typeof RunLifecycleStates[keyof typeof RunLifecycleStates];

/**
 * Ordered list for regression checks.
 * DIVERGENT is excluded — it is a terminal sink reachable from any non-terminal state.
 */
const STATE_ORDER: readonly RunLifecycleState[] = [
  RunLifecycleStates.INIT,
  RunLifecycleStates.POLICY_CHECKED,
  RunLifecycleStates.ARBITRATED,
  RunLifecycleStates.EXECUTED,
  RunLifecycleStates.MANIFEST_BUILT,
  RunLifecycleStates.SIGNED,
  RunLifecycleStates.LEDGER_COMMITTED,
  RunLifecycleStates.COMPLETE,
];

/**
 * Create the run lifecycle state machine.
 */
export function createRunLifecycleStateMachine(): StateMachine<RunLifecycleState> {
  return new StateMachine<RunLifecycleState>({
    entityName: 'run_lifecycle',
    initialState: RunLifecycleStates.INIT,
    states: [
      {
        name: RunLifecycleStates.INIT,
        allowedTransitions: [RunLifecycleStates.POLICY_CHECKED, RunLifecycleStates.DIVERGENT],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.POLICY_CHECKED,
        allowedTransitions: [RunLifecycleStates.ARBITRATED, RunLifecycleStates.DIVERGENT],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.ARBITRATED,
        allowedTransitions: [RunLifecycleStates.EXECUTED, RunLifecycleStates.DIVERGENT],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.EXECUTED,
        allowedTransitions: [RunLifecycleStates.MANIFEST_BUILT, RunLifecycleStates.DIVERGENT],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.MANIFEST_BUILT,
        allowedTransitions: [RunLifecycleStates.SIGNED, RunLifecycleStates.DIVERGENT],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.SIGNED,
        allowedTransitions: [RunLifecycleStates.LEDGER_COMMITTED, RunLifecycleStates.DIVERGENT],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.LEDGER_COMMITTED,
        allowedTransitions: [RunLifecycleStates.COMPLETE],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.COMPLETE,
        allowedTransitions: [],
        isTerminal: true,
        isRetryable: false,
      },
      {
        name: RunLifecycleStates.DIVERGENT,
        allowedTransitions: [],
        isTerminal: true,
        isRetryable: false,
      },
    ],
  });
}

// ─── Run lifecycle tracker ──────────────────────────────────────────────────────

/**
 * Tracks and enforces the lifecycle of a single run.
 */
export class RunLifecycleTracker {
  private machine: StateMachine<RunLifecycleState>;
  private currentState: RunLifecycleState;
  private history: Array<{ from: RunLifecycleState; to: RunLifecycleState; timestamp: string }>;
  readonly runId: string;

  constructor(runId: string) {
    this.machine = createRunLifecycleStateMachine();
    this.currentState = RunLifecycleStates.INIT;
    this.history = [];
    this.runId = runId;
  }

  /**
   * Transition to the next state. Validates:
   *   1. Transition is allowed by state machine
   *   2. No state regression (forward-only)
   *   3. No state skipping (sequential)
   */
  advance(to: RunLifecycleState): void {
    // Validate via state machine
    const validation = this.machine.validateTransition(this.currentState, to);
    if (!validation.valid) {
      throw validation.error;
    }

    // Additional monotonicity check (DIVERGENT can always be reached)
    if (to !== RunLifecycleStates.DIVERGENT) {
      const currentIdx = STATE_ORDER.indexOf(this.currentState);
      const targetIdx = STATE_ORDER.indexOf(to);

      if (targetIdx < currentIdx) {
        throw new RequiemError({
          code: ErrorCode.INVARIANT_VIOLATION,
          message: `Run lifecycle regression: cannot move from "${this.currentState}" to "${to}"`,
          severity: ErrorSeverity.CRITICAL,
          retryable: false,
          phase: 'run_lifecycle',
          meta: { context: { runId: this.runId, from: this.currentState, to } },
        });
      }

      if (targetIdx !== currentIdx + 1) {
        throw new RequiemError({
          code: ErrorCode.INVARIANT_VIOLATION,
          message: `Run lifecycle skip: cannot skip from "${this.currentState}" directly to "${to}"`,
          severity: ErrorSeverity.CRITICAL,
          retryable: false,
          phase: 'run_lifecycle',
          meta: { context: { runId: this.runId, from: this.currentState, to } },
        });
      }
    }

    this.history.push({
      from: this.currentState,
      to,
      timestamp: new Date().toISOString(),
    });
    this.currentState = to;
  }

  /**
   * Transition to DIVERGENT from any non-terminal state.
   */
  diverge(reason?: string): void {
    if (this.machine.isTerminal(this.currentState)) {
      throw new RequiemError({
        code: ErrorCode.INVARIANT_VIOLATION,
        message: `Cannot diverge from terminal state "${this.currentState}"`,
        severity: ErrorSeverity.ERROR,
        retryable: false,
        phase: 'run_lifecycle',
        meta: { context: { runId: this.runId, reason: reason ?? 'unspecified' } },
      });
    }
    this.advance(RunLifecycleStates.DIVERGENT);
  }

  /**
   * Get current state.
   */
  getState(): RunLifecycleState {
    return this.currentState;
  }

  /**
   * Get full transition history.
   */
  getHistory(): ReadonlyArray<{ from: RunLifecycleState; to: RunLifecycleState; timestamp: string }> {
    return this.history;
  }

  /**
   * Check if the run is in a terminal state.
   */
  isComplete(): boolean {
    return this.machine.isTerminal(this.currentState);
  }

  /**
   * Check if the run diverged.
   */
  isDivergent(): boolean {
    return this.currentState === RunLifecycleStates.DIVERGENT;
  }
}
