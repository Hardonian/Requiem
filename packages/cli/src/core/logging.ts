/**
 * Structured Logging System
 * 
 * INVARIANT: No console.* in production code paths.
 * INVARIANT: All logs are structured JSON (or pretty for dev).
 * INVARIANT: Logs integrate with error system for correlation.
 */

import type { AppError, ErrorSeverity } from './errors.js';

// =============================================================================
// LOG LEVELS
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// =============================================================================
// LOG ENTRY TYPE
// =============================================================================

export interface LogFields {
  [key: string]: unknown;
}

export interface LogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Event name (kebab-case category) */
  event: string;
  /** Human message */
  message: string;
  /** Structured fields */
  fields?: LogFields;
  /** Error code if this is an error log */
  errorCode?: string;
  /** Trace ID for correlation */
  traceId?: string;
  /** Run/execution ID */
  runId?: string;
  /** Step ID within a run */
  stepId?: string;
  /** Component emitting the log */
  component?: string;
  /** Source file location (dev only) */
  source?: string;
}

// =============================================================================
// LOG SINK INTERFACE
// =============================================================================

export interface LogSink {
  write(entry: LogEntry): void;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}

// =============================================================================
// BUILT-IN SINKS
// =============================================================================

class ConsoleSink implements LogSink {
  private pretty: boolean;
  private minLevel: LogLevel;
  
  constructor(options: { pretty?: boolean; minLevel?: LogLevel } = {}) {
    this.pretty = options.pretty ?? false;
    this.minLevel = options.minLevel ?? 'debug';
  }
  
  write(entry: LogEntry): void {
    if (LOG_LEVEL_ORDER[entry.level] < LOG_LEVEL_ORDER[this.minLevel]) {
      return;
    }
    
    if (this.pretty) {
      this.writePretty(entry);
    } else {
      // Use console.error for stderr to not interfere with stdout JSON
      process.stderr.write(JSON.stringify(entry) + '\n');
    }
  }
  
  private writePretty(entry: LogEntry): void {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[90m',   // gray
      info: '\x1b[36m',    // cyan
      warn: '\x1b[33m',    // yellow
      error: '\x1b[31m',   // red
      fatal: '\x1b[35m',   // magenta
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level];
    
    const time = entry.timestamp.split('T')[1]?.replace('Z', '') ?? '';
    const prefix = `${color}[${entry.level.toUpperCase().padEnd(5)}]${reset} ${time}`;
    
    let line = `${prefix} ${entry.event}: ${entry.message}`;
    
    if (entry.traceId) {
      line += ` (trace=${entry.traceId.slice(0, 8)})`;
    }
    
    if (entry.fields && Object.keys(entry.fields).length > 0) {
      const fields = Object.entries(entry.fields)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      line += ` {${fields}}`;
    }
    
    process.stderr.write(line + '\n');
  }
}

class FileSink implements LogSink {
  private path: string;
  private stream: ReturnType<typeof import('fs')['createWriteStream']> | null = null;
  private fs: typeof import('fs') | null = null;
  
  constructor(path: string) {
    this.path = path;
  }
  
  private async init(): Promise<void> {
    if (this.stream) return;
    this.fs = await import('fs');
    this.stream = this.fs.createWriteStream(this.path, { flags: 'a' });
  }
  
  write(entry: LogEntry): void {
    if (!this.stream) {
      this.init().then(() => this.write(entry)).catch(() => {});
      return;
    }
    this.stream.write(JSON.stringify(entry) + '\n');
  }
  
  async flush(): Promise<void> {
    if (this.stream) {
      return new Promise((resolve) => {
        this.stream!.once('drain', resolve);
        setTimeout(resolve, 100);
      });
    }
  }
  
  async close(): Promise<void> {
    if (this.stream) {
      return new Promise((resolve) => {
        this.stream!.end(resolve);
      });
    }
  }
}

class MemorySink implements LogSink {
  private entries: LogEntry[] = [];
  private maxSize: number;
  
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }
  
  write(entry: LogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }
  }
  
  getEntries(): LogEntry[] {
    return [...this.entries];
  }
  
  clear(): void {
    this.entries = [];
  }
}

class MultiSink implements LogSink {
  private sinks: LogSink[];
  
  constructor(sinks: LogSink[]) {
    this.sinks = sinks;
  }
  
  write(entry: LogEntry): void {
    for (const sink of this.sinks) {
      try {
        sink.write(entry);
      } catch {
        // Silently drop errors in sinks to prevent infinite loops
      }
    }
  }
  
  async flush(): Promise<void> {
    await Promise.all(this.sinks.map(s => s.flush?.()));
  }
  
  async close(): Promise<void> {
    await Promise.all(this.sinks.map(s => s.close?.()));
  }
}

class FilterSink implements LogSink {
  private sink: LogSink;
  private predicate: (entry: LogEntry) => boolean;
  
  constructor(sink: LogSink, predicate: (entry: LogEntry) => boolean) {
    this.sink = sink;
    this.predicate = predicate;
  }
  
  write(entry: LogEntry): void {
    if (this.predicate(entry)) {
      this.sink.write(entry);
    }
  }
  
  flush?(): Promise<void> {
    return this.sink.flush?.() ?? Promise.resolve();
  }
  
  close?(): Promise<void> {
    return this.sink.close?.() ?? Promise.resolve();
  }
}

