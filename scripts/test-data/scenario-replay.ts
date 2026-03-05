import { buildBundle, createSeededRng, exportBundle } from './generator.js';

export function generateReplayScenario(seed = 6262, count = 50): ReturnType<typeof buildBundle> {
  const rand = createSeededRng(seed);
  const records = Array.from({ length: count }, (_, i) => ({
    run_id: `run-${i + 1}`,
    step: i + 1,
    latency_ms: Math.floor(rand() * 250),
    deterministic: rand() > 0.05,
    artifact_hash: `sha256:${Math.floor(rand() * 1e12).toString(16).padStart(16, '0')}`,
  }));
  return buildBundle(seed, 'replay-stress', records);
}

if (process.argv[1]?.includes('scenario-replay')) {
  exportBundle('scripts/test-data/out-replay.json', generateReplayScenario());
}
