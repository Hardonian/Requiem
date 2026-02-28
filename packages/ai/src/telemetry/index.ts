/**
 * @fileoverview Telemetry module public exports.
 */

export { logger, setLogSink, type LogLevel, type LogEntry } from './logger';
export { startSpan, endSpan, getSpansForTrace, withSpan, type Span, type SpanAttributes } from './trace';
export { writeAuditRecord, setAuditSink, type AuditSink } from './audit';
export { recordCost, recordToolCost, setCostSink, type CostRecord, type CostRecordInput } from './cost';
