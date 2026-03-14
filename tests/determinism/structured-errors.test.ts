import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { problemFromError } from '../../packages/adapters/sdk/index.js';

describe('structured errors', () => {
  it('returns problem+json envelope fields', () => {
    const p = problemFromError(new Error('boom'), 'trace-123');
    assert.equal(p.trace_id, 'trace-123');
    assert.ok(typeof p.title === 'string');
    assert.ok(typeof p.detail === 'string' || typeof p.message === 'string');
  });
});