// =============================================================================
// LOGGER CONFIGURATION
// =============================================================================

interface LoggerConfig {
  level: LogLevel;
  pretty: boolean;
  sinks: LogSink[];
  defaultFields: LogFields;
  redactKeys: Set<string>;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  pretty: false,
  sinks: [new ConsoleSink()],
  defaultFields: {},
  redactKeys: new Set(['password', 'token', 'secret', 'key', 'authorization']),
};

let globalConfig: LoggerConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// REDACTION
// =============================================================================

function redactFields(fields: LogFields, redactKeys: Set<string>): LogFields {
  const redacted: LogFields = {};
  
  for (const [key, value] of Object.entries(fields)) {
    const lowerKey = key.toLowerCase();
    const shouldRedact = Array.from(redactKeys).some(rk => lowerKey.includes(rk));
    
    if (shouldRedact) {
      const valStr = String(value);
      redacted[key] = valStr.length > 10 
        ? `[REDACTED:${valStr.substring(0, 4)}...]` 
        : '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactFields(value as LogFields, redactKeys);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

// =============================================================================
// LOGGER CLASS
// =============================================================================

export class Logger {
  private config: LoggerConfig;
  private context: LogFields;
  
  constructor(config?: Partial<LoggerConfig>, context: LogFields = {}) {
    this.config = config ? { ...globalConfig, ...config } : globalConfig;
    this.context = context;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.config.level];
  }
  
  private log(level: LogLevel, event: string, message: string, fields?: LogFields): void {
    if (!this.shouldLog(level)) return;
    
    const mergedFields = { ...this.context, ...fields };
    const redactedFields = redactFields(mergedFields, this.config.redactKeys);
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      ...(Object.keys(redactedFields).length > 0 && { fields: redactedFields }),
    };
    
    for (const sink of this.config.sinks) {
      try {
        sink.write(entry);
      } catch {
        // Prevent sink failures from crashing the app
      }
    }
  }
  
  // Level-specific log methods
  debug(event: string, message: string, fields?: LogFields): void {
    this.log('debug', event, message, fields);
  }
  
  info(event: string, message: string, fields?: LogFields): void {
    this.log('info', event, message, fields);
  }
  
  warn(event: string, message: string, fields?: LogFields): void {
    this.log('warn', event, message, fields);
  }
  
  error(event: string, message: string, fields?: LogFields): void {
    this.log('error', event, message, fields);
  }
  
  fatal(event: string, message: string, fields?: LogFields): void {
    this.log('fatal', event, message, fields);
  }
  
  // Log with error correlation
  logError(event: string, error: AppError, extraFields?: LogFields): void {
    this.log(error.severity as LogLevel, event, error.message, {
      ...extraFields,
      errorCode: error.code,
      ...(error.traceId && { traceId: error.traceId }),
      ...(error.component && { component: error.component }),
      ...(error.details && { errorDetails: error.details }),
    });
  }
  
  // Create child logger with additional context
  withContext(context: LogFields): Logger {
    return new Logger(this.config, { ...this.context, ...context });
  }
  
  // Get current context
  getContext(): LogFields {
    return { ...this.context };
  }
}

// =============================================================================
// GLOBAL LOGGER INSTANCE
// =============================================================================

let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
  globalLogger = new Logger();
}

export function resetLogger(): void {
  globalConfig = { ...DEFAULT_CONFIG };
  globalLogger = null;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export const logger = {
  debug: (event: string, message: string, fields?: LogFields) => 
    getLogger().debug(event, message, fields),
  info: (event: string, message: string, fields?: LogFields) => 
    getLogger().info(event, message, fields),
  warn: (event: string, message: string, fields?: LogFields) => 
    getLogger().warn(event, message, fields),
  error: (event: string, message: string, fields?: LogFields) => 
    getLogger().error(event, message, fields),
  fatal: (event: string, message: string, fields?: LogFields) => 
    getLogger().fatal(event, message, fields),
  logError: (event: string, error: AppError, fields?: LogFields) => 
    getLogger().logError(event, error, fields),
};

// =============================================================================
// SINK EXPORTS
// =============================================================================

export const sinks = {
  console: (opts?: { pretty?: boolean; minLevel?: LogLevel }) => new ConsoleSink(opts),
  file: (path: string) => new FileSink(path),
  memory: (maxSize?: number) => new MemorySink(maxSize),
  multi: (...sinks: LogSink[]) => new MultiSink(sinks),
  filter: (sink: LogSink, predicate: (entry: LogEntry) => boolean) => 
    new FilterSink(sink, predicate),
};

// =============================================================================
// DEV/TEST HELPERS
// =============================================================================

export function enablePrettyLogs(level: LogLevel = 'debug'): void {
  configureLogger({
    level,
    pretty: true,
    sinks: [new ConsoleSink({ pretty: true, minLevel: level })],
  });
}

export function captureLogs<T>(fn: () => T): { result: T; logs: LogEntry[] } {
  const memorySink = new MemorySink();
  const testLogger = new Logger({
    level: 'debug',
    pretty: false,
    sinks: [memorySink],
    defaultFields: {},
    redactKeys: new Set(),
  });
  
  const originalLogger = globalLogger;
  globalLogger = testLogger;
  
  try {
    const result = fn();
    return { result, logs: memorySink.getEntries() };
  } finally {
    globalLogger = originalLogger;
  }
}

