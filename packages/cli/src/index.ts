/**
 * Requiem CLI Package
 *
 * Exports for programmatic usage of the CLI functionality.
 */

// Commands
export { runDecideCommand, parseDecideArgs, type DecideCliArgs } from './commands/decide.js';
export { runJunctionsCommand, parseJunctionsArgs, type JunctionsCliArgs } from './commands/junctions.js';
export { trace } from './commands/trace.js';
export { replay } from './commands/replay.js';
export { stats } from './commands/stats.js';
export { nuke } from './commands/nuke.js';
export { config } from './commands/config.js';
export { init } from './commands/init.js';
export { telemetry } from './commands/telemetry.js';
export { stress } from './commands/stress.js';
export { dashboard } from './commands/dashboard.js';
export { serve } from './commands/serve.js';
export { backup } from './commands/backup.js';
export { restore } from './commands/restore.js';
export { importCommand } from './commands/import.js';

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
} from './engine/adapter.js';

// Fallback algorithms
export {
  evaluateDecisionFallback,
  type DecisionInput as FallbackDecisionInput,
  type DecisionOutput as FallbackDecisionOutput,
} from './lib/fallback.js';

// Junctions
export {
  junctionOrchestrator,
  JunctionOrchestrator,
  type JunctionOrchestratorConfig,
  generateJunctionFingerprint,
  generateDeduplicationKey,
} from './junctions/orchestrator.js';

export {
  JUNCTION_TYPE_META,
  DEFAULT_JUNCTION_CONFIG,
  getSeverityLevel,
  type JunctionType,
  type SourceType,
  type JunctionTrigger,
  type JunctionConfig,
  type JunctionRule,
} from './junctions/types.js';

// Database
export {
  JunctionRepository,
  ActionIntentRepository,
  type Junction,
  type ActionIntent,
  type CreateJunctionInput,
  type CreateActionIntentInput,
} from './db/junctions.js';

export {
  DecisionRepository,
  type DecisionReport,
  type CreateDecisionInput,
  type UpdateDecisionInput,
} from './db/decisions.js';

export { getDB, resetDB, type DB, type Statement } from './db/connection.js';
export { newId, uuid } from './db/helpers.js';

// Utilities
export { hash, hashShort } from './lib/hash.js';

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
} from './lib/errors.js';

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
} from './lib/tenant.js';

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
} from './lib/state-machine.js';

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
} from './lib/clock.js';

// Version
export const VERSION = '0.1.0';

// Core Module (Unified Error System + Structured Logging)
export * from './core/index.js';

