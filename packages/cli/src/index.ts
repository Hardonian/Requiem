/**
 * Requiem CLI Package
 * 
 * Exports for programmatic usage of the CLI functionality.
 */

// Commands
export { runDecideCommand, parseDecideArgs, type DecideCliArgs } from './commands/decide';
export { runJunctionsCommand, parseJunctionsArgs, type JunctionsCliArgs } from './commands/junctions';

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

// Version
export const VERSION = '0.1.0';
