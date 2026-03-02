/**
 * @fileoverview Public API for the @requiem/ai package.
 *
 * Import this module to get access to the full AI control-plane.
 * Registers built-in tools and skills on first import.
 *
 * Usage:
 *   import { registerTool, invokeToolWithPolicy, runSkill } from '@requiem/ai';
 */

// ─── Core Types ───────────────────────────────────────────────────────────────
export type { InvocationContext, TenantContext, ApiEnvelope, SerializedAiError } from './types/index.js';
export { TenantRole, hasRequiredRole, newId, now } from './types/index.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export { AiError, type AiErrorOptions } from './errors/AiError.js';
export { AiErrorCode, AiErrorSeverity, aiErrorToHttpStatus } from './errors/codes.js';
export { errorEnvelope, successEnvelope } from './errors/index.js';

// ─── Tools ────────────────────────────────────────────────────────────────────
export { registerTool, getTool, listTools, getToolCount, _clearRegistry, getToolVersion, getToolDigest, validateToolSchema, DEFAULT_OUTPUT_MAX_BYTES } from './tools/registry.js';
export { invokeToolWithPolicy } from './tools/invoke.js';
export { validateInput, validateOutput, validateInputOrThrow, validateOutputOrThrow } from './tools/schema.js';
export type { ToolDefinition, ToolHandler, RegisteredTool, ToolInvocationResult, JsonSchema } from './tools/types.js';

// ─── Policy ───────────────────────────────────────────────────────────────────
export { evaluatePolicy, evaluatePolicyWithBudget, type PolicyDecision } from './policy/gate.js';
export { Capabilities, getCapabilitiesForRole, hasCapabilities, capabilitiesFromRole, type Capability } from './policy/capabilities.js';
export {
  setBudgetChecker,
  getBudgetChecker,
  DefaultBudgetChecker,
  AtomicBudgetChecker,
  PersistentBudgetChecker,
  InMemoryBudgetStore,
  HttpBudgetStore,
  type BudgetChecker,
  type BudgetCheckResult,
  type BudgetLimit,
  type BudgetPolicy,
  type BudgetUsage,
  type BudgetState,
  type CostMetadata,
  type PersistentBudgetStore,
  type HttpBudgetStoreConfig,
} from './policy/budgets.js';
export {
  CostAnomalyDetector,
  setAnomalyDetector,
  getAnomalyDetector,
  type AnomalyResult,
  type AnomalyContext,
  type AnomalyThresholds,
  type AnomalySeverity,
} from './policy/costAnomaly.js';
export { checkMigrationPolicy, _resetPolicyCache, type MigrationCheckResult } from './policy/migration.js';

// ─── MCP ──────────────────────────────────────────────────────────────────────
export { handleListTools, handleCallTool, handleHealth, validateTenantAccess, assertTenantAccess, type McpHandlerResult } from './mcp/server.js';
export { GET_health, GET_tools, POST_callTool, AUTH_STATUS, type AuthStatus } from './mcp/transport-next.js';
export { SlidingWindowRateLimiter, getRateLimiter, loadRateLimitConfig, type RateLimitConfig } from './mcp/rateLimit.js';
export type { McpToolDescriptor, McpListToolsResponse, McpCallToolResponse, McpHealthResponse } from './mcp/types.js';

// ─── Skills ───────────────────────────────────────────────────────────────────
export { registerSkill, getSkill, listSkills, getSkillCount } from './skills/registry.js';
export { runSkill, validateSkillContext, type SkillContext } from './skills/runner.js';
export { OutputSizeLimiter, getOutputLimiter, setOutputLimiter, parseTriggerDataWithLimit, DEFAULT_TRIGGER_DATA_MAX_BYTES, type OutputSizeCheckResult, type OutputLimiterConfig } from './skills/outputLimiter.js';
export type { SkillDefinition, SkillStep, StepResult, SkillRunResult } from './skills/types.js';

// ─── Models ───────────────────────────────────────────────────────────────────
export { registerProvider, getProvider, listProviders, getModel, listModels, getDefaultModel, registerModel, type ModelDefinition } from './models/registry.js';
export { generateText, type ArbitratorRequest } from './models/arbitrator.js';
export {
  checkCircuit,
  recordSuccess,
  recordFailure,
  getCircuitState,
  getCircuitStateAsync,
  resetCircuit,
  enterRecursion,
  exitRecursion,
  getRecursionDepth,
  resetRecursionDepth,
  setCircuitStore,
  getCircuitStore,
  initCircuitStore,
  preloadCircuitStates,
  listAllCircuitStates,
  HttpCircuitBreakerStore,
  FileCircuitBreakerStore,
  type CircuitBreakerConfig,
  type CircuitState,
  type CircuitBreakerPersistence,
  type CircuitStateSummary,
  type HttpCircuitBreakerStoreConfig,
} from './models/circuitBreaker.js';
export { AnthropicProvider } from './models/providers/anthropic.js';
export { OpenAIProvider } from './models/providers/openai.js';
export type { ModelProvider, GenerateTextRequest, GenerateTextResponse } from './models/providers/types.js';

