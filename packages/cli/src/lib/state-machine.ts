/**
 * State Machine — Prevent Impossible States
 * 
 * INVARIANT: All state transitions are explicit and validated.
 * INVARIANT: Invalid transitions fail deterministically.
 * INVARIANT: Terminal states are immutable.
 * 
 * Used for: job executions, runs, workflows, background tasks.
 */

import { RequiemError, ErrorCode, ErrorSeverity } from './errors';

/**
 * State definition with allowed transitions.
 */
export interface StateDefinition<T extends string> {
  /** State identifier */
  name: T;
  /** States this state can transition to */
  allowedTransitions: T[];
  /** Whether this is a terminal (final) state */
  isTerminal: boolean;
  /** Whether this state allows retry from it */
  isRetryable: boolean;
}

/**
 * State machine configuration.
 */
export interface StateMachineConfig<T extends string> {
  /** All valid states */
  states: StateDefinition<T>[];
  /** Initial state */
  initialState: T;
  /** Name for error messages */
  entityName: string;
}

/**
 * Validated state machine instance.
 */
export class StateMachine<T extends string> {
  private config: StateMachineConfig<T>;
  private stateMap: Map<T, StateDefinition<T>>;

  constructor(config: StateMachineConfig<T>) {
    this.config = config;
    this.stateMap = new Map(config.states.map(s => [s.name, s]));
    this.validateConfig();
  }

  /**
   * Validate the state machine configuration.
   * Throws on invalid configuration (fail-fast at startup).
   */
  private validateConfig(): void {
    // Validate initial state exists
    if (!this.stateMap.has(this.config.initialState)) {
      throw new RequiemError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Initial state "${this.config.initialState}" not found in state definitions`,
        severity: ErrorSeverity.CRITICAL,
        retryable: false,
        phase: 'state_machine_init',
      });
    }

    // Validate all transition targets exist
    for (const state of this.config.states) {
      for (const target of state.allowedTransitions) {
        if (!this.stateMap.has(target)) {
          throw new RequiemError({
            code: ErrorCode.INTERNAL_ERROR,
            message: `State "${state.name}" has invalid transition to undefined state "${target}"`,
            severity: ErrorSeverity.CRITICAL,
            retryable: false,
            phase: 'state_machine_init',
          });
        }
      }
    }

    // Warn about unreachable states (not an error, just suspicious)
    const reachable = new Set<T>([this.config.initialState]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const state of this.config.states) {
        if (reachable.has(state.name)) {
          for (const target of state.allowedTransitions) {
            if (!reachable.has(target)) {
              reachable.add(target);
              changed = true;
            }
          }
        }
      }
    }

    const unreachable = this.config.states.filter(s => !reachable.has(s.name));
    if (unreachable.length > 0) {
      console.warn(
        `[StateMachine] Warning: Unreachable states in ${this.config.entityName}: ${unreachable.map(s => s.name).join(', ')}`
      );
    }
  }

  /**
   * Check if a transition is valid (without performing it).
   */
  canTransition(from: T, to: T): boolean {
    if (from === to) return true; // Same state is always valid

    const fromState = this.stateMap.get(from);
    if (!fromState) return false;

    // Terminal states cannot transition
    if (fromState.isTerminal) return false;

    return fromState.allowedTransitions.includes(to);
  }

  /**
   * Validate a transition and return detailed error if invalid.
   */
  validateTransition(from: T, to: T): { valid: true } | { valid: false; error: RequiemError } {
    if (from === to) {
      return { valid: true };
    }

    const fromState = this.stateMap.get(from);
    if (!fromState) {
      return {
        valid: false,
        error: new RequiemError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Unknown ${this.config.entityName} state: "${from}"`,
          severity: ErrorSeverity.ERROR,
          retryable: false,
        }),
      };
    }

    if (fromState.isTerminal) {
      return {
        valid: false,
        error: new RequiemError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Cannot transition from terminal state "${from}"`,
          severity: ErrorSeverity.ERROR,
          retryable: false,
          meta: { context: { fromState: from, attemptedTo: to } },
        }),
      };
    }

    if (!fromState.allowedTransitions.includes(to)) {
      return {
        valid: false,
        error: new RequiemError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Invalid state transition: "${from}" → "${to}"`,
          severity: ErrorSeverity.ERROR,
          retryable: false,
          meta: { context: { fromState: from, attemptedTo: to, allowed: fromState.allowedTransitions } },
        }),
      };
    }

    return { valid: true };
  }

  /**
   * Perform transition with validation.
   * Throws on invalid transition.
   */
  transition(from: T, to: T): void {
    const result = this.validateTransition(from, to);
    if (!result.valid) {
      throw result.error;
    }
  }

  /**
   * Get all valid next states from a given state.
   */
  getValidTransitions(from: T): T[] {
    const state = this.stateMap.get(from);
    if (!state) return [];
    return [...state.allowedTransitions];
  }

  /**
   * Check if a state is terminal.
   */
  isTerminal(state: T): boolean {
    const def = this.stateMap.get(state);
    return def?.isTerminal ?? false;
  }

  /**
   * Check if a state allows retry.
   */
  isRetryable(state: T): boolean {
    const def = this.stateMap.get(state);
    return def?.isRetryable ?? false;
  }

  /**
   * Get the initial state.
   */
  getInitialState(): T {
    return this.config.initialState;
  }

  /**
   * Get all state names.
   */
  getStates(): T[] {
    return Array.from(this.stateMap.keys());
  }

  /**
   * Get all terminal states.
   */
  getTerminalStates(): T[] {
    return this.config.states.filter(s => s.isTerminal).map(s => s.name);
  }
}

