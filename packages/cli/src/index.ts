/**
 * Requiem CLI Package
 *
 * Exports for programmatic usage of the CLI functionality.
 */

// Commands
export { runDecideCommand, parseDecideArgs, type DecideCliArgs } from './commands/decide';
export { runJunctionsCommand, parseJunctionsArgs, type JunctionsCliArgs } from './commands/junctions';
export { trace } from './commands/trace';
export { replay } from './commands/replay';
export { stats } from './commands/stats';
export { nuke } from './commands/nuke';
export { config } from './commands/config';
export { init } from './commands/init';

// Engine
export {
  evaluateDecision,
  getDecisionEngine,
  createDecisionEngine,
  checkEngineAvailability,
  TsReferenceEngine,
  RequiemEngine,
  type DecisionEngine,
  type DecisionInput,
  type DecisionOutput,
  type ExecRequest,
  type ExecResult,
  EngineErrorCodes,
} from './engine/adapter';

// Fallback algorithms
export {
  evaluateDecisionFallback,
  type DecisionInput as FallbackDecisionInput,
  type DecisionOutput as FallbackDecisionOutput,
} from './lib/fallback';

// Junctions
export {
  junctionOrchestrator,
  JunctionOrchestrator,
  type JunctionOrchestratorConfig,
  generateJunctionFingerprint,
  generateDeduplicationKey,
} from './junctions/orchestrator';

export {
  JUNCTION_TYPE_META,
  DEFAULT_JUNCTION_CONFIG,
  getSeverityLevel,
  type JunctionType,
  type SourceType,
  type JunctionTrigger,
  type JunctionConfig,
  type JunctionRule,
} from './junctions/types';

// Database
export {
  JunctionRepository,
  ActionIntentRepository,
  type Junction,
  type ActionIntent,
  type CreateJunctionInput,
  type CreateActionIntentInput,
} from './db/junctions';

export {
  DecisionRepository,
  type DecisionReport,
  type CreateDecisionInput,
  type UpdateDecisionInput,
} from './db/decisions';

export { getDB, resetDB, type DB, type Statement } from './db/connection';
export { newId, uuid } from './db/helpers';

// Utilities
export { hash, hashShort } from './lib/hash';

// Errors (Structured Error Envelope)
export {
  RequiemError,
  ErrorCode,
  ErrorSeverity,
  Errors,
  errorToHttpStatus,
  type ErrorEnvelope,
  type ErrorMeta,
  type RequiemErrorOptions,
} from './lib/errors';

// Tenant Resolution
export {
  DefaultTenantResolver,
  MockTenantResolver,
  TenantRole,
  hasRequiredRole,
  requireTenantContext,
  requireTenantContextCli,
  setGlobalTenantResolver,
  getGlobalTenantResolver,
  type TenantContext,
  type TenantResolver,
  type TenantResolutionOptions,
  type TenantMembership,
} from './lib/tenant';

// State Machine
export {
  StateMachine,
  createExecutionStateMachine,
  createJunctionStateMachine,
  ExecutionStates,
  JunctionStates,
  transitionEntity,
  generateStateCheckConstraint,
  type StateDefinition,
  type StateTransition,
  type StatefulEntity,
  type ExecutionState,
  type JunctionState,
} from './lib/state-machine';

// Clock (Deterministic Time)
export {
  SystemClock,
  SeededClock,
  FrozenClock,
  OffsetClock,
  setGlobalClock,
  getGlobalClock,
  ClockUtil,
  seedFromString,
  captureConfigSnapshot,
  hashConfigSnapshot,
  verifyConfigSnapshot,
  withTimeout,
  type Clock,
  type ConfigSnapshot,
} from './lib/clock';

// Version
export const VERSION = '0.1.0';
