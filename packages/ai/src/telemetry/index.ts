/**
 * @fileoverview Telemetry module public exports.
 */

export { logger, setLogSink, type LogLevel, type LogEntry } from './logger';
export { startSpan, endSpan, getSpansForTrace, withSpan, type Span, type SpanAttributes } from './trace';
export {
  writeAuditRecord,
  flushAuditLog,
  setAuditSink,
  getAuditPersistence,
  AUDIT_PERSISTENCE,
  type AuditSink,
  type AuditPersistence,
  type IAuditSink,
  type TenantAuditRecord,
  InMemoryAuditSink,
  FileAuditSink,
  DatabaseAuditSink,
  CompositeSink,
} from './audit';
export {
  type DatabaseAuditSinkConfig,
  createDefaultAuditSink,
} from './auditSink';
export {
  MerkleAuditChain,
  getGlobalMerkleChain,
  computeChainHash,
  GENESIS_HASH,
  _resetMerkleChain,
} from './merkleChain';
export { recordCost, recordToolCost, setCostSink, type CostRecord, type CostRecordInput } from './cost';
export {
  TraceAnalytics,
  computeTraceMetrics,
  detectTraceAnomalies,
  type TraceRecord,
  type TraceMetrics,
  type TraceAnomaly,
  type TraceAnomalyThresholds,
} from './traceAnalytics';