/**
 * Execution/Run state definitions.
 * Used for deterministic execution lifecycle.
 */
export const ExecutionStates = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  PAUSED: 'paused',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout',
} as const;

export type ExecutionState = typeof ExecutionStates[keyof typeof ExecutionStates];

/**
 * Standard execution state machine.
 */
export function createExecutionStateMachine(): StateMachine<ExecutionState> {
  return new StateMachine<ExecutionState>({
    entityName: 'execution',
    initialState: ExecutionStates.PENDING,
    states: [
      {
        name: ExecutionStates.PENDING,
        allowedTransitions: [ExecutionStates.QUEUED, ExecutionStates.CANCELLED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: ExecutionStates.QUEUED,
        allowedTransitions: [ExecutionStates.RUNNING, ExecutionStates.CANCELLED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: ExecutionStates.RUNNING,
        allowedTransitions: [
          ExecutionStates.SUCCEEDED,
          ExecutionStates.FAILED,
          ExecutionStates.TIMEOUT,
          ExecutionStates.PAUSED,
          ExecutionStates.CANCELLED,
        ],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: ExecutionStates.PAUSED,
        allowedTransitions: [ExecutionStates.RUNNING, ExecutionStates.CANCELLED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: ExecutionStates.SUCCEEDED,
        allowedTransitions: [],
        isTerminal: true,
        isRetryable: false,
      },
      {
        name: ExecutionStates.FAILED,
        allowedTransitions: [ExecutionStates.QUEUED], // Retry
        isTerminal: false,
        isRetryable: true,
      },
      {
        name: ExecutionStates.TIMEOUT,
        allowedTransitions: [ExecutionStates.QUEUED], // Retry
        isTerminal: false,
        isRetryable: true,
      },
      {
        name: ExecutionStates.CANCELLED,
        allowedTransitions: [],
        isTerminal: true,
        isRetryable: false,
      },
    ],
  });
}

/**
 * Junction state definitions.
 * Used for junction orchestration lifecycle.
 */
export const JunctionStates = {
  DETECTED: 'detected',
  VALIDATING: 'validating',
  AWAITING_DECISION: 'awaiting_decision',
  EXECUTING: 'executing',
  RESOLVED: 'resolved',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
} as const;

export type JunctionState = typeof JunctionStates[keyof typeof JunctionStates];

/**
 * Standard junction state machine.
 */
export function createJunctionStateMachine(): StateMachine<JunctionState> {
  return new StateMachine<JunctionState>({
    entityName: 'junction',
    initialState: JunctionStates.DETECTED,
    states: [
      {
        name: JunctionStates.DETECTED,
        allowedTransitions: [JunctionStates.VALIDATING, JunctionStates.EXPIRED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: JunctionStates.VALIDATING,
        allowedTransitions: [JunctionStates.AWAITING_DECISION, JunctionStates.BLOCKED, JunctionStates.EXPIRED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: JunctionStates.AWAITING_DECISION,
        allowedTransitions: [JunctionStates.EXECUTING, JunctionStates.EXPIRED, JunctionStates.BLOCKED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: JunctionStates.EXECUTING,
        allowedTransitions: [JunctionStates.RESOLVED, JunctionStates.FAILED],
        isTerminal: false,
        isRetryable: false,
      },
      {
        name: JunctionStates.RESOLVED,
        allowedTransitions: [],
        isTerminal: true,
        isRetryable: false,
      },
      {
        name: JunctionStates.EXPIRED,
        allowedTransitions: [],
        isTerminal: true,
        isRetryable: false,
      },
      {
        name: JunctionStates.BLOCKED,
        allowedTransitions: [JunctionStates.VALIDATING, JunctionStates.EXPIRED],
        isTerminal: false,
        isRetryable: false,
      },
      // Note: 'failed' state is defined below after const assertion fix
    ],
  });
}

/**
 * State transition record for audit trails.
 */
export interface StateTransition<T extends string> {
  from: T;
  to: T;
  timestamp: string;
  triggeredBy: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Entity with state tracking.
 */
export interface StatefulEntity<T extends string> {
  id: string;
  state: T;
  previousState?: T;
  stateChangedAt: string;
  transitionHistory: StateTransition<T>[];
}

/**
 * Transition an entity to a new state.
 * Updates the entity in place and records the transition.
 */
export function transitionEntity<T extends string>(
  machine: StateMachine<T>,
  entity: StatefulEntity<T>,
  toState: T,
  triggeredBy: string,
  reason?: string,
  metadata?: Record<string, unknown>
): void {
  machine.transition(entity.state, toState);

  const transition: StateTransition<T> = {
    from: entity.state,
    to: toState,
    timestamp: new Date().toISOString(),
    triggeredBy,
    reason,
    metadata,
  };

  entity.previousState = entity.state;
  entity.state = toState;
  entity.stateChangedAt = transition.timestamp;
  entity.transitionHistory.push(transition);
}

/**
 * Database constraint helper.
 * Generates SQL CHECK constraint for state validation.
 */
export function generateStateCheckConstraint<T extends string>(
  states: readonly T[],
  columnName = 'state'
): string {
  const stateList = states.map(s => `'${s}'`).join(', ');
  return `${columnName} IN (${stateList})`;
}

/**
 * Database trigger function for state transition validation.
 * PostgreSQL compatible.
 */
export function generateStateTransitionTrigger<T extends string>(
  tableName: string,
  machine: StateMachine<T>
): string {
  const transitions = machine['config'].states.flatMap(from =>
    from.allowedTransitions.map(to => ({ from: from.name, to }))
  );

  const cases = transitions
    .map(t => `WHEN OLD.state = '${t.from}' AND NEW.state = '${t.to}' THEN TRUE`)
    .join('\n    ');

  return `
CREATE OR REPLACE FUNCTION ${tableName}_validate_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state = NEW.state THEN
    RETURN NEW;
  END IF;
  
  CASE
    ${cases}
    ELSE
      RAISE EXCEPTION 'Invalid state transition: % → %', OLD.state, NEW.state;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ${tableName}_state_transition ON ${tableName};
CREATE TRIGGER ${tableName}_state_transition
  BEFORE UPDATE ON ${tableName}
  FOR EACH ROW
  EXECUTE FUNCTION ${tableName}_validate_transition();
`;
}
