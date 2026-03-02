/**
 * Lineage Engine — DAG traversal for run ancestry
 *
 * INVARIANT: All operations are deterministic
 * INVARIANT: Cycle detection with defensive caps
 * INVARIANT: Tenant-scoped queries only
 */

export interface LineageNode {
  runId: string;
  depth: number;
  parentRunIds: string[];
  childRunIds: string[];
  reason?: string;
  createdAt: string;
}

export interface LineageEdge {
  parentRunId: string;
  childRunId: string;
  reason: string;
}

export interface LineageGraph {
  rootRunId: string;
  nodes: Map<string, LineageNode>;
  edges: LineageEdge[];
  maxDepth: number;
  hasCycles: boolean;
}

export interface LineageOptions {
  maxDepth?: number;
  includeChildren?: boolean;
  includeParents?: boolean;
}

const DEFAULT_MAX_DEPTH = 100;
const MAX_TRAVERSAL_NODES = 10000;

/**
 * Resolve lineage graph for a run
 * Returns ancestors and/or descendants based on options
 */
export function resolveLineage(
  rootRunId: string,
  edgeProvider: (runId: string) => LineageEdge[],
  options: LineageOptions = {}
): LineageGraph {
  const {
    maxDepth = DEFAULT_MAX_DEPTH,
    includeChildren = true,
    includeParents = true,
  } = options;

  const nodes = new Map<string, LineageNode>();
  const edges: LineageEdge[] = [];
  const visited = new Set<string>();
  const queue: Array<{ runId: string; depth: number; direction: 'up' | 'down' }> = [
    { runId: rootRunId, depth: 0, direction: 'down' },
  ];

  // Add root node
  nodes.set(rootRunId, {
    runId: rootRunId,
    depth: 0,
    parentRunIds: [],
    childRunIds: [],
    createdAt: '', // Will be populated from edge data
  });

  let hasCycles = false;
  let traversalCount = 0;

  while (queue.length > 0 && traversalCount < MAX_TRAVERSAL_NODES) {
    const current = queue.shift()!;
    traversalCount++;

    // Check depth limit
    if (current.depth > maxDepth) {
      continue;
    }

    // Cycle detection
    const visitKey = `${current.runId}:${current.direction}`;
    if (visited.has(visitKey)) {
      hasCycles = true;
      continue;
    }
    visited.add(visitKey);

    // Get edges for this run
    const runEdges = edgeProvider(current.runId);

    for (const edge of runEdges) {
      const isParentEdge = edge.childRunId === current.runId;
      const isChildEdge = edge.parentRunId === current.runId;

      // Handle parent traversal (going up)
      if (includeParents && isParentEdge && current.direction === 'down') {
        const parentId = edge.parentRunId;

        // Add edge
        edges.push(edge);

        // Update node relationships
        const node = nodes.get(current.runId)!;
        if (!node.parentRunIds.includes(parentId)) {
          node.parentRunIds.push(parentId);
        }

        // Add parent node
        if (!nodes.has(parentId)) {
          nodes.set(parentId, {
            runId: parentId,
            depth: current.depth + 1,
            parentRunIds: [],
            childRunIds: [current.runId],
            createdAt: '',
          });
        } else {
          const parentNode = nodes.get(parentId)!;
          if (!parentNode.childRunIds.includes(current.runId)) {
            parentNode.childRunIds.push(current.runId);
          }
        }

        // Queue parent for further traversal
        queue.push({ runId: parentId, depth: current.depth + 1, direction: 'down' });
      }

      // Handle child traversal (going down)
      if (includeChildren && isChildEdge && current.direction === 'down') {
        const childId = edge.childRunId;

        // Add edge
        edges.push(edge);

        // Update node relationships
        const node = nodes.get(current.runId)!;
        if (!node.childRunIds.includes(childId)) {
          node.childRunIds.push(childId);
        }

        // Add child node
        if (!nodes.has(childId)) {
          nodes.set(childId, {
            runId: childId,
            depth: current.depth + 1,
            parentRunIds: [current.runId],
            childRunIds: [],
            createdAt: '',
          });
        } else {
          const childNode = nodes.get(childId)!;
          if (!childNode.parentRunIds.includes(current.runId)) {
            childNode.parentRunIds.push(current.runId);
          }
        }

        // Queue child for further traversal
        queue.push({ runId: childId, depth: current.depth + 1, direction: 'down' });
      }
    }
  }

  // Calculate max depth
  let maxDepthFound = 0;
  for (const node of nodes.values()) {
    maxDepthFound = Math.max(maxDepthFound, node.depth);
  }

  // Stable ordering of edges
  edges.sort((a, b) => {
    const cmp = a.parentRunId.localeCompare(b.parentRunId);
    if (cmp !== 0) return cmp;
    return a.childRunId.localeCompare(b.childRunId);
  });

  return {
    rootRunId,
    nodes,
    edges,
    maxDepth: maxDepthFound,
    hasCycles,
  };
}

