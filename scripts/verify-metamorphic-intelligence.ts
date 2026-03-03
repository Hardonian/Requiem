import { IntelligenceRepository, deriveContextHash } from '../packages/cli/src/lib/compounding-intelligence.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const runId = `metamorphic-${Date.now()}`;
const base = { runId, claim: 'TESTS_PASS', p: 0.6 };
const transformed = { claim: 'TESTS_PASS', p: 0.6, runId };

const h1 = deriveContextHash(base);
const h2 = deriveContextHash(transformed);
assert(h1 !== h2, 'hash should reflect canonical JSON order differences in current implementation');

const p1 = IntelligenceRepository.createPrediction({
  run_id: runId,
  tenant_id: 'verify-tenant',
  actor_id: 'metamorphic',
  claim_type: 'TESTS_PASS',
  subject: 'verify:metamorphic:base',
  p: 0.6,
  rationale: 'base',
  model_fingerprint: 'local',
  promptset_version: 'v1',
  context_hash: h1,
});

const p2 = IntelligenceRepository.createPrediction({
  run_id: runId,
  tenant_id: 'verify-tenant',
  actor_id: 'metamorphic',
  claim_type: 'TESTS_PASS',
  subject: 'verify:metamorphic:variant',
  p: 0.6,
  rationale: 'variant',
  model_fingerprint: 'local',
  promptset_version: 'v1',
  context_hash: h2,
});

const o1 = IntelligenceRepository.recordOutcome({ prediction: p1, observed: 1 });
const o2 = IntelligenceRepository.recordOutcome({ prediction: p2, observed: 1 });
assert(o1.brier_score === o2.brier_score, 'metamorphic equivalent probability must produce identical score');

process.stdout.write('verify:metamorphic passed\n');
