/**
 * Dataset: FAULT-OOM-SCENARIO
 * Goal: 100MB state-tree requests (simulated) (5 scenarios).
 * Items: {requested_state_bytes:100_000_000, shape:"deep_tree|wide_tree", expected:"rejected_or_streamed", limit_enforced:true}
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

const SHAPES = ['deep_tree', 'wide_tree', 'balanced_tree', 'chain', 'star'];
const EXPECTED_BEHAVIORS = ['rejected', 'streamed', 'truncated', 'error'];
const ERROR_TYPES = ['oom', 'payload_too_large', 'timeout', 'memory_limit_exceeded'];

export const metadata: DatasetMetadata = {
  code: 'FAULT-OOM-SCENARIO',
  name: 'Fault OOM Scenario',
  description: '100MB state-tree requests to test OOM handling',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 5,
  labels: {
    category: 'fault',
    subtype: 'oom',
  },
};

/**
 * Generate OOM scenario test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  case_id: string;
  requested_state_bytes: number;
  shape: string;
  max_depth: number;
  max_width: number;
  expected_behavior: string;
  limit_enforced: boolean;
  error_type?: string;
  limit_bytes?: number;
}> {
  for (let i = 0; i < 5; i++) {
    const shape = rng.pick(SHAPES);
    const expectedBehavior = rng.pick(EXPECTED_BEHAVIORS);
    const errorType = rng.pick(ERROR_TYPES);
    
    let maxDepth = 10;
    let maxWidth = 10;
    
    switch (shape) {
      case 'deep_tree':
        maxDepth = rng.nextInt(50, 100);
        maxWidth = 2;
        break;
      case 'wide_tree':
        maxDepth = 5;
        maxWidth = rng.nextInt(1000, 5000);
        break;
      case 'balanced_tree':
        maxDepth = rng.nextInt(10, 20);
        maxWidth = rng.nextInt(10, 50);
        break;
      case 'chain':
        maxDepth = rng.nextInt(10000, 50000);
        maxWidth = 1;
        break;
      case 'star':
        maxDepth = 2;
        maxWidth = rng.nextInt(10000, 50000);
        break;
    }

    yield {
      case_id: `oom-${i.toString().padStart(3, '0')}`,
      requested_state_bytes: 100_000_000,
      shape,
      max_depth: maxDepth,
      max_width: maxWidth,
      expected_behavior: expectedBehavior,
      limit_enforced: true,
      error_type: expectedBehavior === 'rejected' ? errorType : undefined,
      limit_bytes: 50_000_000, // 50MB limit
    };
  }
}

/**
 * Simulate OOM check.
 */
export function checkOomLimits(
  requestedBytes: number,
  limitBytes: number,
  shape: string
): {
  allowed: boolean;
  reason?: string;
  action?: string;
} {
  if (requestedBytes > limitBytes) {
    return {
      allowed: false,
      reason: `Requested ${requestedBytes} bytes exceeds limit of ${limitBytes} bytes`,
      action: 'rejected',
    };
  }
  
  // Additional shape-based checks
  if (shape === 'deep_tree' && requestedBytes > 30_000_000) {
    return {
      allowed: false,
      reason: 'Deep tree with large size may cause stack overflow',
      action: 'rejected',
    };
  }
  
  if (shape === 'wide_tree' && requestedBytes > 40_000_000) {
    return {
      allowed: false,
      reason: 'Wide tree with large size may cause memory issues',
      action: 'rejected',
    };
  }
  
  return { allowed: true };
}

/**
 * Validator for OOM scenario dataset.
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
    if (!item.requested_state_bytes || (item.requested_state_bytes as number) < 1_000_000) {
      errors.push({ itemIndex: i, field: 'requested_state_bytes', message: 'requested_state_bytes should be at least 1MB' });
    }
    if (!item.shape) {
      errors.push({ itemIndex: i, field: 'shape', message: 'Missing required field: shape' });
    }
    if (!item.expected_behavior) {
      errors.push({ itemIndex: i, field: 'expected_behavior', message: 'Missing required field: expected_behavior' });
    }
    if (item.limit_enforced !== true) {
      errors.push({ itemIndex: i, field: 'limit_enforced', message: 'limit_enforced should be true' });
    }

    // Validate shape is known
    if (item.shape && !SHAPES.includes(item.shape as string)) {
      errors.push({
        itemIndex: i,
        field: 'shape',
        message: `Unknown shape: ${item.shape}`,
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
