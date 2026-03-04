import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeFingerprint, persistFingerprintToCAS } from '../../packages/cli/src/lib/runtime-fingerprint.js';

describe('Runtime fingerprint', () => {
  it('creates and persists a fingerprint artifact in CAS', () => {
    const fingerprint = createRuntimeFingerprint();
    const persisted = persistFingerprintToCAS(fingerprint);

    assert.equal(typeof fingerprint.git_commit, 'string');
    assert.equal(persisted.digest.length, 64);
    assert.match(persisted.digest, /^[a-f0-9]{64}$/);
    assert.ok(persisted.objectPath.includes(persisted.digest));
  });
});
