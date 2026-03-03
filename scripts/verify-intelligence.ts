import { IntelligenceRepository, deriveContextHash } from '../packages/cli/src/lib/compounding-intelligence.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const runId = `verify-intelligence-${Date.now()}`;
const prediction = IntelligenceRepository.createPrediction({
  run_id: runId,
  tenant_id: 'verify-tenant',
  actor_id: 'verify-script',
  claim_type: 'TESTS_PASS',
  subject: 'verify:intelligence',
  p: 0.75,
  rationale: 'integration verification',
  model_fingerprint: 'local',
  promptset_version: 'v1',
  context_hash: deriveContextHash({ runId }),
});

const listed = IntelligenceRepository.listPredictions(runId);
assert(listed.length >= 1, 'prediction should be persisted');

const outcome = IntelligenceRepository.recordOutcome({ prediction, observed: 1, evidence: ['verify-script'] });
assert(outcome.brier_score >= 0 && outcome.brier_score <= 1, 'brier score out of range');

const calibration = IntelligenceRepository.buildCalibration('verify-tenant', 'TESTS_PASS');
assert(calibration.bins.length === 10, 'calibration bins must be deterministic length 10');

process.stdout.write('verify:intelligence passed\n');
