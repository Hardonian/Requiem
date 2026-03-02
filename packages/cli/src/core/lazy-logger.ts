/**
 * Lazy Logger - Observability Without Cost
 * 
 * Features:
 * - Lazy field evaluation (functions only called if log level allows)
 * - Respects log level strictly
 * - No heavy serialization when debug is off
 * - Structured JSON output in production
 * - Pretty output in development
 */

import { env, stdout, stderr } from 'process';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

interface LogEntry {
  level: LogLevel;
  event: string;
  message?: string;
  timestamp: string;
  traceId?: string;
  [key: string]: unknown;
}

type LazyValue = () => unknown;

interface LogContext {
  [key: string]: unknown | LazyValue;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

class LazyLogger {
  private level: LogLevel;
  private pretty: boolean;
  private traceId: string | null = null;

  constructor() {
    this.level = this.detectLevel();
    this.pretty = env.NODE_ENV === 'development' || env.REQUIEM_DEBUG === '1';
  }

  private detectLevel(): LogLevel {
    const envLevel = env.REQUIEM_LOG_LEVEL?.toLowerCase() as LogLevel;
    if (envLevel && envLevel in LOG_LEVELS) {
      return envLevel;
    }
    return env.NODE_ENV === 'production' ? 'info' : 'debug';
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setTraceId(id: string): void {
    this.traceId = id;
  }

  setPretty(pretty: boolean): void {
    this.pretty = pretty;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private evaluateContext(context: LogContext): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'function') {
        // Lazy evaluation - only call if needed
        try {
          result[key] = value();
        } catch (err) {
          result[key] = `[Error evaluating: ${err}]`;
        }
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private formatOutput(entry: LogEntry): string {
    if (this.pretty) {
      const color = this.getColor(entry.level);
      const reset = '\x1b[0m';
      const timestamp = entry.timestamp.split('T')[1].split('.')[0];
      return `${color}[${timestamp}] ${entry.level.toUpperCase()}: ${entry.event}${reset}${entry.message ? ' - ' + entry.message : ''}`;
    }
    return JSON.stringify(entry);
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[36m'; // Cyan
      case 'info': return '\x1b[32m';  // Green
      case 'warn': return '\x1b[33m';  // Yellow
      case 'error': return '\x1b[31m'; // Red
      default: return '';
    }
  }

  private log(level: LogLevel, event: string, message?: string, context: LogContext = {}): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      event,
      message,
      timestamp: new Date().toISOString(),
      traceId: this.traceId || undefined,
      ...this.evaluateContext(context),
    };

    const output = this.formatOutput(entry);
    
    if (level === 'error') {
      stderr.write(output + '\n');
    } else {
      stdout.write(output + '\n');
    }
  }

  debug(event: string, message?: string, context?: LogContext): void {
    this.log('debug', event, message, context);
  }

  info(event: string, message?: string, context?: LogContext): void {
    this.log('info', event, message, context);
  }

  warn(event: string, message?: string, context?: LogContext): void {
    this.log('warn', event, message, context);
  }

  error(event: string, message?: string, context?: LogContext): void {
    this.log('error', event, message, context);
  }

  // Lazy evaluation helper - wraps expensive computations
  lazy<T>(fn: () => T): LazyValue {
    return fn;
  }

  // Performance timing helper
  time<T>(event: string, fn: () => T): T {
    if (!this.shouldLog('debug')) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.debug(`${event}_complete`, undefined, { durationMs: Math.round(duration) });
      return result;
    } catch (err) {
      const duration = performance.now() - start;
      this.error(`${event}_failed`, String(err), { durationMs: Math.round(duration) });
      throw err;
    }
  }

  // Async performance timing
  async timeAsync<T>(event: string, fn: () => Promise<T>): Promise<T> {
    if (!this.shouldLog('debug')) {
      return fn();
    }

    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.debug(`${event}_complete`, undefined, { durationMs: Math.round(duration) });
      return result;
    } catch (err) {
      const duration = performance.now() - start;
      this.error(`${event}_failed`, String(err), { durationMs: Math.round(duration) });
      throw err;
    }
  }
}

// Export singleton
export const logger = new LazyLogger();

// Enable pretty logs for development
export function enablePrettyLogs(level?: LogLevel): void {
  logger.setPretty(true);
  if (level) {
    logger.setLevel(level);
  }
}

// Log error with proper formatting
export function logError(event: string, error: unknown, context?: LogContext): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(event, message, context);
}
