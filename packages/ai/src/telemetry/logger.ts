/**
 * @fileoverview Structured logger for the AI control-plane.
 *
 * Provides leveled logging with structured metadata.
 * In production, swap console output for pino/winston by replacing the sink.
 *
 * INVARIANT: NEVER log secrets, tokens, or PII.
 * INVARIANT: All log entries include timestamp + traceId when available.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  trace_id?: string;
  tenant_id?: string;
  [key: string]: unknown;
}

export type LogSink = (entry: LogEntry) => void;

let _sink: LogSink = (entry) => {
  const { level, message, timestamp, ...rest } = entry;
  const meta = Object.keys(rest).length > 0 ? ' ' + JSON.stringify(rest) : '';
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${meta}`);
};

/** Override the log sink (e.g., for pino integration or test capture). */
export function setLogSink(sink: LogSink): void {
  _sink = sink;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  _sink({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  });
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
