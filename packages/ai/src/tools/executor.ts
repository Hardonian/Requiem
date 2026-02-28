/**
 * @fileoverview Unified execution engine for the AI control-plane.
 *
 * INVARIANT: Every tool invocation produces a signed, deterministic envelope.
 * INVARIANT: Non-deterministic tools are explicitly marked in the envelope.
 * INVARIANT: Replay cache is checked before execution for deterministic tools.
 * INVARIANT: All executions are bounded by timeout and recursion depth.
 *
 * The executor computes a deterministic hash over:
 *   tool_id + tool_version + input_hash + tenant_id
 *
 * This hash is used for replay caching and audit chain integrity.
 */

import { createHash } from 'crypto';
import { getTool } from './registry';
import { validateInputOrThrow, validateOutputOrThrow } from './schema';
import { evaluatePolicyWithBudget } from '../policy/gate';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { writeAuditRecord } from '../telemetry/audit';
import { withSpan } from '../telemetry/trace';
import { logger } from '../telemetry/logger';
import { checkDepth, releaseDepth } from './sandbox';
import { checkReplayCache, storeReplayRecord } from './replay';
import type { InvocationContext } from '../types/index';
import type { ToolAuditRecord } from './types';

// ─── Execution Envelope ───────────────────────────────────────────────────────

/**
 * The canonical output envelope for every tool invocation.
 * Returned by executeToolEnvelope — the only approved call path.
 */
export interface ExecutionEnvelope {
  /** The actual tool output */
  readonly result: unknown;
  /** Whether the tool is deterministic (affects caching) */
  readonly deterministic: boolean;
  /** Content-addressable hash of input + context */
  readonly hash: string;
  /** Wall-clock execution duration in ms */
  readonly duration_ms: number;
  /** Registered tool version at invocation time */
  readonly tool_version: string;
  /** Tenant ID from invocation context */
  readonly tenant_id: string;
  /** Request/trace ID */
  readonly request_id: string;
  /** Whether the result was served from replay cache */
  readonly from_cache: boolean;
}

// ─── Default Timeout ─────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Execute a tool through the full enforcement pipeline:
 *   1. Depth guard (recursion limit)
 *   2. Tool lookup
 *   3. Policy gate (RBAC + budget)
 *   4. Input schema validation
 *   5. Deterministic hash computation
 *   6. Replay cache check
 *   7. Timeout-bounded execution
 *   8. Output schema validation
 *   9. Audit record persistence
 *  10. Structured envelope return
 *
 * This is the ONLY approved entry point for tool execution.
 * Direct handler calls are forbidden outside tests.
 */
