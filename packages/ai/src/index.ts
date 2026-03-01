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
export type { InvocationContext, TenantContext, ApiEnvelope, SerializedAiError } from './types/index';
export { TenantRole, hasRequiredRole, newId, now } from './types/index';

// ─── Errors ───────────────────────────────────────────────────────────────────
export { AiError, type AiErrorOptions } from './errors/AiError';
export { AiErrorCode, AiErrorSeverity, aiErrorToHttpStatus } from './errors/codes';
export { errorEnvelope, successEnvelope } from './errors/index';

// ─── Tools ────────────────────────────────────────────────────────────────────
export { registerTool, getTool, listTools, getToolCount, _clearRegistry, getToolVersion, getToolDigest, validateToolSchema, DEFAULT_OUTPUT_MAX_BYTES } from './tools/registry';
export { invokeToolWithPolicy } from './tools/invoke';
export { validateInput, validateOutput, validateInputOrThrow, validateOutputOrThrow } from './tools/schema';
export type { ToolDefinition, ToolHandler, RegisteredTool, ToolInvocationResult, JsonSchema } from './tools/types';

// ─── Policy ───────────────────────────────────────────────────────────────────
export { evaluatePolicy, evaluatePolicyWithBudget, type PolicyDecision } from './policy/gate';
export { Capabilities, getCapabilitiesForRole, hasCapabilities, capabilitiesFromRole, type Capability } from './policy/capabilities';
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
} from './policy/budgets';
export {
  CostAnomalyDetector,
  setAnomalyDetector,
  getAnomalyDetector,
  type AnomalyResult,
  type AnomalyContext,
  type AnomalyThresholds,
  type AnomalySeverity,
} from './policy/costAnomaly';
export { checkMigrationPolicy, _resetPolicyCache, type MigrationCheckResult } from './policy/migration';

// ─── MCP ──────────────────────────────────────────────────────────────────────
export { handleListTools, handleCallTool, handleHealth, validateTenantAccess, assertTenantAccess, type McpHandlerResult } from './mcp/server';
export { GET_health, GET_tools, POST_callTool, AUTH_STATUS, type AuthStatus } from './mcp/transport-next';
export { SlidingWindowRateLimiter, getRateLimiter, loadRateLimitConfig, type RateLimitConfig } from './mcp/rateLimit';
export type { McpToolDescriptor, McpListToolsResponse, McpCallToolResponse, McpHealthResponse } from './mcp/types';

// ─── Skills ───────────────────────────────────────────────────────────────────
export { registerSkill, getSkill, listSkills, getSkillCount } from './skills/registry';
export { runSkill, validateSkillContext, type SkillContext } from './skills/runner';
export { OutputSizeLimiter, getOutputLimiter, setOutputLimiter, parseTriggerDataWithLimit, DEFAULT_TRIGGER_DATA_MAX_BYTES, type OutputSizeCheckResult, type OutputLimiterConfig } from './skills/outputLimiter';
export type { SkillDefinition, SkillStep, StepResult, SkillRunResult } from './skills/types';

// ─── Models ───────────────────────────────────────────────────────────────────
export { registerProvider, getProvider, listProviders, getModel, listModels, getDefaultModel, registerModel, type ModelDefinition } from './models/registry';
export { generateText, type ArbitratorRequest } from './models/arbitrator';
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
} from './models/circuitBreaker';
export { AnthropicProvider } from './models/providers/anthropic';
export { OpenAIProvider } from './models/providers/openai';
export type { ModelProvider, GenerateTextRequest, GenerateTextResponse } from './models/providers/types';

// ─── Memory ───────────────────────────────────────────────────────────────────
export { storeMemoryItem, getMemoryItem, listMemoryItems, setMemoryStore, getMemoryStore } from './memory/store';
export { hashContent, normalizeForHashing, verifyHash } from './memory/hashing';
export { redactObject, redactString } from './memory/redaction';
export { setVectorStore, getVectorStore, type VectorStore } from './memory/vectorPointers';
export { ReplayCache, getReplayCache, setReplayCache, isCacheable, createReplayKey, type CachedToolResult, type ReplayCacheLookup, type ReplayCacheConfig } from './memory/replayCache';
export type { MemoryItem, MemoryItemMetadata } from './memory/store';

// ─── Telemetry ────────────────────────────────────────────────────────────────
export { logger, setLogSink } from './telemetry/logger';
export { startSpan, endSpan, withSpan, getSpansForTrace, type Span } from './telemetry/trace';
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
} from './telemetry/audit';
export { createDefaultAuditSink, type DatabaseAuditSinkConfig } from './telemetry/auditSink';
export {
  MerkleAuditChain,
  getGlobalMerkleChain,
  computeChainHash,
  GENESIS_HASH,
  _resetMerkleChain,
} from './telemetry/merkleChain';
export { recordCost, recordToolCost, setCostSink, type CostRecord } from './telemetry/cost';
export {
  TraceAnalytics,
  computeTraceMetrics,
  detectTraceAnomalies,
  type TraceRecord,
  type TraceMetrics,
  type TraceAnomaly,
  type TraceAnomalyThresholds,
} from './telemetry/traceAnalytics';

// ─── Eval ─────────────────────────────────────────────────────────────────────
export { runEvalCase, runEvalHarness, type EvalRunResult, type HarnessResult } from './eval/harness';
export { diff, diffValues, type DiffResult, type DiffEntry } from './eval/diff';
export { loadEvalCases, loadGoldens, type EvalCase, type EvalGolden } from './eval/cases';

// ─── Feature Flags ────────────────────────────────────────────────────────────
export { loadFlags, requireEnterprise, isKillSwitchActive, _resetFlagCache } from './flags/index';
export type { FeatureFlags } from './flags/index';

// ─── Replay + Sandbox ─────────────────────────────────────────────────────────
export { storeReplayRecord, checkReplayCache, getReplayRecord, setReplaySink, InMemoryReplaySink } from './tools/replay';
export { sandboxPath, checkDepth, releaseDepth, MAX_DEPTH, MAX_CHAIN_LENGTH, _resetSandbox } from './tools/sandbox';

// ─── Tool Executor ────────────────────────────────────────────────────────────
export { executeToolEnvelope, type ExecutionEnvelope } from './tools/executor';

// ─── Model Router ─────────────────────────────────────────────────────────────
export { routeModelCall, type RouterRequest, type RouterResponse } from './models/router';

// ─── Bootstrap (register built-ins) ──────────────────────────────────────────
// These side-effect imports register built-in tools and skills.
import './tools/builtins/system.echo';
import './tools/builtins/system.health';
import './tools/builtins/fs.read_file';
import './tools/builtins/fs.write_file';
import './tools/builtins/fs.list_dir';
import './tools/builtins/fs.diff_file';
import './tools/builtins/web.fetch';
import './tools/builtins/vector.search';
import './tools/builtins/vector.upsert';
import './tools/builtins/kilo.execute';
import './skills/baseline';
