import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalStringify } from '../src/canonical-json.js';
import { hashCanonical } from '../src/hash.js';

test('canonical JSON is stable across key order and timestamp forms', () => {
  const a = { b: 2, a: 1, ts: '2024-01-01T00:00:00.000Z' };
  const b = { ts: '2024-01-01T00:00:00Z', a: 1, b: 2 };
  assert.equal(canonicalStringify(a), canonicalStringify(b));
  assert.equal(hashCanonical(a), hashCanonical(b));
});

