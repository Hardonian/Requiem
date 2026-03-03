import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const predictionSchema = z.object({
  prediction_id: z.string(),
  run_id: z.string(),
  tenant_id: z.string(),
  claim_type: z.string(),
  subject: z.string(),
  rationale: z.string(),
  created_at: z.string(),
});

const outcomeSchema = z.object({
  prediction_id: z.string(),
  observed: z.union([z.literal(0), z.literal(1)]),
  evidence: z.array(z.string()).optional(),
});

const economicEventSchema = z.object({
  run_id: z.string().optional(),
  tenant_id: z.string().optional(),
  cost_units: z.number().optional(),
});

const artifactRecordSchema = z.object({
  run_id: z.string().optional(),
  tenant_id: z.string().optional(),
  pointer: z.string().optional(),
  hash: z.string().optional(),
});

const caseRecordSchema = z.object({
  case_id: z.string(),
  tenant_id: z.string(),
  created_at: z.string(),
  error_hash: z.string(),
  failing_command: z.string(),
  affected_paths: z.array(z.string()),
  route_or_feature: z.string(),
  policy_context_signature: z.string(),
  diff_signature: z.string(),
  files_changed: z.array(z.string()),
  summary: z.string(),
  tests_passed: z.boolean(),
  build_passed: z.boolean(),
  deploy_passed: z.boolean(),
  cost_units: z.number(),
  run_id: z.string(),
  pointers: z.array(z.string()),
  tags: z.array(z.string()),
  case_version: z.literal('v1'),
});

type Prediction = z.infer<typeof predictionSchema>;
type Outcome = z.infer<typeof outcomeSchema>;
type EconomicEvent = z.infer<typeof economicEventSchema>;
type ArtifactRecord = z.infer<typeof artifactRecordSchema>;
type CaseRecord = z.infer<typeof caseRecordSchema>;

const root = process.env.REQUIEM_INTELLIGENCE_STORE_DIR || '.requiem/intelligence';
const predictionPath = path.join(root, 'predictions.ndjson');
const outcomePath = path.join(root, 'outcomes.ndjson');
const casePath = path.join(root, 'cases.ndjson');
const economicPath = path.join(root, 'economic_events.ndjson');
const artifactPath = path.join(root, 'artifacts.ndjson');

function readNdjsonValidated<T>(file: string, schema: z.ZodSchema<T>): T[] {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  return lines.map((line, index) => {
    const parsed = JSON.parse(line) as unknown;
    try {
      return schema.parse(parsed);
    } catch (error) {
      throw new Error(`Schema validation failed for ${file} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
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

const predictions = readNdjsonValidated<Prediction>(predictionPath, predictionSchema);
const outcomes = readNdjsonValidated<Outcome>(outcomePath, outcomeSchema);
const economicEvents = readNdjsonValidated<EconomicEvent>(economicPath, economicEventSchema);
const artifacts = readNdjsonValidated<ArtifactRecord>(artifactPath, artifactRecordSchema);
const existingCases = readNdjsonValidated<CaseRecord>(casePath, caseRecordSchema);

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

  newCases.push(caseRecordSchema.parse(caseRecord));
}

appendNdjson(casePath, newCases);
process.stdout.write(`extract-intelligence-cases: appended ${newCases.length} case(s)\n`);
