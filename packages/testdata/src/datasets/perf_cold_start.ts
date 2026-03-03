/**
 * Dataset: PERF-COLD-START
 * Goal: 5-run baseline of binary load latency.
 * Items: {run_index, command:"rl --version", env_fingerprint, expected_metric_keys}
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

const COMMANDS = [
  'rl --version',
  'rl --help',
  'reach --version',
  'reach --help',
  'requiem --version',
];

const ENV_FINGERPRINTS = [
  'linux-x64-node20',
  'linux-x64-node22',
  'darwin-arm64-node20',
  'darwin-arm64-node22',
  'win32-x64-node20',
];

const EXPECTED_METRIC_KEYS = [
  'startup_time_ms',
  'load_time_ms',
  'total_time_ms',
  'memory_usage_mb',
  'cpu_time_ms',
];

export const metadata: DatasetMetadata = {
  code: 'PERF-COLD-START',
  name: 'Performance Cold Start Baseline',
  description: '5-run baseline of binary load latency',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 5,
  labels: {
    category: 'performance',
    subtype: 'cold_start',
  },
};

/**
 * Generate cold start test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  run_index: number;
  command: string;
  env_fingerprint: string;
  expected_metric_keys: string[];
  warmup_runs: number;
  measured_runs: number;
}> {
  for (let i = 0; i < 5; i++) {
    const command = rng.pick(COMMANDS);
    const envFingerprint = rng.pick(ENV_FINGERPRINTS);
    const metricKeys = rng.shuffle([...EXPECTED_METRIC_KEYS]).slice(0, 4);

    yield {
      run_index: i,
      command,
      env_fingerprint: envFingerprint,
      expected_metric_keys: metricKeys,
      warmup_runs: 2,
      measured_runs: 3,
    };
  }
}

/**
 * Simulate cold start measurement (placeholder for actual measurement).
 */
export function measureColdStart(
  command: string,
  runs: number
): {
  startup_time_ms: number;
  load_time_ms: number;
  total_time_ms: number;
  memory_usage_mb: number;
  cpu_time_ms: number;
}[] {
  // This is a placeholder - in real implementation would actually execute
  const results = [];
  const baseTime = 150; // Base startup time in ms
  
  for (let i = 0; i < runs; i++) {
    results.push({
      startup_time_ms: baseTime + Math.random() * 50,
      load_time_ms: baseTime * 0.8 + Math.random() * 30,
      total_time_ms: baseTime * 2 + Math.random() * 100,
      memory_usage_mb: 45 + Math.random() * 10,
      cpu_time_ms: baseTime * 1.5 + Math.random() * 50,
    });
  }
  
  return results;
}

/**
 * Validator for cold start dataset.
 */
export function validate(
  items: Record<string, unknown>[],
  _labels: Record<string, unknown>[]
): { valid: boolean; errors: { itemIndex: number; field: string; message: string }[]; warnings: { itemIndex: number; field: string; message: string }[] } {
  const errors: { itemIndex: number; field: string; message: string }[] = [];
  const warnings: { itemIndex: number; field: string; message: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.run_index === undefined || item.run_index === null) {
      errors.push({ itemIndex: i, field: 'run_index', message: 'Missing required field: run_index' });
    }
    if (!item.command) {
      errors.push({ itemIndex: i, field: 'command', message: 'Missing required field: command' });
    }
    if (!item.env_fingerprint) {
      errors.push({ itemIndex: i, field: 'env_fingerprint', message: 'Missing required field: env_fingerprint' });
    }
    if (!item.expected_metric_keys || !Array.isArray(item.expected_metric_keys)) {
      errors.push({ itemIndex: i, field: 'expected_metric_keys', message: 'Missing or invalid expected_metric_keys' });
    }

    // Validate run_index is in range
    if (typeof item.run_index === 'number' && (item.run_index < 0 || item.run_index > 4)) {
      errors.push({
        itemIndex: i,
        field: 'run_index',
        message: 'run_index should be in range 0-4',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Registered dataset.
 */
export const dataset: RegisteredDataset = {
  metadata,
  generate,
  validate,
};