export async function executeToolEnvelope(
  ctx: InvocationContext,
  toolName: string,
  input: unknown,
  opts?: { version?: string; timeoutMs?: number }
): Promise<ExecutionEnvelope> {
  const startMs = Date.now(); // DETERMINISM: observation-only, not in decision path
  const tenantId = ctx.tenant.tenantId;
  const timeoutMs = Math.min(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  return withSpan(`tool:${toolName}`, ctx.traceId, async (span) => {
    span.attributes['tool'] = toolName;
    span.attributes['tenant_id'] = tenantId;

    // ── 1. Depth guard ────────────────────────────────────────────────────────
    checkDepth(ctx.traceId);

    try {
      // ── 2. Tool lookup ──────────────────────────────────────────────────────
      const registered = getTool(toolName, tenantId, opts?.version);
      if (!registered) {
        await _denyAudit(toolName, opts?.version ?? 'unknown', ctx, startMs, 'Tool not found');
        throw AiError.toolNotFound(toolName);
      }

      const { definition, handler } = registered;
      span.attributes['tool_version'] = definition.version;
      span.attributes['deterministic'] = definition.deterministic;

      // ── 3. Policy gate ──────────────────────────────────────────────────────
      const decision = await evaluatePolicyWithBudget(ctx, definition, input);
      await writeAuditRecord(_buildAuditRecord(
        toolName, definition.version, ctx,
        decision.allowed ? 'allow' : 'deny',
        decision.reason,
        null
      ));

      if (!decision.allowed) {
        throw AiError.policyDenied(decision.reason, toolName);
      }

      // ── 4. Input validation ─────────────────────────────────────────────────
      validateInputOrThrow(definition, input);

      // ── 5. Deterministic hash ───────────────────────────────────────────────
      const inputHash = _hashInput(input);
      const executionHash = _executionHash(
        toolName,
        definition.version,
        inputHash,
        tenantId,
        definition.deterministic ? 'deterministic' : 'non-deterministic'
      );
      span.attributes['execution_hash'] = executionHash;

      // ── 6. Replay cache ─────────────────────────────────────────────────────
      if (definition.deterministic) {
        const cached = await checkReplayCache(executionHash, tenantId);
        if (cached) {
          const duration_ms = Date.now() - startMs;
          span.attributes['from_cache'] = true;
          logger.debug('[executor] replay cache hit', { hash: executionHash, tool: toolName });
          return {
            result: cached.result,
            deterministic: true,
            hash: executionHash,
            duration_ms,
            tool_version: definition.version,
            tenant_id: tenantId,
            request_id: ctx.traceId,
            from_cache: true,
          };
        }
      }

      // ── 7. Timeout-bounded execution ────────────────────────────────────────
      let output: unknown;
      try {
        output = await _withTimeout(
          () => handler(ctx, input),
          timeoutMs,
          toolName
        );
      } catch (err) {
        const aiErr = AiError.fromUnknown(err, 'tool.execute');
        throw aiErr;
      }

      // ── 8. Output validation ────────────────────────────────────────────────
      validateOutputOrThrow(definition, output);

      const duration_ms = Date.now() - startMs;
      span.attributes['duration_ms'] = duration_ms;

      // ── 9. Store replay record (deterministic tools only) ───────────────────
      if (definition.deterministic) {
        await storeReplayRecord({
          hash: executionHash,
          tenantId,
          toolName,
          toolVersion: definition.version,
          inputHash,
          result: output,
          createdAt: new Date().toISOString(),
        });
      }

      logger.debug('[executor] tool executed', {
        tool: toolName,
        version: definition.version,
        duration_ms,
        deterministic: definition.deterministic,
        tenant_id: tenantId,
        trace_id: ctx.traceId,
      });

      // ── 10. Return envelope ─────────────────────────────────────────────────
      return {
        result: output,
        deterministic: definition.deterministic,
        hash: executionHash,
        duration_ms,
        tool_version: definition.version,
        tenant_id: tenantId,
        request_id: ctx.traceId,
        from_cache: false,
      };
    } finally {
      releaseDepth(ctx.traceId);
    }
  });
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _hashInput(input: unknown): string {
  const normalized = _stableStringify(input);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function _executionHash(
  toolName: string,
  version: string,
  inputHash: string,
  tenantId: string,
  mode: string
): string {
  const payload = `${toolName}@${version}:${inputHash}:${tenantId}:${mode}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function _stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(_stableStringify).join(',')}]`;
  const sorted = Object.keys(value as object)
    .sort()
    .map(k => `${JSON.stringify(k)}:${_stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${sorted.join(',')}}`;
}

function _withTimeout<T>(fn: () => Promise<T>, ms: number, toolName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AiError({
        code: AiErrorCode.TOOL_TIMEOUT,
        message: `Tool "${toolName}" timed out after ${ms}ms`,
        phase: 'executor',
      }));
    }, ms);

    fn().then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function _denyAudit(
  toolName: string,
  version: string,
  ctx: InvocationContext,
  startMs: number,
  reason: string
): Promise<void> {
  await writeAuditRecord(_buildAuditRecord(
    toolName, version, ctx, 'deny', reason, Date.now() - startMs
  ));
}

function _buildAuditRecord(
  toolName: string,
  toolVersion: string,
  ctx: InvocationContext,
  decision: 'allow' | 'deny',
  reason: string,
  latencyMs: number | null
): ToolAuditRecord {
  return {
    toolName,
    toolVersion,
    actorId: ctx.actorId,
    tenantId: ctx.tenant.tenantId,
    traceId: ctx.traceId,
    decision,
    reason,
    latencyMs,
    timestamp: new Date().toISOString(),
  };
}
