/**
 * Dataset: ADV-PATH-TRAVERSAL
 * Goal: workspace-escape injections (../../) (20 variants).
 * Items: {input_path, normalized_path, expected: "blocked", reason:"path_traversal"}
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

/**
 * Path traversal patterns.
 */
const PATH_TRAVERSAL_PATTERNS = [
  '../',
  '../../',
  '../../../',
  '../../../../',
  '../../../../../',
  '..\\..\\',
  '....//',
  '....\\\\',
  '%2e%2e/',
  '%2e%2e%2f',
  '..%252f',
  '..%c0%af',
  '..%c1%9c',
  '..%c0%af',
  '/etc/passwd',
  '/etc/shadow',
  'C:\\Windows\\System32',
  '\\\\UNC\\\\share',
  '~/.ssh',
  '/proc/self',
];

const BASE_PATHS = [
  '/workspace/',
  '/home/user/files/',
  '/app/uploads/',
  '/data/user/',
  '/var/data/',
  '/app/data/',
  '/uploads/',
  '/files/',
  '/user/data/',
  '/workspace/data/',
];

const EXPECTED_BEHAVIORS = ['blocked', 'sanitized', 'rejected'];
const BLOCK_REASONS = [
  'path_traversal',
  'escape_attempt',
  'forbidden_path',
  'sandbox_violation',
  'unsafe_path',
];

export const metadata: DatasetMetadata = {
  code: 'ADV-PATH-TRAVERSAL',
  name: 'Adversarial Path Traversal',
  description: 'Path traversal and workspace escape attempts',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 20,
  labels: {
    category: 'adversarial',
    subtype: 'path_traversal',
  },
};

/**
 * Simple path normalization for testing.
 */
function normalizePath(path: string): string {
  // Remove duplicate slashes
  let normalized = path.replace(/\/+/g, '/');
  // Replace backslashes with forward slashes
  normalized = normalized.replace(/\\/g, '/');
  // Decode URL encoding
  normalized = normalized.replace(/%2e/gi, '.');
  normalized = normalized.replace(/%2f/gi, '/');
  normalized = normalized.replace(/%252f/gi, '/');
  // Try to resolve .. but keep track
  const parts = normalized.split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else if (part !== '.' && part !== '') {
      resolved.push(part);
    }
  }
  return '/' + resolved.join('/');
}

/**
 * Detect if path contains traversal attempt.
 */
function detectTraversal(normalized: string): boolean {
  // Check for absolute paths outside allowed areas
  if (normalized.startsWith('/etc/')) return true;
  if (normalized.startsWith('/proc/')) return true;
  if (normalized.startsWith('/sys/')) return true;
  if (normalized.match(/^[A-Z]:\\/i)) return true; // Windows absolute
  if (normalized.startsWith('\\\\')) return true; // UNC path
  if (normalized.includes('/..')) return true;
  // Check for SSH keys
  if (normalized.includes('/.ssh')) return true;
  return false;
}

/**
 * Generate path traversal test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  case_id: string;
  input_path: string;
  normalized_path: string;
  expected_behavior: string;
  block_reason: string;
}> {
  for (let i = 0; i < 20; i++) {
    const basePath = rng.pick(BASE_PATHS);
    const traversal = rng.pick(PATH_TRAVERSAL_PATTERNS);
    const inputPath = basePath + traversal;
    const normalizedPath = normalizePath(inputPath);
    const expectedBehavior = rng.pick(EXPECTED_BEHAVIORS);
    const blockReason = detectTraversal(normalizedPath) 
      ? rng.pick(BLOCK_REASONS) 
      : 'none';

    yield {
      case_id: `path-${i.toString().padStart(3, '0')}`,
      input_path: inputPath,
      normalized_path: normalizedPath,
      expected_behavior: expectedBehavior,
      block_reason: blockReason,
    };
  }
}

/**
 * Validator for path traversal dataset.
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
    if (!item.input_path) {
      errors.push({ itemIndex: i, field: 'input_path', message: 'Missing required field: input_path' });
    }
    if (!item.normalized_path) {
      errors.push({ itemIndex: i, field: 'normalized_path', message: 'Missing required field: normalized_path' });
    }
    if (!item.expected_behavior) {
      errors.push({ itemIndex: i, field: 'expected_behavior', message: 'Missing required field: expected_behavior' });
    }
    if (!item.block_reason) {
      errors.push({ itemIndex: i, field: 'block_reason', message: 'Missing required field: block_reason' });
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
