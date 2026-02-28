/**
 * @fileoverview Trace span system for AI operation observability.
 *
 * Provides start/end spans with parent/child relationships and attributes.
 * In-memory by default; extend with OTEL exporter for production.
 *
 * INVARIANT: Every skill run starts a root span.
 * INVARIANT: Every tool invocation creates a child span.
 */

import { newId } from '../types/index.js';
import { logger } from './logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface Span {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly startedAt: string;
  endedAt?: string;
  durationMs?: number;
  readonly attributes: SpanAttributes;
  status: 'running' | 'ok' | 'error';
  errorMessage?: string;
}

// ─── In-memory store ──────────────────────────────────────────────────────────

const _spans: Map<string, Span> = new Map();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a new trace span.
 */
export function startSpan(
  name: string,
  traceId: string,
  attributes?: SpanAttributes,
  parentSpanId?: string
): Span {
  const span: Span = {
    spanId: newId('span'),
    traceId,
    parentSpanId,
    name,
    startedAt: new Date().toISOString(),
    attributes: attributes ?? {},
    status: 'running',
  };
  _spans.set(span.spanId, span);
  logger.debug(`[trace] span started: ${name}`, { span_id: span.spanId, trace_id: traceId });
  return span;
}

/**
 * End a span, recording duration and status.
 */
export function endSpan(span: Span, error?: Error): Span {
  const now = Date.now();
  const startMs = new Date(span.startedAt).getTime();
  span.endedAt = new Date().toISOString();
  span.durationMs = now - startMs;
  span.status = error ? 'error' : 'ok';
  if (error) span.errorMessage = error.message;

  logger.debug(`[trace] span ended: ${span.name}`, {
    span_id: span.spanId,
    trace_id: span.traceId,
    duration_ms: span.durationMs,
    status: span.status,
  });
  return span;
}

/**
 * Get all spans for a trace ID (for debugging/eval).
 */
export function getSpansForTrace(traceId: string): Span[] {
  return Array.from(_spans.values()).filter(s => s.traceId === traceId);
}

/**
 * Convenience: run fn inside a span, auto-ending on completion or error.
 */
export async function withSpan<T>(
  name: string,
  traceId: string,
  fn: (span: Span) => Promise<T>,
  attributes?: SpanAttributes,
  parentSpanId?: string
): Promise<T> {
  const span = startSpan(name, traceId, attributes, parentSpanId);
  try {
    const result = await fn(span);
    endSpan(span);
    return result;
  } catch (err) {
    endSpan(span, err instanceof Error ? err : new Error(String(err)));
    throw err;
  }
}
