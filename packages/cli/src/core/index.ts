/**
 * Core Module
 * 
 * Unified error system + structured logging.
 * No console.* in production paths.
 */

// Errors
export {
  // Types
  type ErrorCode,
  type ErrorSeverity,
  type AppError,
  type AppErrorDetails,
  
  // Constants
  ERROR_CATEGORIES,
  SEVERITY_ORDER,
  
  // Factory functions
  err,
  wrap,
  isAppError,
  
  // Serialization
  toJSON,
  toJSONObject,
  formatHuman,
  toHttpStatus,
  
  // Redaction
  sanitizeValue,
  sanitizeError,
  
  // Predefined errors
  Errors,
  
  // Assertions
  assertInvariant,
  assertDefined,
} from './errors.js';

// Logging
export {
  // Types
  type LogLevel,
  type LogEntry,
  type LogFields,
  type LogSink,
  
  // Logger class
  Logger,
  
  // Global logger
  getLogger,
  configureLogger,
  resetLogger,
  logger,
  
  // Sinks
  sinks,
  
  // Dev helpers
  enablePrettyLogs,
  captureLogs,
} from './logging.js';
