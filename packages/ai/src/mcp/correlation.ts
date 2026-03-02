/**
 * @fileoverview Correlation ID management for distributed tracing.
 *
 * Provides correlation ID generation, extraction, and propagation across
 * the request lifecycle. Supports both simple X-Correlation-ID header
 * and W3C traceparent format.
 *
 * INVARIANT: Correlation IDs are always UUID v4 when generated.
 * INVARIANT: Correlation IDs are propagated to all audit records and logs.
 */

import { newId } from '../types/index.js';
import type { InvocationContext } from '../types/index.js';

// ─── Correlation ID Header Names ───────────────────────────────────────────────

/** Standard correlation ID header */
export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/** W3C traceparent header (preferred for distributed tracing) */
export const TRACEPARENT_HEADER = 'traceparent';

/** W3C trace state header */
export const TRACESTATE_HEADER = 'trace-state';

/** Maximum age for correlation IDs in milliseconds (5 minutes) */
const CORRELATION_ID_TTL_MS = 5 * 60 * 1000;

// ─── Traceparent Parsing ────────────────────────────────────────────────────────

/**
 * W3C traceparent format: version-traceid-spanid-traceflags
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 */
interface Traceparent {
  version: string;
  traceId: string;
  spanId: string;
  traceFlags: string;
}

/**
 * Parse W3C traceparent header.
 * @returns Parsed traceparent or null if invalid
 */
export function parseTraceparent(header: string): Traceparent | null {
  const parts = header.split('-');
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, spanId, traceFlags] = parts;

  // Version must be 00 for current spec
  if (version !== '00') {
    return null;
  }

  // traceId must be 32 hex chars
  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return null;
  }

  // spanId must be 16 hex chars
  if (!/^[0-9a-f]{16}$/i.test(spanId)) {
    return null;
  }

  // traceFlags must be 2 hex chars
  if (!/^[0-9a-f]{2}$/i.test(traceFlags)) {
    return null;
  }

  return { version, traceId, spanId, traceFlags };
}

/**
 * Generate a W3C traceparent header value.
 * @param traceId - Optional 32-char hex trace ID (generated if not provided)
 * @returns W3C traceparent string
 */
export function generateTraceparent(traceId?: string): string {
  const tid = traceId || newId('trace').replace(/_/g, '').slice(0, 32).padStart(32, '0');
  const spanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const flags = '01'; // sampled
  return `00-${tid}-${spanId}-${flags}`;
}

// ─── CorrelationManager Class ─────────────────────────────────────────────────

/**
 * Manages correlation IDs for request tracing across the MCP server.
 * Supports extraction from headers or generation of new IDs.
 */
export class CorrelationManager {
  private correlationId: string;
  private traceparent: Traceparent | null;
  private readonly createdAt: number;

  /**
   * Create a new CorrelationManager.
   * @param correlationId - Optional existing correlation ID (generated if not provided)
   * @param traceparent - Optional existing traceparent (parsed if provided)
   */
  constructor(correlationId?: string, traceparent?: string) {
    this.createdAt = Date.now();

    if (correlationId) {
      this.correlationId = correlationId;
      this.traceparent = traceparent ? parseTraceparent(traceparent) : null;
    } else if (traceparent) {
      const parsed = parseTraceparent(traceparent);
      if (parsed) {
        this.traceparent = parsed;
        this.correlationId = parsed.traceId;
      } else {
        // Invalid traceparent, generate new correlation ID
        this.correlationId = this.generateCorrelationId();
        this.traceparent = null;
      }
    } else {
      this.correlationId = this.generateCorrelationId();
      this.traceparent = null;
    }
  }

  /**
   * Generate a new UUID v4 correlation ID.
   */
  generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get the correlation ID.
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Get the traceparent if available.
   */
  getTraceparent(): Traceparent | null {
    return this.traceparent;
  }

  /**
   * Check if the correlation ID has expired.
   */
  isExpired(): boolean {
    return Date.now() - this.createdAt > CORRELATION_ID_TTL_MS;
  }

  /**
   * Extract correlation ID from request headers.
   * Checks X-Correlation-ID first, then falls back to traceparent.
   *
   * @param headers - Request headers (from Headers object or plain object)
   * @returns CorrelationManager instance
   */
  static fromHeaders(headers: Headers | Record<string, string>): CorrelationManager {
    // Try X-Correlation-ID first
    const correlationIdHeader = headers instanceof Headers
      ? headers.get(CORRELATION_ID_HEADER)
      : headers[CORRELATION_ID_HEADER];

    if (correlationIdHeader && correlationIdHeader.trim()) {
      return new CorrelationManager(correlationIdHeader.trim());
    }

    // Try traceparent
    const traceparentHeader = headers instanceof Headers
      ? headers.get(TRACEPARENT_HEADER)
      : headers[TRACEPARENT_HEADER];

    if (traceparentHeader && traceparentHeader.trim()) {
      return new CorrelationManager(undefined, traceparentHeader.trim());
    }

    // Generate new correlation ID
    return new CorrelationManager();
  }

  /**
   * Get all correlation headers to propagate to downstream services.
   */
  getPropagationHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      [CORRELATION_ID_HEADER]: this.correlationId,
    };

    if (this.traceparent) {
      headers[TRACEPARENT_HEADER] = `${this.traceparent.version}-${this.traceparent.traceId}-${this.traceparent.spanId}-${this.traceparent.traceFlags}`;
    }

    return headers;
  }
}

// ─── Context Integration ───────────────────────────────────────────────────────

/**
 * Extended invocation context with correlation ID support.
 */
export interface RequestContext extends InvocationContext {
  /** Correlation ID for distributed tracing */
  readonly correlationId: string;
  /** W3C traceparent if provided */
  readonly traceparent?: Traceparent;
  /** Timestamp when request was received */
  readonly receivedAt: string;
}

/**
 * Attach correlation ID to an existing InvocationContext.
 * Returns a new RequestContext with correlation data.
 *
 * @param ctx - Original invocation context
 * @param correlationManager - Correlation manager with ID data
 * @returns New RequestContext with correlation ID
 */
export function attachCorrelationToContext(
  ctx: InvocationContext,
  correlationManager: CorrelationManager
): RequestContext {
  return {
    ...ctx,
    correlationId: correlationManager.getCorrelationId(),
    traceparent: correlationManager.getTraceparent() ?? undefined,
    receivedAt: new Date().toISOString(),
  };
}

// ─── Logging Integration ───────────────────────────────────────────────────────

/**
 * Format correlation ID for logging.
 * @param correlationId - Correlation ID to format
 * @returns Formatted string for log context
 */
export function formatCorrelationForLog(correlationId: string): string {
  return `[corr=${correlationId.slice(0, 8)}...]`;
}

/**
 * Get correlation data for audit records.
 */
export interface CorrelationAuditData {
  correlationId: string;
  traceId: string;
  receivedAt: string;
  traceparentVersion?: string;
  traceFlags?: string;
}

/**
 * Extract correlation data for audit logging.
 */
export function extractCorrelationAuditData(ctx: RequestContext): CorrelationAuditData {
  return {
    correlationId: ctx.correlationId,
    traceId: ctx.traceId,
    receivedAt: ctx.receivedAt,
    traceparentVersion: ctx.traceparent?.version,
    traceFlags: ctx.traceparent?.traceFlags,
  };
}
