/**
 * @fileoverview Telemetry module public exports.
 */

export { logger, setLogSink, type LogLevel, type LogEntry } from './logger.js';
export { startSpan, endSpan, getSpansForTrace, withSpan, type Span, type SpanAttributes } from './trace.js';
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
} from './audit.js';
export {
  type DatabaseAuditSinkConfig,
  createDefaultAuditSink,
} from './auditSink.js';
export {
  MerkleAuditChain,
  getGlobalMerkleChain,
  computeChainHash,
  GENESIS_HASH,
  _resetMerkleChain,
} from './merkleChain.js';
export { recordCost, recordToolCost, setCostSink, type CostRecord, type CostRecordInput } from './cost.js';
export {
  TraceAnalytics,
  computeTraceMetrics,
  detectTraceAnomalies,
  type TraceRecord,
  type TraceMetrics,
  type TraceAnomaly,
  type TraceAnomalyThresholds,
} from './traceAnalytics.js';
export {
  recordTiming,
  flushTimingHistogram,
  flushAllTimingHistograms,
  captureMemorySnapshot,
  calculateMemoryDelta,
  logMemoryDelta,
  withMemoryTracking,
  recordCasHit,
  recordCasMiss,
  getCasMetrics,
  flushCasMetrics,
  logReplayVerification,
  recordReplaySuccess,
  recordReplayFailure,
  flushAllMetrics,
  startMetricsFlush,
  stopMetricsFlush,
  type TimingHistogram,
  type MemorySnapshot,
  type MemoryDelta,
  type CasMetrics,
  type ReplayVerification,
} from './metrics.js';
export {
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
  type StructuredEvent,
  type TraceMetadata,
  type TraceContext,
  type EventType,
} from './structured.js';
