/**
 * Dataset: REPO-DAG-CIRCULAR
 * Goal: 5-node git DAG with deterministic cycle.
 * Generator: emit a synthetic repo graph nodes/edges that forms a cycle.
 * Items: {nodes:[...], edges:[...], expected_detection:true, expected_cycle:[n1..n5]}
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

export const metadata: DatasetMetadata = {
  code: 'REPO-DAG-CIRCULAR',
  name: 'Repository DAG Circular Dependency',
  description: '5-node git DAG with deterministic cycle for cycle detection testing',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 1,
  labels: {
    category: 'graph',
    subtype: 'circular_dependency',
  },
};

/**
 * Generate a 5-node DAG with a deterministic cycle.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  case_id: string;
  nodes: string[];
  edges: [string, string][];
  expected_detection: boolean;
  expected_cycle: string[];
}> {
  // Create 5 nodes
  const nodes = ['commit-a', 'commit-b', 'commit-c', 'commit-d', 'commit-e'];
  
  // Create edges that form a cycle: a->b->c->d->e->a
  // Plus some tree branches
  const edges: [string, string][] = [
    ['commit-a', 'commit-b'],
    ['commit-b', 'commit-c'],
    ['commit-c', 'commit-d'],
    ['commit-d', 'commit-e'],
    ['commit-e', 'commit-a'], // Creates cycle
    ['commit-a', 'commit-c'], // Additional path
    ['commit-b', 'commit-d'], // Additional path
  ];

  // Shuffle the cycle for determinism
  const cycleBase = ['commit-a', 'commit-b', 'commit-c', 'commit-d', 'commit-e'];
  const cycle = rng.shuffle(cycleBase);

  yield {
    case_id: 'dag-circular-001',
    nodes,
    edges,
    expected_detection: true,
    expected_cycle: cycle,
  };
}

/**
 * Simple cycle detection using DFS.
 */
function detectCycle(
  nodes: string[],
  edges: [string, string][]
): string[] | null {
  // Build adjacency list
  const adj: Record<string, string[]> = {};
  for (const node of nodes) {
    adj[node] = [];
  }
  for (const [from, to] of edges) {
    if (adj[from]) {
      adj[from].push(to);
    }
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    for (const neighbor of adj[node] || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        return path.slice(cycleStart);
      }
    }

    path.pop();
    recursionStack.delete(node);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      const result = dfs(node);
      if (result && Array.isArray(result)) {
        return result;
      }
    }
  }

  return null;
}

/**
 * Validator for DAG circular dataset.
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
    if (!item.nodes || !Array.isArray(item.nodes)) {
      errors.push({ itemIndex: i, field: 'nodes', message: 'Missing or invalid nodes array' });
    }
    if (!item.edges || !Array.isArray(item.edges)) {
      errors.push({ itemIndex: i, field: 'edges', message: 'Missing or invalid edges array' });
    }
    if (item.expected_detection !== true) {
      errors.push({ itemIndex: i, field: 'expected_detection', message: 'expected_detection should be true' });
    }

    // Validate cycle detection
    if (item.nodes && item.edges) {
      const detectedCycle = detectCycle(item.nodes as string[], item.edges as [string, string][]);
      if (!detectedCycle) {
        errors.push({
          itemIndex: i,
          field: 'edges',
          message: 'Expected cycle not detected in graph',
        });
      }
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
