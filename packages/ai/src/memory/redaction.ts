/**
 * @fileoverview PII and secret redaction for memory storage.
 *
 * Applied before content is hashed or stored.
 * INVARIANT: Redaction patterns are applied to all memory items.
 */

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API Keys
  { pattern: /(['"](sk|pk|rk|ak|dk)[_-][a-zA-Z0-9]{20,}['"])/g, replacement: '"[REDACTED_API_KEY]"' },
  // Bearer tokens
  { pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/g, replacement: 'Bearer [REDACTED_TOKEN]' },
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
  // Credit card numbers (basic pattern)
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[REDACTED_CC]' },
  // SSN-like patterns
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
  // JWT tokens
  { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[REDACTED_JWT]' },
  // AWS keys
  { pattern: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED_AWS_KEY]' },
  // Private key headers
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED_PRIVATE_KEY]' },
];

/**
 * Apply redaction patterns to a string value.
 */
export function redactString(value: string): string {
  let result = value;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Deep-redact an object, applying patterns to all string values.
 */
export function redactObject(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactObject);
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Also redact keys that look like secret fields
      if (/^(password|secret|token|key|api_key|apikey|auth|credential)/i.test(k)) {
        result[k] = '[REDACTED]';
      } else {
        result[k] = redactObject(v);
      }
    }
    return result;
  }
  return value;
}
