import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

type Prediction = {
  prediction_id: string;
  run_id: string;
  tenant_id: string;
  claim_type: string;
  subject: string;
  rationale: string;
  created_at: string;
};

type Outcome = {
  prediction_id: string;
  observed: 0 | 1;
  evidence?: string[];
};

type EconomicEvent = {
  run_id?: string;
  tenant_id?: string;
  cost_units?: number;
};

type ArtifactRecord = {
  run_id?: string;
  tenant_id?: string;
  pointer?: string;
  hash?: string;
};

type CaseRecord = {
  case_id: string;
  tenant_id: string;
  created_at: string;
  error_hash: string;
  failing_command: string;
  affected_paths: string[];
  route_or_feature: string;
  policy_context_signature: string;
  diff_signature: string;
  files_changed: string[];
  summary: string;
  tests_passed: boolean;
  build_passed: boolean;
  deploy_passed: boolean;
  cost_units: number;
  run_id: string;
  pointers: string[];
  tags: string[];
  case_version: 'v1';
};

const root = process.env.REQUIEM_INTELLIGENCE_STORE_DIR || '.requiem/intelligence';
const predictionPath = path.join(root, 'predictions.ndjson');
const outcomePath = path.join(root, 'outcomes.ndjson');
const casePath = path.join(root, 'cases.ndjson');
const economicPath = path.join(root, 'economic_events.ndjson');
const artifactPath = path.join(root, 'artifacts.ndjson');

function readNdjson<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
}

function appendNdjson(file: string, rows: unknown[]): void {
  if (rows.length === 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
}

function hash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function hashToUuid(input: string): string {
  const h = hash(input);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const predictions = readNdjson<Prediction>(predictionPath);
const outcomes = readNdjson<Outcome>(outcomePath);
const economicEvents = readNdjson<EconomicEvent>(economicPath);
const artifacts = readNdjson<ArtifactRecord>(artifactPath);
const existingCases = readNdjson<CaseRecord>(casePath);

const existingRunIds = new Set(existingCases.map((c) => c.run_id));
const outcomeByPrediction = new Map(outcomes.map((o) => [o.prediction_id, o]));

const byRun = new Map<string, Prediction[]>();
for (const p of predictions) {
  const arr = byRun.get(p.run_id) ?? [];
  arr.push(p);
  byRun.set(p.run_id, arr);
}

const newCases: CaseRecord[] = [];
for (const [runId, runPredictions] of byRun.entries()) {
  if (existingRunIds.has(runId)) continue;

  const tests = runPredictions.find((p) => p.claim_type === 'TESTS_PASS');
  const build = runPredictions.find((p) => p.claim_type === 'BUILD_PASS');
  if (!tests || !build) continue;

  const testsOutcome = outcomeByPrediction.get(tests.prediction_id);
  const buildOutcome = outcomeByPrediction.get(build.prediction_id);
  if (!testsOutcome || !buildOutcome) continue;
  if (testsOutcome.observed !== 1 || buildOutcome.observed !== 1) continue;

  const tenantId = tests.tenant_id;
  const summary = `Successful fix pattern for ${runId}`;
  const failingCommand = tests.subject;
  const files = Array.from(new Set(
    runPredictions
      .flatMap((p) => p.subject.split(',').map((v) => v.trim()))
      .filter((v) => v.includes('/') || v.includes('.'))
      .slice(0, 20),
  ));

  const runPredictionIds = new Set(runPredictions.map((p) => p.prediction_id));
  const runOutcomeEvidence = outcomes
    .filter((o) => runPredictionIds.has(o.prediction_id))
    .flatMap((o) => o.evidence ?? []);
  const runCost = economicEvents
    .filter((e) => e.run_id === runId && e.tenant_id === tenantId)
    .reduce((sum, e) => sum + (typeof e.cost_units === 'number' ? e.cost_units : 0), 0);

  const artifactPointers = artifacts
    .filter((a) => a.run_id === runId && a.tenant_id === tenantId)
    .map((a) => a.pointer ?? (a.hash ? `artifact:${a.hash}` : null))
    .filter((v): v is string => Boolean(v));

  const pointers = Array.from(new Set([`run:${runId}`, ...runOutcomeEvidence, ...artifactPointers]));

  const caseRecord: CaseRecord = {
    case_id: hashToUuid(`${tenantId}:${runId}`),
    tenant_id: tenantId,
    created_at: new Date().toISOString(),
    error_hash: hash(`${runId}:${tests.rationale}`),
    failing_command: failingCommand,
    affected_paths: files,
    route_or_feature: runPredictions[0]?.subject ?? 'unknown',
    policy_context_signature: hash(`policy:${tenantId}:${runId}`).slice(0, 32),
    diff_signature: hash(`diff:${runId}`),
    files_changed: files,
    summary,
    tests_passed: true,
    build_passed: true,
    deploy_passed: false,
    cost_units: runCost,
    run_id: runId,
    pointers,
    tags: ['auto-extracted', 'successful-fix'],
    case_version: 'v1',
  };

  newCases.push(caseRecord);
}

appendNdjson(casePath, newCases);
process.stdout.write(`extract-intelligence-cases: appended ${newCases.length} case(s)\n`);
