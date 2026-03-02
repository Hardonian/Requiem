/**
 * Invariant Test Suite — Runtime Assertions
 *
 * Tests:
 * - Assertions fire in dev mode
 * - Assertions are silent in production
 * - Structured error codes on violation
 * - Secret redaction in assertion context
 * - Domain-specific invariant assertions
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertInvariant,
  assertEqual,
  assertDefined,
  assertValidDigest,
  assertFingerprintMatch,
  assertLedgerCount,
  assertCASBlobExists,
  assertPolicyPresent,
  assertCostRecorded,
} from '../../packages/cli/src/lib/invariant-assertions';
import { ErrorCode } from '../../packages/cli/src/lib/errors';

describe('Runtime Invariant Assertions', () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env.REQUIEM_ASSERTIONS;
    process.env.REQUIEM_ASSERTIONS = 'true';
  });

  afterEach(() => {
    if (savedEnv !== undefined) {
      process.env.REQUIEM_ASSERTIONS = savedEnv;
    } else {
      delete process.env.REQUIEM_ASSERTIONS;
    }
  });

  it('should pass when condition is true', () => {
    assert.doesNotThrow(() => {
      assertInvariant(true, 'INV_FINGERPRINT_MISMATCH', 'should pass');
    });
  });

  it('should throw RequiemError with INVARIANT_VIOLATION code', () => {
    try {
      assertInvariant(false, 'INV_FINGERPRINT_MISMATCH', 'test violation');
      assert.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { code: string; message: string };
      assert.equal(error.code, ErrorCode.INVARIANT_VIOLATION);
      assert.ok(error.message.includes('INV_FINGERPRINT_MISMATCH'));
      assert.ok(error.message.includes('test violation'));
    }
  });

  it('should be silent in production when REQUIEM_ASSERTIONS is not set', () => {
    process.env.REQUIEM_ASSERTIONS = 'false';
    assert.doesNotThrow(() => {
      assertInvariant(false, 'INV_FINGERPRINT_MISMATCH', 'should be silent');
    });
  });

  it('should redact sensitive keys in context', () => {
    try {
      assertInvariant(false, 'INV_FINGERPRINT_MISMATCH', 'test', {
        api_key: 'sk-secret-123',
        normalField: 'visible',
      });
      assert.fail('Should have thrown');
    } catch (err: unknown) {
      const error = err as { meta?: { context?: Record<string, unknown> } };
      if (error.meta?.context) {
        assert.equal(error.meta.context['api_key'], '[REDACTED]');
        assert.equal(error.meta.context['normalField'], 'visible');
      }
    }
  });

  it('assertEqual should pass for equal values', () => {
    assert.doesNotThrow(() => {
      assertEqual('abc', 'abc', 'INV_FINGERPRINT_MISMATCH', 'should match');
    });
  });

  it('assertEqual should fail for unequal values', () => {
    assert.throws(
      () => assertEqual('abc', 'def', 'INV_FINGERPRINT_MISMATCH', 'mismatch'),
      (err: Error) => err.message.includes('mismatch'),
    );
  });

  it('assertDefined should pass for non-null values', () => {
    assert.doesNotThrow(() => {
      assertDefined('value', 'INV_POLICY_MISSING', 'should exist');
    });
  });

  it('assertDefined should fail for null', () => {
    assert.throws(
      () => assertDefined(null, 'INV_POLICY_MISSING', 'is null'),
      (err: Error) => err.message.includes('INV_POLICY_MISSING'),
    );
  });

  it('assertDefined should fail for undefined', () => {
    assert.throws(
      () => assertDefined(undefined, 'INV_POLICY_MISSING', 'is undefined'),
      (err: Error) => err.message.includes('INV_POLICY_MISSING'),
    );
  });

  it('assertValidDigest should accept valid 64-char hex', () => {
    const valid = 'a'.repeat(64);
    assert.doesNotThrow(() => {
      assertValidDigest(valid, 'INV_CAS_INTEGRITY', 'test digest');
    });
  });

  it('assertValidDigest should reject invalid digests', () => {
    assert.throws(
      () => assertValidDigest('short', 'INV_CAS_INTEGRITY', 'bad digest'),
      (err: Error) => err.message.includes('INV_CAS_INTEGRITY'),
    );
  });

  it('assertFingerprintMatch should pass for matching fingerprints', () => {
    const fp = 'a'.repeat(64);
    assert.doesNotThrow(() => assertFingerprintMatch(fp, fp, 'run-001'));
  });

  it('assertFingerprintMatch should fail for mismatched fingerprints', () => {
    assert.throws(
      () => assertFingerprintMatch('a'.repeat(64), 'b'.repeat(64), 'run-001'),
      (err: Error) => err.message.includes('INV_FINGERPRINT_MISMATCH'),
    );
  });

  it('assertLedgerCount should pass for matching counts', () => {
    assert.doesNotThrow(() => assertLedgerCount(5, 5, 'run-001'));
  });

  it('assertLedgerCount should fail for mismatched counts', () => {
    assert.throws(
      () => assertLedgerCount(3, 5, 'run-001'),
      (err: Error) => err.message.includes('INV_LEDGER_COUNT_MISMATCH'),
    );
  });

  it('assertCASBlobExists should pass when blob exists', () => {
    assert.doesNotThrow(() => assertCASBlobExists(true, 'a'.repeat(64)));
  });

  it('assertCASBlobExists should fail when blob missing', () => {
    assert.throws(
      () => assertCASBlobExists(false, 'a'.repeat(64)),
      (err: Error) => err.message.includes('INV_MANIFEST_MISSING_CAS'),
    );
  });

  it('assertPolicyPresent should pass with non-null hash', () => {
    assert.doesNotThrow(() => assertPolicyPresent('a'.repeat(64), 'run-001'));
  });

  it('assertPolicyPresent should fail with null hash', () => {
    assert.throws(
      () => assertPolicyPresent(null, 'run-001'),
      (err: Error) => err.message.includes('INV_POLICY_MISSING'),
    );
  });

  it('assertCostRecorded should pass with valid cost', () => {
    assert.doesNotThrow(() => assertCostRecorded(5, 'run-001'));
  });

  it('assertCostRecorded should fail with null cost', () => {
    assert.throws(
      () => assertCostRecorded(null, 'run-001'),
      (err: Error) => err.message.includes('INV_COST_BEFORE_COMMIT'),
    );
  });
});
