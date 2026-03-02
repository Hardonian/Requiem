/**
 * Invariant Test Suite — Branded Types
 *
 * Tests:
 * - Valid branded type creation
 * - Invalid branded type rejection (bad format)
 * - Type discrimination at runtime
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFingerprint,
  createPolicySnapshotHash,
  createRunId,
  createDecisionId,
  createJunctionId,
  createTenantId,
  createLedgerId,
  createCASDigest,
} from '../../packages/cli/src/lib/branded-types';

describe('Branded Types — Fingerprint', () => {
  it('should accept valid 64-char hex digest', () => {
    const valid = 'a1b2c3d4'.repeat(8);
    const fp = createFingerprint(valid);
    assert.equal(fp, valid);
  });

  it('should reject short strings', () => {
    assert.throws(
      () => createFingerprint('abc'),
      (err: Error) => err.message.includes('Invalid fingerprint'),
    );
  });

  it('should reject uppercase hex', () => {
    assert.throws(
      () => createFingerprint('A'.repeat(64)),
      (err: Error) => err.message.includes('Invalid fingerprint'),
    );
  });

  it('should reject non-hex characters', () => {
    assert.throws(
      () => createFingerprint('z'.repeat(64)),
      (err: Error) => err.message.includes('Invalid fingerprint'),
    );
  });
});

describe('Branded Types — PolicySnapshotHash', () => {
  it('should accept valid 64-char hex', () => {
    const valid = 'f'.repeat(64);
    const hash = createPolicySnapshotHash(valid);
    assert.equal(hash, valid);
  });

  it('should reject invalid format', () => {
    assert.throws(
      () => createPolicySnapshotHash('not-a-hash'),
      (err: Error) => err.message.includes('Invalid policy snapshot hash'),
    );
  });
});

describe('Branded Types — CASDigest', () => {
  it('should accept valid 64-char hex', () => {
    const valid = 'e'.repeat(64);
    const digest = createCASDigest(valid);
    assert.equal(digest, valid);
  });

  it('should reject invalid format', () => {
    assert.throws(
      () => createCASDigest('short'),
      (err: Error) => err.message.includes('Invalid CAS digest'),
    );
  });
});

describe('Branded Types — ID types', () => {
  it('should accept non-empty RunId', () => {
    const id = createRunId('run_001');
    assert.equal(id, 'run_001');
  });

  it('should reject empty RunId', () => {
    assert.throws(
      () => createRunId(''),
      (err: Error) => err.message.includes('RunId cannot be empty'),
    );
  });

  it('should accept non-empty DecisionId', () => {
    const id = createDecisionId('decision_abc');
    assert.equal(id, 'decision_abc');
  });

  it('should reject empty DecisionId', () => {
    assert.throws(
      () => createDecisionId(''),
      (err: Error) => err.message.includes('DecisionId cannot be empty'),
    );
  });

  it('should accept non-empty JunctionId', () => {
    const id = createJunctionId('junction_x');
    assert.equal(id, 'junction_x');
  });

  it('should reject empty JunctionId', () => {
    assert.throws(
      () => createJunctionId(''),
      (err: Error) => err.message.includes('JunctionId cannot be empty'),
    );
  });

  it('should accept non-empty TenantId', () => {
    const id = createTenantId('tenant_prod');
    assert.equal(id, 'tenant_prod');
  });

  it('should reject empty TenantId', () => {
    assert.throws(
      () => createTenantId(''),
      (err: Error) => err.message.includes('TenantId cannot be empty'),
    );
  });

  it('should accept non-empty LedgerId', () => {
    const id = createLedgerId('ledger_entry_1');
    assert.equal(id, 'ledger_entry_1');
  });

  it('should reject empty LedgerId', () => {
    assert.throws(
      () => createLedgerId(''),
      (err: Error) => err.message.includes('LedgerId cannot be empty'),
    );
  });
});
