/**
 * Dataset: CLI-PIPE-PRESSURE
 * Goal: 10MB synthetic output stream stress tests (5 cases).
 * Items: {bytes:10_000_000, chunk_size, line_breaks, expected_behavior:"no_oom", expected_time_budget_ms}
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

const CHUNK_SIZES = [1024, 4096, 8192, 16384, 65536];
const LINE_BREAK_STYLES = ['\n', '\r\n', '\r', 'none'];
const EXPECTED_BEHAVIORS = ['no_oom', 'streamed', 'completed'];
const TIME_BUDGETS = [5000, 10000, 15000, 20000, 30000];

export const metadata: DatasetMetadata = {
  code: 'CLI-PIPE-PRESSURE',
  name: 'CLI Pipe Pressure Test',
  description: '10MB synthetic output stream stress tests',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 5,
  labels: {
    category: 'performance',
    subtype: 'pipe_stress',
  },
};

/**
 * Generate CLI pipe pressure test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  case_id: string;
  target_bytes: number;
  chunk_size: number;
  line_break_style: string;
  expected_behavior: string;
  expected_time_budget_ms: number;
  content_pattern: string;
}> {
  for (let i = 0; i < 5; i++) {
    const chunkSize = rng.pick(CHUNK_SIZES);
    const lineBreak = rng.pick(LINE_BREAK_STYLES);
    const expectedBehavior = rng.pick(EXPECTED_BEHAVIORS);
    const timeBudget = rng.pick(TIME_BUDGETS);
    const contentPattern = rng.pick(['random', 'repeating', 'structured', 'binary', 'json']);

    yield {
      case_id: `pipe-${i.toString().padStart(3, '0')}`,
      target_bytes: 10_000_000,
      chunk_size: chunkSize,
      line_break_style: lineBreak,
      expected_behavior: expectedBehavior,
      expected_time_budget_ms: timeBudget,
      content_pattern: contentPattern,
    };
  }
}

/**
 * Generate synthetic content for pipe test.
 */
export function generateContent(
  targetBytes: number,
  pattern: string,
  rng: SeededRNG
): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let content = '';
  
  switch (pattern) {
    case 'random':
      while (content.length < targetBytes) {
        content += chars[rng.nextInt(0, chars.length)];
      }
      break;
    case 'repeating':
      const repeat = 'The quick brown fox jumps over the lazy dog. ';
      while (content.length < targetBytes) {
        content += repeat;
      }
      break;
    case 'structured':
      const jsonItem = JSON.stringify({ id: 1, data: 'test', value: 123 }) + '\n';
      while (content.length < targetBytes) {
        content += jsonItem;
      }
      break;
    case 'binary':
      for (let i = 0; i < targetBytes; i++) {
        content += String.fromCharCode(rng.nextInt(0, 256));
      }
      break;
    case 'json':
      const obj = { items: [] };
      for (let i = 0; i < 1000; i++) {
        obj.items.push({ id: i, name: `item-${i}`, value: rng.next() });
      }
      while (content.length < targetBytes) {
        content += JSON.stringify(obj) + '\n';
      }
      break;
  }
  
  return content.substring(0, targetBytes);
}

/**
 * Validator for CLI pipe pressure dataset.
 */
export function validate(
  items: Record<string, unknown>[],
  _labels: Record<string, unknown>[]
): { valid: boolean; errors: { itemIndex: number; field: string; message: string }[]; warnings: { itemIndex: number; field: string; message: string }[] } {
  const errors: { itemIndex: number; field: string; message: string }[] = [];
  const warnings: { itemIndex: number; field: string; message: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (!item.case_id) {
      errors.push({ itemIndex: i, field: 'case_id', message: 'Missing required field: case_id' });
    }
    if (!item.target_bytes || (item.target_bytes as number) < 1_000_000) {
      errors.push({ itemIndex: i, field: 'target_bytes', message: 'target_bytes should be at least 1MB' });
    }
    if (!item.chunk_size || (item.chunk_size as number) < 1) {
      errors.push({ itemIndex: i, field: 'chunk_size', message: 'chunk_size must be positive' });
    }
    if (!item.expected_behavior) {
      errors.push({ itemIndex: i, field: 'expected_behavior', message: 'Missing expected_behavior' });
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
