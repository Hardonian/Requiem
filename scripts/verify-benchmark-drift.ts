import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

interface DriftMetrics {
  generated_at: string;
  determinism_rate: number;
  replay_success_rate: number;
  p95_latency_ms: number;
}

const ROOT = process.cwd();
const historyDir = path.join(ROOT, 'bench', 'history');
const baselinePath = path.join(historyDir, 'baseline.json');
const latestPath = path.join(historyDir, 'latest.json');

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const determinism = readJson<{ determinism_rate: number }>(path.join(ROOT, 'bench', 'determinism-report.json'));
const replay = readJson<{ replay_success_rate: number }>(path.join(ROOT, 'bench', 'replay-verification.json'));
const performance = readJson<{ p95_latency_ms: number }>(path.join(ROOT, 'bench', 'performance-report.json'));

const latest: DriftMetrics = {
  generated_at: new Date().toISOString(),
  determinism_rate: Number(determinism.determinism_rate),
  replay_success_rate: Number(replay.replay_success_rate),
  p95_latency_ms: Number(performance.p95_latency_ms),
};

mkdirSync(historyDir, { recursive: true });
writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`, 'utf8');

const baseline = readJson<DriftMetrics>(baselinePath);

const determinismDrop = baseline.determinism_rate - latest.determinism_rate;
const replayDrop = baseline.replay_success_rate - latest.replay_success_rate;
const latencyIncreaseRatio = baseline.p95_latency_ms > 0
  ? (latest.p95_latency_ms - baseline.p95_latency_ms) / baseline.p95_latency_ms
  : 0;

const errors: string[] = [];
if (determinismDrop > 0) {
  errors.push(`determinism_rate decreased (${baseline.determinism_rate} -> ${latest.determinism_rate})`);
}
if (replayDrop > 0) {
  errors.push(`replay_success_rate decreased (${baseline.replay_success_rate} -> ${latest.replay_success_rate})`);
}
if (latencyIncreaseRatio > 0.2) {
  errors.push(
    `p95_latency_ms increased more than 20% (${baseline.p95_latency_ms} -> ${latest.p95_latency_ms}, +${(latencyIncreaseRatio * 100).toFixed(2)}%)`
  );
}

if (errors.length > 0) {
  fail(`Benchmark drift threshold exceeded:\n - ${errors.join('\n - ')}`);
}

console.log('✅ Benchmark drift check passed');
console.log(`determinism_rate: ${latest.determinism_rate}`);
console.log(`replay_success_rate: ${latest.replay_success_rate}`);
console.log(`p95_latency_ms: ${latest.p95_latency_ms}`);
