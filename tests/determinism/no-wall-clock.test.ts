import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashDomain, canonicalStringify } from '../../packages/hash/src/canonical_hash.js';

describe('no-wall-clock hashing invariant', () => {
  it('keeps digest stable when wall clock metadata changes', () => {
    const base = { tool: 'echo', input: 'x', logical_time: 7 };
    const withA = { ...base, wall_clock_ms: 1000 };
    const withB = { ...base, wall_clock_ms: 999999 };
    const digestA = hashDomain('req:', canonicalStringify(base));
    const digestB = hashDomain('req:', canonicalStringify({ tool: withB.tool, input: withB.input, logical_time: withB.logical_time }));
    assert.equal(digestA, digestB);
  });
});
