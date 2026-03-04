import assert from 'node:assert/strict';

import { createDefaultAdapters } from '../../packages/adapters/index.js';
import { problemFromError } from '../../packages/adapters/sdk/index.js';

function run() {
  const adapters = createDefaultAdapters();
  const fixture = {
    action: 'opened',
    repository: 'reachhq/requiem',
    token: 'secret-token',
  };

  // deterministic normalization
  const first = adapters.github.normalize(fixture);
  const second = adapters.github.normalize(fixture);
  assert.equal(first.artifacts[0]?.cas_ref, second.artifacts[0]?.cas_ref);

  // no secret leakage
  const redacted = adapters.github.redact(fixture) as Record<string, string>;
  assert.equal(redacted.token, '[REDACTED]');

  // stable schema output
  assert.ok(first.event.id);
  assert.ok(first.event.payload_cas);
  assert.ok(first.event.metadata.received_at);

  // replay parity for fixtures
  assert.equal(first.artifacts[0]?.cas_ref, second.artifacts[0]?.cas_ref);
  assert.equal(first.artifacts[0]?.media_type, second.artifacts[0]?.media_type);

  // problem+json behavior
  const problem = problemFromError(new Error('bad input'), 'trace-1');
  assert.equal(problem.status, 400);
  assert.equal(problem.trace_id, 'trace-1');

  // artifact cas consistency
  const stripe = adapters.stripe.normalize({ type: 'invoice.paid', amount: 1000, currency: 'usd' });
  assert.equal(stripe.event.payload_cas, stripe.artifacts[0]?.cas_ref);

  process.stdout.write('adapter conformance passed\n');
}

run();
