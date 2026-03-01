/**
 * @fileoverview Structured Observability
 * 
 * Provides structured JSON events with:
 * - trace_id: Unique identifier for a trace
 * - run_id: Unique identifier for a run/execution
 * - schema_version: Version of the event schema
 * 
 * Events are stored in SQLite metadata + CAS blobs.
 * Optional exporter interface for external systems.
 */

import { randomBytes } from 'crypto';
import { redactObject, redactTrace } from '../memory/redaction';

// ─── Schema Version ─────────────────────────────────────────────────────────

export const OBSERVABILITY_SCHEMA_VERSION = 1;

// ─── Event Types ───────────────────────────────────────────────────────────

export type EventType = 
  | 'span_start'
  | 'span_end'
  | 'log'
  | 'metric'
  | 'error'
  | 'audit'
  | 'security_event';

// ─── Structured Event ─────────────────────────────────────────────────────

export interface StructuredEvent {
  // Required fields
  type: EventType;
  timestamp: string; // ISO 8601
  trace_id: string;
  run_id: string;
  seq: number;
  schema_version: number;
  
  // Optional fields
  span_id?: string;
  parent_span_id?: string;
  name?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
  data?: Record<string, unknown>;
  error?: Record<string, unknown>;
}

// ─── Trace Metadata ───────────────────────────────────────────────────────

export interface TraceMetadata {
  trace_id: string;
  run_id: string;
  tenant_id?: string;
  schema_version: number;
  started_at: string;
  ended_at?: string;
  status: 'running' | 'completed' | 'failed';
  metadata?: Record<string, unknown>;
}

// ─── Event Builder ─────────────────────────────────────────────────────────

class EventBuilder {
  private event: Partial<StructuredEvent>;
  
