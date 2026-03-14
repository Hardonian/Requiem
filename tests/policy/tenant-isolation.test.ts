import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashCanonical } from '../../packages/hash/src/canonical_hash.js';

describe('tenant isolation fingerprinting', () => {
  it('includes tenant identity in deterministic fingerprints', () => {
    const a = hashCanonical({ tenant: 'tenant-a', req: 'x' });
    const b = hashCanonical({ tenant: 'tenant-b', req: 'x' });
    assert.notEqual(a, b);
  });
});
