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
export { registerTool, getTool, listTools, getToolCount, _clearRegistry } from './tools/registry.js';
export { invokeToolWithPolicy } from './tools/invoke.js';
export { validateInput, validateOutput, validateInputOrThrow, validateOutputOrThrow } from './tools/schema.js';
export type { ToolDefinition, ToolHandler, RegisteredTool, ToolInvocationResult, JsonSchema } from './tools/types.js';

// ─── Policy ───────────────────────────────────────────────────────────────────
export { evaluatePolicy, evaluatePolicyWithBudget, type PolicyDecision } from './policy/gate.js';
export { Capabilities, getCapabilitiesForRole, hasCapabilities, capabilitiesFromRole, type Capability } from './policy/capabilities.js';
export { setBudgetChecker, getBudgetChecker, DefaultBudgetChecker, type BudgetChecker, type BudgetCheckResult } from './policy/budgets.js';

// ─── MCP ──────────────────────────────────────────────────────────────────────
export { handleListTools, handleCallTool, handleHealth, type McpHandlerResult } from './mcp/server.js';
export { GET_health, GET_tools, POST_callTool } from './mcp/transport-next.js';
export type { McpToolDescriptor, McpListToolsResponse, McpCallToolResponse, McpHealthResponse } from './mcp/types.js';

// ─── Skills ───────────────────────────────────────────────────────────────────
export { registerSkill, getSkill, listSkills, getSkillCount } from './skills/registry.js';
export { runSkill } from './skills/runner.js';
export type { SkillDefinition, SkillStep, StepResult, SkillRunResult } from './skills/types.js';

// ─── Models ───────────────────────────────────────────────────────────────────
export { registerProvider, getProvider, listProviders, getModel, listModels, getDefaultModel, registerModel, type ModelDefinition } from './models/registry.js';
export { generateText, type ArbitratorRequest } from './models/arbitrator.js';
export { checkCircuit, recordSuccess, recordFailure, getCircuitState, resetCircuit } from './models/circuitBreaker.js';
export { AnthropicProvider } from './models/providers/anthropic.js';
export { OpenAIProvider } from './models/providers/openai.js';
export type { ModelProvider, GenerateTextRequest, GenerateTextResponse } from './models/providers/types.js';

// ─── Memory ───────────────────────────────────────────────────────────────────
export { storeMemoryItem, getMemoryItem, listMemoryItems, setMemoryStore, getMemoryStore } from './memory/store.js';
export { hashContent, normalizeForHashing, verifyHash } from './memory/hashing.js';
export { redactObject, redactString } from './memory/redaction.js';
export { setVectorStore, getVectorStore, type VectorStore } from './memory/vectorPointers.js';
export type { MemoryItem, MemoryItemMetadata } from './memory/store.js';

// ─── Telemetry ────────────────────────────────────────────────────────────────
export { logger, setLogSink } from './telemetry/logger.js';
export { startSpan, endSpan, withSpan, getSpansForTrace, type Span } from './telemetry/trace.js';
export { writeAuditRecord, setAuditSink } from './telemetry/audit.js';
export { recordCost, recordToolCost, setCostSink, type CostRecord } from './telemetry/cost.js';

// ─── Eval ─────────────────────────────────────────────────────────────────────
export { runEvalCase, runEvalHarness, type EvalRunResult, type HarnessResult } from './eval/harness.js';
export { diff, diffValues, type DiffResult, type DiffEntry } from './eval/diff.js';
export { loadEvalCases, loadGoldens, type EvalCase, type EvalGolden } from './eval/cases.js';

// ─── Bootstrap (register built-ins) ──────────────────────────────────────────
// These side-effect imports register built-in tools and skills.
import './tools/builtins/system.echo.js';
import './tools/builtins/system.health.js';
import './skills/baseline.js';
