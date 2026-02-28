/**
 * @fileoverview Execution sandbox for the AI control-plane.
 *
 * INVARIANT: No tool chain may exceed MAX_DEPTH calls from the same trace.
 * INVARIANT: No tool chain may exceed MAX_CHAIN_LENGTH total invocations.
 * INVARIANT: Depth tracking is per-trace (not global) to allow parallelism.
 * INVARIANT: Depth is always decremented in `finally` blocks — no leaks.
 *
 * The sandbox tracks recursive tool invocation depth to prevent:
 * - Infinite tool recursion (e.g., tool A calls tool B calls tool A)
 * - Unbounded tool chains (e.g., 1000 sequential tool calls in one skill)
 */

import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { logger } from '../telemetry/logger';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum recursion depth per trace before TOOL_RECURSION_LIMIT is thrown. */
export const MAX_DEPTH = 10;

/** Maximum total tool invocations per trace before TOOL_CHAIN_LIMIT is thrown. */
export const MAX_CHAIN_LENGTH = 50;

// ─── Depth Tracking ───────────────────────────────────────────────────────────

/** Per-trace depth counter */
const _depths = new Map<string, number>();

/** Per-trace total invocation counter */
const _chains = new Map<string, number>();

/**
 * Check recursion depth for a trace. Increments the counter.
 * Throws TOOL_RECURSION_LIMIT if depth exceeds MAX_DEPTH.
 * Throws TOOL_CHAIN_LIMIT if total chain exceeds MAX_CHAIN_LENGTH.
 *
 * MUST be paired with releaseDepth() in a finally block.
 */
export function checkDepth(traceId: string): void {
  const depth = (_depths.get(traceId) ?? 0) + 1;
  const chain = (_chains.get(traceId) ?? 0) + 1;

  _depths.set(traceId, depth);
  _chains.set(traceId, chain);

  if (depth > MAX_DEPTH) {
    logger.warn('[sandbox] recursion depth exceeded', { traceId, depth, max: MAX_DEPTH });
    throw new AiError({
      code: AiErrorCode.TOOL_RECURSION_LIMIT,
      message: `Tool recursion depth exceeded (${depth} > ${MAX_DEPTH}) — possible infinite loop`,
      phase: 'sandbox',
    });
  }

  if (chain > MAX_CHAIN_LENGTH) {
    logger.warn('[sandbox] tool chain length exceeded', { traceId, chain, max: MAX_CHAIN_LENGTH });
    throw new AiError({
      code: AiErrorCode.TOOL_CHAIN_LIMIT,
      message: `Tool chain length exceeded (${chain} > ${MAX_CHAIN_LENGTH}) — possible runaway execution`,
      phase: 'sandbox',
    });
  }
}

/**
 * Decrement the depth counter for a trace.
 * MUST be called in a finally block after checkDepth().
 */
export function releaseDepth(traceId: string): void {
  const depth = _depths.get(traceId) ?? 0;
  if (depth <= 1) {
    _depths.delete(traceId);
  } else {
    _depths.set(traceId, depth - 1);
  }
}

/**
 * Get the current depth for a trace (for observability).
 */
export function getDepth(traceId: string): number {
  return _depths.get(traceId) ?? 0;
}

/**
 * Get the total chain length for a trace (for observability).
 */
export function getChainLength(traceId: string): number {
  return _chains.get(traceId) ?? 0;
}

/**
 * Reset all sandbox state (for testing only).
 */
export function _resetSandbox(): void {
  _depths.clear();
  _chains.clear();
}

// ─── Path Sandbox ─────────────────────────────────────────────────────────────

import { resolve, relative, normalize } from 'path';

/**
 * Validate that a file path is safely within the workspace root.
 * Prevents directory traversal (../../etc/passwd) and absolute path escapes.
 *
 * Throws SANDBOX_ESCAPE_ATTEMPT if the path is outside workspace root.
 * Throws SANDBOX_PATH_INVALID if the path is syntactically invalid.
 */
export function sandboxPath(requestedPath: string, workspaceRoot: string): string {
  if (!requestedPath || typeof requestedPath !== 'string') {
    throw new AiError({
      code: AiErrorCode.SANDBOX_PATH_INVALID,
      message: 'Path must be a non-empty string',
      phase: 'sandbox.fs',
    });
  }

  // Reject obviously malicious patterns before resolving
  if (requestedPath.includes('\0')) {
    throw new AiError({
      code: AiErrorCode.SANDBOX_PATH_INVALID,
      message: 'Path contains null byte',
      phase: 'sandbox.fs',
    });
  }

  const normalized = normalize(requestedPath);
  const root = resolve(workspaceRoot);

  // Resolve the path relative to workspace root
  const resolved = requestedPath.startsWith('/')
    ? resolve(requestedPath)
    : resolve(root, normalized);

  // Compute relative path from root
  const rel = relative(root, resolved);

  // If relative path starts with '..' it's outside the sandbox
  if (rel.startsWith('..') || resolve(resolved) !== resolve(root, rel)) {
    logger.warn('[sandbox] escape attempt blocked', {
      requested: requestedPath,
      resolved,
      root,
    });
    throw new AiError({
      code: AiErrorCode.SANDBOX_ESCAPE_ATTEMPT,
      message: `Path traversal attempt blocked: "${requestedPath}" is outside workspace root`,
      phase: 'sandbox.fs',
    });
  }

  return resolved;
}

/**
 * Validate that a resolved path is within the workspace root.
 * Used as a second check after resolution.
 */
export function assertWithinRoot(resolved: string, workspaceRoot: string): void {
  const root = resolve(workspaceRoot);
  const rel = relative(root, resolved);
  if (rel.startsWith('..')) {
    throw new AiError({
      code: AiErrorCode.SANDBOX_ESCAPE_ATTEMPT,
      message: `Path "${resolved}" is outside the allowed workspace root`,
      phase: 'sandbox.fs',
    });
  }
}