// ─── Memory ───────────────────────────────────────────────────────────────────
export { storeMemoryItem, getMemoryItem, listMemoryItems, setMemoryStore, getMemoryStore } from './memory/store.js';
export { hashContent, normalizeForHashing, verifyHash } from './memory/hashing.js';
export { redactObject, redactString } from './memory/redaction.js';
export { setVectorStore, getVectorStore, type VectorStore } from './memory/vectorPointers.js';
export { ReplayCache, getReplayCache, setReplayCache, isCacheable, createReplayKey, type CachedToolResult, type ReplayCacheLookup, type ReplayCacheConfig } from './memory/replayCache.js';
export type { MemoryItem, MemoryItemMetadata } from './memory/store.js';

// ─── Telemetry ────────────────────────────────────────────────────────────────
export { logger, setLogSink } from './telemetry/logger.js';
export { startSpan, endSpan, withSpan, getSpansForTrace, type Span } from './telemetry/trace.js';
export {
  writeAuditRecord,
  flushAuditLog,
  setAuditSink,
  getAuditPersistence,
  AUDIT_PERSISTENCE,
  type AuditSink,
  type IAuditSink,
  type TenantAuditRecord,
  InMemoryAuditSink,
  FileAuditSink,
  DatabaseAuditSink,
  CompositeSink,
} from './telemetry/audit.js';
export { createDefaultAuditSink, type DatabaseAuditSinkConfig } from './telemetry/auditSink.js';
export {
  MerkleAuditChain,
  getGlobalMerkleChain,
  computeChainHash,
  GENESIS_HASH,
  _resetMerkleChain,
} from './telemetry/merkleChain.js';
export { recordCost, recordToolCost, setCostSink, type CostRecord } from './telemetry/cost.js';
export {
  TraceAnalytics,
  computeTraceMetrics,
  detectTraceAnomalies,
  type TraceRecord,
  type TraceMetrics,
  type TraceAnomaly,
  type TraceAnomalyThresholds,
} from './telemetry/traceAnalytics.js';

// ─── Eval ─────────────────────────────────────────────────────────────────────
export { runEvalCase, runEvalHarness, type EvalRunResult, type HarnessResult } from './eval/harness.js';
export { diff, diffValues, type DiffResult, type DiffEntry } from './eval/diff.js';
export { loadEvalCases, loadGoldens, type EvalCase, type EvalGolden } from './eval/cases.js';

// ─── Feature Flags ────────────────────────────────────────────────────────────
export { loadFlags, requireEnterprise, isKillSwitchActive, _resetFlagCache } from './flags/index.js';
export type { FeatureFlags } from './flags/index.js';

// ─── Replay + Sandbox ─────────────────────────────────────────────────────────
export { storeReplayRecord, checkReplayCache, getReplayRecord, setReplaySink, InMemoryReplaySink } from './tools/replay.js';
export { sandboxPath, checkDepth, releaseDepth, MAX_DEPTH, MAX_CHAIN_LENGTH, _resetSandbox } from './tools/sandbox.js';

// ─── Tool Executor ────────────────────────────────────────────────────────────
export { executeToolEnvelope, type ExecutionEnvelope } from './tools/executor.js';

// ─── Model Router ─────────────────────────────────────────────────────────────
export { routeModelCall, type RouterRequest, type RouterResponse } from './models/router.js';

// ─── Bootstrap (register built-ins) ──────────────────────────────────────────
// These side-effect imports register built-in tools and skills.
import './tools/builtins/system.echo';
import './tools/builtins/system.health';
import './tools/builtins/fs.read_file.js';
import './tools/builtins/fs.write_file.js';
import './tools/builtins/fs.list_dir.js';
import './tools/builtins/fs.diff_file.js';
import './tools/builtins/web.fetch';
import './tools/builtins/vector.search';
import './tools/builtins/vector.upsert';
import './tools/builtins/kilo.execute';
import './skills/baseline.js';
