import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'REPO-DAG-CIRCULAR',
  name: 'Repository DAG Circular',
  description: 'Deterministic cycle in synthetic five-node graph',
  version: 1,
  schema_version: '1.0.0',
  item_count: 1,
  labels_schema: {
    category: 'repo',
    subtype: 'cycle_detection',
    expected_detection: true,
  },
} as const;

type Edge = [string, string];

function canonicalCycle(cycle: string[]): string[] {
  const smallest = [...cycle].sort((a, b) => a.localeCompare(b))[0];
  const idx = cycle.indexOf(smallest);
  return [...cycle.slice(idx), ...cycle.slice(0, idx)];
}

function detectCycle(nodes: string[], edges: Edge[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node, []));
  edges.forEach(([from, to]) => adjacency.get(from)?.push(to));
  adjacency.forEach((targets) => targets.sort((a, b) => a.localeCompare(b)));

  const seen = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];

  const dfs = (node: string): string[] | null => {
    seen.add(node);
    stack.add(node);
    path.push(node);

    for (const next of adjacency.get(node) ?? []) {
      if (!seen.has(next)) {
        const cycle = dfs(next);
        if (cycle) {
          return cycle;
        }
      } else if (stack.has(next)) {
        const start = path.indexOf(next);
        return canonicalCycle(path.slice(start));
      }
    }

    stack.delete(node);
    path.pop();
    return null;
  };

  for (const node of [...nodes].sort((a, b) => a.localeCompare(b))) {
    if (!seen.has(node)) {
      const cycle = dfs(node);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: () => {
    const nodes = ['n1', 'n2', 'n3', 'n4', 'n5'];
    const edges: Edge[] = [
      ['n1', 'n2'],
      ['n2', 'n3'],
      ['n3', 'n4'],
      ['n4', 'n5'],
      ['n5', 'n1'],
    ];
    return [
      {
        graph_id: 'dag-cycle-001',
        nodes,
        edges,
        expected_detection: true,
        expected_cycle: ['n1', 'n2', 'n3', 'n4', 'n5'],
      } as DatasetItem,
    ];
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'cycle_detected_with_canonical_order',
        passed: true,
        details: { graphs: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const cycle = detectCycle(item.nodes as string[], item.edges as Edge[]);
      if (!cycle) {
        fail(result, {
          item_index: index,
          field: 'edges',
          message: 'Expected cycle was not detected',
        });
        return;
      }
      const expected = item.expected_cycle as string[];
      if (JSON.stringify(cycle) !== JSON.stringify(expected)) {
        fail(result, {
          item_index: index,
          field: 'expected_cycle',
          message: `Expected ${expected.join('->')} got ${cycle.join('->')}`,
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
