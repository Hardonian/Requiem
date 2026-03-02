/**
 * @fileoverview Centralized Secrets Redaction Pipeline
 * 
 * Provides comprehensive redaction for:
 * - Environment variables
 * - Log entries
 * - Error traces
 * - Bugreport bundles
 * - API tokens and keys
 * 
 * This module is the single source of truth for redaction patterns.
 * All output paths MUST go through this module to ensure no secrets leak.
 */

import type { LogEntry } from '../telemetry/logger.js';

// ─── Core Redaction Patterns ─────────────────────────────────────────────────

interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const CORE_PATTERNS: RedactionPattern[] = [
  // API Keys (generic)
  { name: 'api_key', pattern: /(['"](?:sk|pk|rk|ak|dk)[_-][a-zA-Z0-9]{20,})['"]/g, replacement: '"[REDACTED_API_KEY]"' },
  // Bearer tokens
  { name: 'bearer_token', pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/g, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Email addresses
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
  // Credit card numbers
  { name: 'credit_card', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[REDACTED_CC]' },
  // SSN-like patterns
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  // JWT tokens
  { name: 'jwt', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED_JWT]' },
  // AWS keys
  { name: 'aws_key', pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  // AWS secret keys
  { name: 'aws_secret', pattern: /(['"][a-zA-Z0-9/+=]{40}['"])/g, replacement: '"[REDACTED_AWS_SECRET]"' },
  // Private key headers
  { name: 'private_key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
  // GitHub tokens
  { name: 'github_token', pattern: /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9_]{36,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },
  // Slack tokens
  { name: 'slack_token', pattern: /xox[baprs]-[0-9]{10,}/g, replacement: '[REDACTED_SLACK_TOKEN]' },
  // Database connection strings
  { name: 'db_connection', pattern: /(?:mongodb|postgresql|mysql|redis):\/\/[^\s]+/g, replacement: '[REDACTED_DB_CONNECTION]' },
  // Generic secret patterns in key=value
  { name: 'secret_kv', pattern: /(?:secret|password|token|key|auth|credential)\s*[=:]\s*['"]?[a-zA-Z0-9_=-]{8,}['"]?/gi, replacement: '[REDACTED]' },
];

// ─── User-Defined Patterns ───────────────────────────────────────────────────

interface UserPattern {
  name: string;
  pattern: string;
  replacement: string;
}

let userPatterns: UserPattern[] = [];

/**
 * Add user-defined redaction patterns
 */
export function addUserPattern(pattern: UserPattern): void {
  try {
    // Validate regex
    new RegExp(pattern.pattern);
    userPatterns.push(pattern);
  } catch (e) {
    console.error(`[Redaction] Invalid user pattern: ${pattern.name}`);
  }
}

/**
 * Load user patterns from config
 */
export function loadUserPatterns(patterns: UserPattern[]): void {
  userPatterns = [];
  patterns.forEach(addUserPattern);
}

/**
 * Clear all user patterns
 */
export function clearUserPatterns(): void {
  userPatterns = [];
}

// ─── Core Redaction Functions ───────────────────────────────────────────────

/**
 * Apply all redaction patterns to a string value
 */
export function redactString(value: string): string {
  let result = value;
  
  // Apply core patterns
  for (const { pattern, replacement } of CORE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  
  // Apply user patterns
  for (const { pattern, replacement } of userPatterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, replacement);
    } catch {
      // Skip invalid patterns
    }
  }
  
  return result;
}

/**
 * Redact a string value (alias for backward compatibility)
 */
export function redact(value: string): string {
  return redactString(value);
}

/**
 * Deep-redact an object, applying patterns to all string values
 */
export function redactObject<T>(value: unknown): T {
  if (typeof value === 'string') return redactString(value) as T;
  if (Array.isArray(value)) return value.map(redactObject) as T;
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Redact keys that look like secret fields
      if (/^(password|secret|token|key|api_key|apikey|auth|credential|private)/i.test(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactObject(v);
      }
    }
    return result as T;
  }
  return value as T;
}

/**
 * Redact environment variables
 */
export function redactEnv(env: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  const secretKeys = /^(REQUIEM_|API_|SECRET|PASSWORD|TOKEN|KEY|AUTH|CREDENTIAL)/i;
  
  for (const [key, value] of Object.entries(env)) {
    if (secretKeys.test(key)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactString(value);
    }
  }
  
  return redacted;
}

// ─── Telemetry Redaction ─────────────────────────────────────────────────────

/**
 * Redact a log entry
 */
export function redactLogEntry(entry: LogEntry): LogEntry {
  return {
    ...entry,
    message: redactString(entry.message),
    ...(entry.trace_id && { trace_id: entry.trace_id }),
    ...(entry.tenant_id && { tenant_id: entry.tenant_id }),
  };
}

// ─── Error Redaction ─────────────────────────────────────────────────────────

/**
 * Redact an error object for safe logging
 */
export function redactError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: redactString(error.message),
    stack: error.stack ? redactString(error.stack) : undefined,
  };
}

/**
 * Create a redacted error suitable for external display
 */
export function createSafeError(message: string, code?: string): Record<string, unknown> {
  return {
    name: 'Error',
    message: redactString(message),
    code,
    // Never include stack traces in external errors
  };
}

// ─── Trace Redaction ─────────────────────────────────────────────────────────

/**
 * Redact trace data for safe storage/external display
 */
export function redactTrace(trace: Record<string, unknown>): Record<string, unknown> {
  return redactObject(trace);
}

// ─── Bugreport Redaction ─────────────────────────────────────────────────────

interface BugreportData {
  version: string;
  timestamp: string;
  platform: string;
  config: Record<string, unknown>;
  logs: unknown[];
  errors: unknown[];
  traces: unknown[];
  env: Record<string, string>;
}

/**
 * Redact a bugreport bundle for safe sharing
 */
export function redactBugreport(data: BugreportData): BugreportData {
  return {
    version: data.version,
    timestamp: data.timestamp,
    platform: data.platform,
    config: redactObject(data.config),
    logs: data.logs.map(l => redactObject(l)),
    errors: data.errors.map(e => redactError(e instanceof Error ? e : new Error(String(e)))),
    traces: data.traces.map(t => redactTrace(t as Record<string, unknown>)),
    env: redactEnv(data.env),
  };
}

// ─── Configuration Redaction ───────────────────────────────────────────────

/**
 * Known sensitive config keys to redact
 */
const SENSITIVE_CONFIG_KEYS = [
  'apiKey',
  'api_key',
  'apikey',
  'secret',
  'password',
  'token',
  'auth',
  'credential',
  'privateKey',
  'private_key',
  'accessKey',
  'access_key',
];

/**
 * Redact sensitive configuration values
 */
export function redactConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(config)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_CONFIG_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()));
    
    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactConfig(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      result[key] = redactString(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ─── Testing Utilities ─────────────────────────────────────────────────────

/**
 * Test if a string contains any redactable secrets
 * Useful for testing redaction completeness
 */
export function containsSecrets(value: string): boolean {
  // Check for any pattern match
  for (const { pattern } of CORE_PATTERNS) {
    if (pattern.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Inject fake secrets for testing redaction
 */
export function getFakeSecrets(): Record<string, string> {
  return {
    api_key: 'sk_test_51H7f8Q8K2vL3mN4pQ5rS6tU7vW8xY9zA0bC1dE2fG3',
    bearer_token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QifQ.test_signature',
    email: 'test@example.com',
    credit_card: '4111-1111-1111-1111',
    ssn: '123-45-6789',
    aws_key: 'AKIAIOSFODNN7EXAMPLE',
    github_token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    slack_token: 'xox[REDACTED]-1234567890123-1234567890123-AbCdEfGhIjKlMnOpQrStUvWx',
    db_connection: 'postgresql://user:password@localhost:5432/mydb',
    secret_kv: 'password=super_secret_password_123',
  };
}

export default {
  redactString,
  redact,
  redactObject,
  redactEnv,
  redactLogEntry,
  redactError,
  createSafeError,
  redactTrace,
  redactBugreport,
  redactConfig,
  addUserPattern,
  loadUserPatterns,
  clearUserPatterns,
  containsSecrets,
  getFakeSecrets,
};