/**
 * Format lineage as ASCII tree for CLI output
 */
export function formatLineageAsTree(graph: LineageGraph): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ RUN LINEAGE                                                │',
    '├────────────────────────────────────────────────────────────┤',
  ];

  const rootNode = graph.nodes.get(graph.rootRunId);
  if (!rootNode) {
    lines.push('│  Root run not found                                        │');
    lines.push('└────────────────────────────────────────────────────────────┘');
    return lines.join('\n');
  }

  lines.push(`│  Root: ${graph.rootRunId.substring(0, 40).padEnd(40)}│`);
  lines.push(`│  Depth: ${graph.maxDepth.toString().padEnd(39)}│`);
  lines.push(`│  Nodes: ${graph.nodes.size.toString().padEnd(39)}│`);
  if (graph.hasCycles) {
    lines.push('│  ⚠ Cycles detected in lineage                              │');
  }
  lines.push('├────────────────────────────────────────────────────────────┤');

  // Print tree structure
  printNodeTree(graph, graph.rootRunId, '', lines, new Set());

  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

function printNodeTree(
  graph: LineageGraph,
  runId: string,
  prefix: string,
  lines: string[],
  visited: Set<string>
): void {
  if (visited.has(runId)) {
    lines.push(`│${prefix} [CYCLE: ${runId.substring(0, 16)}...]`);
    return;
  }
  visited.add(runId);

  const node = graph.nodes.get(runId);
  if (!node) return;

  const displayId = runId.substring(0, 24);
  lines.push(`│${prefix} ${displayId} ${runId === graph.rootRunId ? '(root)' : ''}`);

  // Sort children for stable output
  const sortedChildren = [...node.childRunIds].sort();
  for (let i = 0; i < sortedChildren.length; i++) {
    const childId = sortedChildren[i];
    const isLast = i === sortedChildren.length - 1;
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const connector = isLast ? '└── ' : '├── ';
    lines.push(`│${prefix}${connector}`);
    printNodeTree(graph, childId, childPrefix, lines, new Set(visited));
  }
}

/**
 * Format lineage as JSON-serializable object
 */
export function formatLineageAsJson(graph: LineageGraph): Record<string, unknown> {
  return {
    rootRunId: graph.rootRunId,
    maxDepth: graph.maxDepth,
    hasCycles: graph.hasCycles,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    nodes: Array.from(graph.nodes.values()).map(n => ({
      runId: n.runId,
      depth: n.depth,
      parentCount: n.parentRunIds.length,
      childCount: n.childRunIds.length,
    })),
    edges: graph.edges.map(e => ({
      parent: e.parentRunId.substring(0, 16) + '...',
      child: e.childRunId.substring(0, 16) + '...',
      reason: e.reason,
    })),
  };
}

/**
 * Get ancestry path from root to a specific run
 */
export function getAncestryPath(graph: LineageGraph, targetRunId: string): string[] | null {
  const path: string[] = [];
  const visited = new Set<string>();

  function dfs(currentId: string): boolean {
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    path.push(currentId);

    if (currentId === targetRunId) {
      return true;
    }

    const node = graph.nodes.get(currentId);
    if (node) {
      for (const childId of node.childRunIds) {
        if (dfs(childId)) {
          return true;
        }
      }
    }

    path.pop();
    return false;
  }

  return dfs(graph.rootRunId) ? path : null;
}

