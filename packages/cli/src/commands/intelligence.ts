import fs from 'fs';
import { randomUUID } from 'crypto';
import { IntelligenceRepository, ClaimTypeSchema, deriveContextHash, type Prediction, type PerceptionSignal, PerceptionSignalSchema, SignalTypeSchema } from '../lib/compounding-intelligence.js';
import { evaluateCaseReusePolicy, evaluateConfidenceGate } from '../lib/intelligence-policy.js';

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1];
  return undefined;
}

function defaultTenant(): string {
  return process.env.REQUIEM_TENANT_ID || 'default-tenant';
}

function parseClaim(value: string | undefined): ReturnType<typeof ClaimTypeSchema.parse> {
  return ClaimTypeSchema.parse(value ?? 'TESTS_PASS');
}

function print(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

export async function runPredictCommand(args: string[]): Promise<number> {
  const action = args[0];
  if (action === 'record') {
    const runId = getFlag(args, '--run') || 'manual-run';
    const claim = parseClaim(getFlag(args, '--claim'));
    const p = Number(getFlag(args, '--p') || '0.5');
    const prediction = IntelligenceRepository.createPrediction({
      run_id: runId,
      tenant_id: defaultTenant(),
      actor_id: process.env.USER || 'cli',
      claim_type: claim,
      subject: getFlag(args, '--subject') || runId,
      p,
      rationale: getFlag(args, '--rationale') || 'manual prediction',
      model_fingerprint: getFlag(args, '--model') || 'local-model',
      promptset_version: getFlag(args, '--promptset') || 'v1',
      context_hash: deriveContextHash({ runId, claim, p }),
    });
    print(prediction);
    return 0;
  }


  if (action === 'gate') {
    const runId = getFlag(args, '--run') || 'manual-run';
    const claim = parseClaim(getFlag(args, '--claim'));
    const p = Number(getFlag(args, '--p') || '0.5');
    const actionType = getFlag(args, '--action') || 'apply_patch';
    const decision = evaluateConfidenceGate(actionType, claim, p);
    print({ run_id: runId, claim_type: claim, p, action: actionType, decision });
    return decision.allow ? 0 : 2;
  }

  if (action === 'list') {
    const runId = getFlag(args, '--run');
    if (!runId) throw new Error('predict list requires --run <id>');
    print(IntelligenceRepository.listPredictions(runId));
    return 0;
  }

  if (action === 'score') {
    const runId = getFlag(args, '--run');
    if (!runId) throw new Error('predict score requires --run <id>');
    const observed = Number(getFlag(args, '--observed') || '1') as 0 | 1;
    const predictions = IntelligenceRepository.listPredictions(runId);
    const outcomes = predictions.map((prediction: Prediction) => IntelligenceRepository.recordOutcome({ prediction, observed, evidence: [`run:${runId}`] }));
    print(outcomes);
    return 0;
  }

  throw new Error('Usage: predict <record|gate|list|score> [options]');
}

export async function runCalibrateCommand(args: string[]): Promise<number> {
  const action = args[0];
  const claim = parseClaim(getFlag(args, '--claim'));
  const tenantId = defaultTenant();


  if (action === 'show') {
    print(IntelligenceRepository.buildCalibration(tenantId, claim));
    return 0;
  }
  if (action === 'export') {
    const format = getFlag(args, '--format') || 'json';
    const result = IntelligenceRepository.buildCalibration(tenantId, claim);
    if (format === 'csv') {
      process.stdout.write('lower,upper,avg_predicted,avg_observed,count\n');
      result.bins.forEach((bin) => process.stdout.write(`${bin.lower},${bin.upper},${bin.avg_predicted},${bin.avg_observed},${bin.count}\n`));
    } else {
      print(result);
    }
    return 0;
  }
  throw new Error('Usage: calibrate <show|export> --claim <CLAIM_TYPE>');
}

function tokenize(input: string): string[] {
  return input.toLowerCase().split(/[^a-z0-9_./-]+/).filter(Boolean);
}

export async function runCasesCommand(args: string[]): Promise<number> {
  const action = args[0];
  const casePath = '.requiem/intelligence/cases.ndjson';
  const rows = fs.existsSync(casePath) ? fs.readFileSync(casePath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];
  if (action === 'suggest') {
    const errorLog = getFlag(args, '--error-log');
    const raw = errorLog ? fs.readFileSync(errorLog, 'utf8') : (getFlag(args, '--query') || '');
    const words = new Set(tokenize(raw));
    const scored = rows.map((row) => {
      const tokens = new Set(tokenize(`${row.summary} ${row.failing_command} ${row.tags?.join(' ') || ''}`));
      const overlap = [...words].filter((word) => tokens.has(word)).length;
      return { row, overlap };
    }).sort((a, b) => b.overlap - a.overlap).slice(0, 5).map((item) => ({ case_id: (item.row as { case_id: string }).case_id, summary: (item.row as { summary: string }).summary, overlap: item.overlap }));
    print(scored);
    return 0;
  }

  if (action === 'apply') {
    const caseId = args[1];
    const runId = getFlag(args, '--run') || 'case-reuse-run';
    const testsVerified = (getFlag(args, '--verify-tests') || 'fail') === 'pass';
    const buildVerified = (getFlag(args, '--verify-build') || 'fail') === 'pass';
    const policy = evaluateCaseReusePolicy({ testsVerified, buildVerified });
    const p = Number(getFlag(args, '--p') || '0.7');

    const prediction = IntelligenceRepository.createPrediction({
      run_id: runId,
      tenant_id: defaultTenant(),
      actor_id: process.env.USER || 'cli',
      claim_type: 'TESTS_PASS',
      subject: `case_reuse:${caseId}`,
      p,
      rationale: `case-reuse verification for ${caseId}`,
      model_fingerprint: 'local-model',
      promptset_version: 'v1',
      context_hash: deriveContextHash({ caseId, runId, testsVerified, buildVerified }),
    });

    const output = { case_id: caseId, run_id: runId, policy, prediction_created: prediction.prediction_id };
    print(output);
    return policy.allow ? 0 : 2;
  }

  if (action === 'show') {
    const id = args[1];
    print(rows.find((row) => (row as { case_id?: string }).case_id === id) ?? null);
    return 0;
  }
  if (action === 'export') {
    print(rows);
    return 0;
  }
  throw new Error('Usage: cases <suggest|show|export>');
}

export async function runSignalsCommand(args: string[]): Promise<number> {
  const action = args[0];
  const signalPath = '.requiem/intelligence/signals.ndjson';
  const rows: PerceptionSignal[] = fs.existsSync(signalPath) ? fs.readFileSync(signalPath, 'utf8').split('\n').filter(Boolean).map((line) => PerceptionSignalSchema.parse(JSON.parse(line))) : [];
  if (action === 'compute') {
    const changedLockfile = fs.existsSync('pnpm-lock.yaml') ? 1 : 0;
    const signal = PerceptionSignalSchema.parse({
      signal_id: randomUUID(),
      tenant_id: defaultTenant(),
      timestamp: new Date().toISOString(),
      signal_type: SignalTypeSchema.parse(changedLockfile ? 'DEP_LOCKFILE_CHANGE' : 'HIGH_CHURN_AREA'),
      subject: changedLockfile ? 'pnpm-lock.yaml' : 'repo',
      severity: changedLockfile ? 'WARN' : 'INFO',
      value: { changedLockfile },
      evidence: ['filesystem:scan'],
      signal_version: 'v1',
    });
    fs.mkdirSync('.requiem/intelligence', { recursive: true });
    fs.appendFileSync(signalPath, `${JSON.stringify(signal)}\n`);
    print(signal);
    return 0;
  }

  if (action === 'gate') {
    const runId = getFlag(args, '--run') || 'manual-run';
    const claim = parseClaim(getFlag(args, '--claim'));
    const p = Number(getFlag(args, '--p') || '0.5');
    const actionType = getFlag(args, '--action') || 'apply_patch';
    const decision = evaluateConfidenceGate(actionType, claim, p);
    print({ run_id: runId, claim_type: claim, p, action: actionType, decision });
    return decision.allow ? 0 : 2;
  }

  if (action === 'list') {
    const severity = getFlag(args, '--severity');
    print(severity ? rows.filter((row) => row.severity === severity) : rows);
    return 0;
  }
  throw new Error('Usage: signals <compute|list>');
}

export async function runRiskCommand(args: string[]): Promise<number> {
  if (args[0] !== 'score') throw new Error('Usage: risk score --paths <a,b,c>');
  const pathsRaw = getFlag(args, '--paths') || '';
  const paths = pathsRaw.split(',').map((v) => v.trim()).filter(Boolean);
  const hotspotFactor = paths.filter((p) => p.includes('ready-layer') || p.includes('policy')).length;
  const lockfileFactor = paths.some((p) => p.includes('lock')) ? 20 : 0;
  const score = Math.min(100, hotspotFactor * 15 + lockfileFactor + 10);
  print({ score, rationale: { hotspotFactor, lockfileFactor, paths } });
  return 0;
}
