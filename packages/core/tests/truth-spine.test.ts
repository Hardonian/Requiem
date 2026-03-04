import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalize, hashObject, stableSort, buildProblemJSON } from '../src/truth-spine.js';

test('canonicalize is stable for object key order', () => {
  const a = { b: 2, a: 1, nested: { z: 1, y: 2 } };
  const b = { nested: { y: 2, z: 1 }, a: 1, b: 2 };
  assert.equal(canonicalize(a), canonicalize(b));
  assert.equal(hashObject(a), hashObject(b));
});

test('stableSort preserves original order for equal keys', () => {
  const input = [
    { rank: 1, id: 'a' },
    { rank: 2, id: 'b' },
    { rank: 2, id: 'c' },
  ];
  const sorted = stableSort(input, (x, y) => x.rank - y.rank);
  assert.deepEqual(sorted.map((x) => x.id), ['a', 'b', 'c']);
});

test('buildProblemJSON generates deterministic problem payload', () => {
  const payload = buildProblemJSON({
    status: 409,
    title: 'Proof dependencies missing',
    detail: 'Required proof packs are not available',
    traceId: 'trace-1',
    code: 'proof_dependencies_missing',
    reasons: ['determinism', 'integrity'],
  });

  assert.equal(payload.status, 409);
  assert.equal(payload.trace_id, 'trace-1');
  assert.deepEqual(payload.reasons, ['determinism', 'integrity']);
});