  constructor(traceId: string, runId: string, seq: number) {
    this.event = {
      trace_id: traceId,
      run_id: runId,
      seq,
      schema_version: OBSERVABILITY_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
  
  type(type: EventType): this {
    this.event.type = type;
    return this;
  }
  
  span(spanId: string, parentSpanId?: string): this {
    this.event.span_id = spanId;
    if (parentSpanId) {
      this.event.parent_span_id = parentSpanId;
    }
    return this;
  }
  
  name(name: string): this {
    this.event.name = name;
    return this;
  }
  
  level(level: 'debug' | 'info' | 'warn' | 'error'): this {
    this.event.level = level;
    return this;
  }
  
  message(message: string): this {
    this.event.message = message;
    return this;
  }
  
  data(data: Record<string, unknown>): this {
    // Redact sensitive data
    this.event.data = redactObject(data);
    return this;
  }
  
  error(error: Error): this {
    this.event.type = 'error';
    this.event.level = 'error';
    this.event.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
    return this;
  }
  
  build(): StructuredEvent {
    return this.event as StructuredEvent;
  }
}

// ─── Trace Context ─────────────────────────────────────────────────────────

export interface TraceContext {
  traceId: string;
  runId: string;
  tenantId?: string;
  seq: number;
}

// Current trace context (thread-local simulation)
let currentContext: TraceContext | null = null;

/**
 * Start a new trace
 */
export function startTrace(tenantId?: string): TraceContext {
  const traceId = generateTraceId();
  const runId = generateRunId();
  
  currentContext = {
    traceId,
    runId,
    tenantId,
    seq: 0,
  };
  
  // Emit span start event
  emit({
    type: 'span_start',
    name: 'trace',
    data: { tenantId },
  });
  
  return currentContext;
}

/**
 * Get current trace context
 */
export function getCurrentTrace(): TraceContext | null {
  return currentContext;
}

/**
 * Set current trace context
 */
export function setCurrentTrace(ctx: TraceContext): void {
  currentContext = ctx;
}

/**
 * End current trace
 */
export function endTrace(status: 'completed' | 'failed' = 'completed'): TraceMetadata | null {
  if (!currentContext) return null;
  
  emit({
    type: 'span_end',
    name: 'trace',
    data: { status },
  });
  
  const metadata: TraceMetadata = {
    trace_id: currentContext.traceId,
    run_id: currentContext.runId,
    tenant_id: currentContext.tenantId,
    schema_version: OBSERVABILITY_SCHEMA_VERSION,
    started_at: new Date().toISOString(), // Note: should track actual start
    ended_at: new Date().toISOString(),
    status,
  };
  
  currentContext = null;
  return metadata;
}

/**
 * Generate a new trace ID
 */
export function generateTraceId(): string {
  return `trace_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate a new run ID
 */
export function generateRunId(): string {
  return `run_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate a new span ID
 */
export function generateSpanId(): string {
  return randomBytes(8).toString('hex');
}

// ─── Event Emission ───────────────────────────────────────────────────────

type EventHandler = (event: StructuredEvent) => void;

const handlers: Set<EventHandler> = new Set();

/**
 * Register an event handler
 */
export function registerHandler(handler: EventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/**
 * Emit a structured event
 */
export function emit(event: Omit<StructuredEvent, 'trace_id' | 'run_id' | 'seq' | 'schema_version'>): StructuredEvent | null {
  if (!currentContext) {
    // No active trace, create a non-traced event
    const evt: StructuredEvent = {
      ...event,
      trace_id: 'none',
      run_id: 'none',
      seq: 0,
      schema_version: OBSERVABILITY_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
    };
    
    handlers.forEach(h => {
      try {
        h(evt);
      } catch (e) {
        console.error('[Observability] Handler error:', e);
      }
    });
    
    return evt;
  }
  
  currentContext.seq++;
  
  const evt: StructuredEvent = {
    ...event,
    trace_id: currentContext.traceId,
    run_id: currentContext.runId,
    seq: currentContext.seq,
    schema_version: OBSERVABILITY_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
  };
  
  handlers.forEach(h => {
    try {
      h(evt);
    } catch (e) {
      console.error('[Observability] Handler error:', e);
    }
  });
  
  return evt;
}

// ─── Convenience Functions ─────────────────────────────────────────────────

/**
 * Create a span within the current trace
 */
export function createSpan(name: string, parentSpanId?: string): string {
  const spanId = generateSpanId();
  
  emit({
    type: 'span_start',
    name,
    span_id: spanId,
    parent_span_id: parentSpanId,
  });
  
  return spanId;
}

/**
 * End a span
 */
export function endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
  emit({
    type: 'span_end',
    name: 'span',
    span_id: spanId,
    data: { status },
  });
}

/**
 * Log an event
 */
export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
  emit({
    type: 'log',
    level,
    message,
    data,
  });
}

/**
 * Record a metric
 */
export function metric(name: string, value: number, tags?: Record<string, string>): void {
  emit({
    type: 'metric',
    name,
    data: { value, tags },
  });
}

/**
 * Record an error
 */
export function recordError(error: Error, context?: Record<string, unknown>): void {
  emit({
    type: 'error',
    data: {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: redactTrace(context || {}),
    },
  });
}

/**
 * Record an audit event
 */
export function audit(action: string, actor: string, target: string, result: 'success' | 'failure', metadata?: Record<string, unknown>): void {
  emit({
    type: 'audit',
    data: {
      action,
      actor,
      target,
      result,
      metadata: redactObject(metadata || {}),
    },
  });
}

/**
 * Record a security event
 */
export function securityEvent(eventType: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, unknown>): void {
  emit({
    type: 'security_event',
    level: severity === 'critical' || severity === 'high' ? 'error' : 'warn',
    data: {
      event_type: eventType,
      severity,
      details: redactObject(details),
    },
  });
}

// ─── Serialization ─────────────────────────────────────────────────────────

/**
 * Serialize events to JSON for storage in CAS
 */
export function serializeEvents(events: StructuredEvent[]): string {
  return events.map(e => JSON.stringify(redactTrace(e))).join('\n');
}

/**
 * Deserialize events from JSON
 */
export function deserializeEvents(data: string): StructuredEvent[] {
  return data
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line) as StructuredEvent);
}

/**
 * Serialize trace metadata for SQLite
 */
export function serializeMetadata(metadata: TraceMetadata): string {
  return JSON.stringify(redactTrace(metadata));
}

/**
 * Deserialize trace metadata
 */
export function deserializeMetadata(data: string): TraceMetadata {
  return JSON.parse(data) as TraceMetadata;
}

export default {
  OBSERVABILITY_SCHEMA_VERSION,
  startTrace,
  getCurrentTrace,
  setCurrentTrace,
  endTrace,
  createSpan,
  endSpan,
  emit,
  log,
  metric,
  recordError,
  audit,
  securityEvent,
  registerHandler,
  EventBuilder,
  generateTraceId,
  generateRunId,
  generateSpanId,
  serializeEvents,
  deserializeEvents,
  serializeMetadata,
  deserializeMetadata,
};
