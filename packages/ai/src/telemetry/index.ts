/**
 * @fileoverview Telemetry module public exports.
 */

export { logger, setLogSink, type LogLevel, type LogEntry } from './logger.js';
export { startSpan, endSpan, getSpansForTrace, withSpan, type Span, type SpanAttributes } from './trace.js';
export { writeAuditRecord, setAuditSink, type AuditSink } from './audit.js';
export { recordCost, recordToolCost, setCostSink, type CostRecord, type CostRecordInput } from './cost.js';
