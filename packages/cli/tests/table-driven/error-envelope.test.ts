/**
 * Error Envelope Format Tests
 *
 * Validates error envelope structure and consistency.
 * Part of Industrialization Pass - Section 2.1
 */

import { describe, it, expect } from 'vitest';
import { err, wrap, toJSONObject, formatHuman, isAppError, Errors } from '../../src/core/errors.js';

describe('Error Envelope Format', () => {
  it('should create error with all required fields', () => {
    const error = err('E_DB_CONNECTION_FAILED', 'Database connection failed');

    expect(error.code).toBe('E_DB_CONNECTION_FAILED');
    expect(error.message).toBe('Database connection failed');
    expect(error.severity).toBe('error');
    expect(error.isRetryable).toBe(false);
    expect(error.isRedactionSafe).toBe(false);
    expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should create error with custom options', () => {
    const error = err('E_POL_VIOLATION', 'Policy denied', {
      severity: 'fatal',
      isRetryable: true,
      tags: ['policy', 'budget'],
      details: { budgetId: '123' },
    });

    expect(error.severity).toBe('fatal');
    expect(error.isRetryable).toBe(true);
    expect(error.tags).toEqual(['policy', 'budget']);
    expect(error.details).toEqual({ budgetId: '123' });
  });

  it('should wrap native errors', () => {
    const nativeError = new Error('Connection timeout');
    const wrapped = wrap(nativeError, 'Database operation failed');

    expect(wrapped.code).toBe('E_UNKNOWN');
    expect(wrapped.message).toBe('Database operation failed: Connection timeout');
    expect(wrapped.cause).toBe(nativeError);
  });

  it('should wrap AppError without losing context', () => {
    const original = err('E_DB_NOT_FOUND', 'Record not found');
    const wrapped = wrap(original, 'User lookup failed');

    expect(wrapped.code).toBe('E_DB_NOT_FOUND');
    expect(wrapped.message).toBe('User lookup failed: Record not found');
  });

  it('should serialize to JSON object correctly', () => {
    const error = err('E_POL_QUOTA_EXCEEDED', 'Quota exceeded', {
      severity: 'warn',
      details: { quota: 100, used: 150 },
      traceId: 'trace-123',
    });

    const json = toJSONObject(error);

    expect(json.code).toBe('E_POL_QUOTA_EXCEEDED');
    expect(json.message).toBe('Quota exceeded');
    expect(json.severity).toBe('warn');
    expect(json.traceId).toBe('trace-123');
    expect(json.details).toEqual({ quota: 100, used: 150 });
  });

  it('should redact sensitive data in safe mode', () => {
    const error = err('E_CFG_INVALID', 'Invalid config', {
      details: {
        apiKey: 'secret-key-12345',
        password: 'my-password',
        normalField: 'visible',
      },
    });

    const json = toJSONObject(error, true);

    expect(json.details.normalField).toBe('visible');
    // Sensitive fields should be redacted
    expect(json.details.apiKey).toContain('REDACTED');
    expect(json.details.password).toContain('REDACTED');
  });

  it('should format human-readable output', () => {
    const error = err('E_IO_NOT_FOUND', 'File not found', {
      remediation: ['Check the file path', 'Verify permissions'],
      traceId: 'trace-abc',
    });

    const formatted = formatHuman(error);

    expect(formatted).toContain('[E_IO_NOT_FOUND] File not found');
    expect(formatted).toContain('Remediation:');
    expect(formatted).toContain('Check the file path');
    expect(formatted).toContain('Trace ID: trace-abc');
  });

  it('should identify AppError correctly', () => {
    const appError = err('E_UNKNOWN', 'Test');
    const nativeError = new Error('Test');
    const plainObj = { code: 'E_TEST', message: 'Test' };

    expect(isAppError(appError)).toBe(true);
    expect(isAppError(nativeError)).toBe(false);
    expect(isAppError(plainObj)).toBe(false);
  });
});

describe('Error Code Taxonomy', () => {
  const errorCategories = [
    { code: 'E_CFG_INVALID', category: 'config' },
    { code: 'E_DB_CONNECTION_FAILED', category: 'database' },
    { code: 'E_CAS_INTEGRITY_FAILED', category: 'cas' },
    { code: 'E_SIG_INVALID', category: 'signing' },
    { code: 'E_POL_VIOLATION', category: 'policy' },
    { code: 'E_PROV_UNAVAILABLE', category: 'provider' },
    { code: 'E_NET_TIMEOUT', category: 'network' },
    { code: 'E_IO_NOT_FOUND', category: 'io' },
    { code: 'E_INT_DETERMINISM_VIOLATION', category: 'invariant' },
    { code: 'E_WEB_ROUTE_NOT_FOUND', category: 'web' },
  ];

  errorCategories.forEach(({ code, category }) => {
    it(`should have ${code} in ${category} category`, () => {
      const error = err(code as any, 'Test message');
      expect(error.code).toBe(code);
      expect(error.code.toLowerCase()).toContain(category.substring(0, 3).toLowerCase());
    });
  });
});

describe('Predefined Error Helpers', () => {
  it('should create notFound error with remediation', () => {
    const error = Errors.notFound('User', '123');

    expect(error.code).toBe('E_IO_NOT_FOUND');
    expect(error.message).toContain("User '123' not found");
    expect(error.remediation).toHaveLength(2);
  });

  it('should create rateLimited error with retry info', () => {
    const error = Errors.rateLimited(60);

    expect(error.code).toBe('E_POL_RATE_LIMITED');
    expect(error.isRetryable).toBe(true);
    expect(error.details).toEqual({ retryAfter: 60 });
  });

  it('should create determinism error as fatal', () => {
    const error = Errors.determinism('Hash mismatch', 'trace-123');

    expect(error.code).toBe('E_INT_DETERMINISM_VIOLATION');
    expect(error.severity).toBe('fatal');
    expect(error.traceId).toBe('trace-123');
  });
});
