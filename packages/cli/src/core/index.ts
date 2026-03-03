/**
 * Core Module
 * 
 * Unified error system + structured logging + CLI helpers.
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

// Exit codes
export {
  ExitCode,
  type ExitCodeValue,
  errorToExitCode,
  describeExitCode,
  type StructuredError,
  normalizeError,
} from './exit-codes.js';

// CLI Helpers
export {
  // Types
  type CLIError,
  type HelpTemplate,
  
  // JSON formatting
  deterministicJson,
  stableSortKeys,
  
  // Error handling
  createError,
  formatError,
  formatSuccess,
  handleCliError,
  
  // Help generation
  generateHelp,
  
  // Error codes
  ErrorCodes,
  ErrorHints,
} from './cli-helpers.js';
