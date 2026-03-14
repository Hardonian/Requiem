import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashDomain, canonicalStringify } from '../../packages/hash/src/canonical_hash.js';

describe('event chain integrity', () => {
  it('links prev hash deterministically', () => {
    const events = [
      { seq: 1, action: 'start', prev: '0'.repeat(64) },
      { seq: 2, action: 'step', prev: '' },
      { seq: 3, action: 'done', prev: '' },
    ];
    for (let i = 1; i < events.length; i++) {
      events[i].prev = hashDomain('evt:', canonicalStringify(events[i - 1]));
    }
    for (let i = 1; i < events.length; i++) {
      assert.equal(events[i].prev, hashDomain('evt:', canonicalStringify(events[i - 1])));
    }
  });
});
