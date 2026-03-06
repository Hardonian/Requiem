/**
 * Trust Graph / Proof Explorer
 *
 * Implements a provenance graph where nodes represent runs, artifacts,
 * policies, tools, and agents. Edges represent relationships like
 * generated_by, verified_by, evaluated_by, derived_from.
 *
 * Users can trace the provenance of any artifact back to its origin.
 */

import { blake3Hex } from './hash.js';

// ---------------------------------------------------------------------------
// Trust Graph Types
// ---------------------------------------------------------------------------

export type NodeType = 'run' | 'artifact' | 'policy' | 'tool' | 'agent' | 'proof' | 'event';

export type EdgeType =
  | 'generated_by'
  | 'verified_by'
  | 'evaluated_by'
  | 'derived_from'
  | 'input_to'
  | 'output_of'
  | 'governed_by'
  | 'executed_by'
  | 'replayed_from';

export interface TrustNode {
  id: string;
  type: NodeType;
  label: string;
  metadata: Record<string, unknown>;
  hash: string;
  created_at: string;
  tenant_id: string;
}

export interface TrustEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  type: EdgeType;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ProvenanceChain {
  artifact_id: string;
  chain: Array<{
    node: TrustNode;
    edge: TrustEdge;
    depth: number;
  }>;
  root_run_id?: string;
  total_depth: number;
}

export interface TrustGraphStats {
  total_nodes: number;
  total_edges: number;
  nodes_by_type: Record<NodeType, number>;
  edges_by_type: Record<EdgeType, number>;
  orphaned_nodes: number;
  max_depth: number;
}

// ---------------------------------------------------------------------------
// Trust Graph Implementation
// ---------------------------------------------------------------------------

export class TrustGraph {
  private nodes: Map<string, TrustNode> = new Map();
  private edges: Map<string, TrustEdge> = new Map();
  private adjacency: Map<string, Set<string>> = new Map(); // node -> edge ids
  private reverseAdj: Map<string, Set<string>> = new Map(); // target node -> edge ids

  /** Add a node to the graph */
  addNode(node: TrustNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) this.adjacency.set(node.id, new Set());
    if (!this.reverseAdj.has(node.id)) this.reverseAdj.set(node.id, new Set());
  }

  /** Add an edge to the graph */
  addEdge(edge: TrustEdge): void {
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      return; // skip edges to missing nodes
    }
    this.edges.set(edge.id, edge);
    this.adjacency.get(edge.source)?.add(edge.id);
    this.reverseAdj.get(edge.target)?.add(edge.id);
  }

  /** Get a node by ID */
  getNode(id: string): TrustNode | undefined {
    return this.nodes.get(id);
  }

  /** Get outgoing edges from a node */
  getOutgoing(nodeId: string): TrustEdge[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /** Get incoming edges to a node */
  getIncoming(nodeId: string): TrustEdge[] {
    const edgeIds = this.reverseAdj.get(nodeId);
    if (!edgeIds) return [];
    return Array.from(edgeIds).map(id => this.edges.get(id)!).filter(Boolean);
  }

  /** Trace provenance of an artifact back to its root run */
  traceProvenance(artifactId: string, maxDepth: number = 50): ProvenanceChain {
    const chain: ProvenanceChain['chain'] = [];
    const visited = new Set<string>();
    let currentId = artifactId;
    let depth = 0;

    while (depth < maxDepth && !visited.has(currentId)) {
      visited.add(currentId);
      const node = this.nodes.get(currentId);
      if (!node) break;

      const incoming = this.getIncoming(currentId);
      if (incoming.length === 0) break;

      // Follow the first provenance edge
      const edge = incoming[0];
      chain.push({ node, edge, depth });

      currentId = edge.source;
      depth++;
    }

    const rootNode = chain.length > 0 ? this.nodes.get(chain[chain.length - 1].edge.source) : undefined;

    return {
      artifact_id: artifactId,
      chain,
      root_run_id: rootNode?.type === 'run' ? rootNode.id : undefined,
      total_depth: chain.length,
    };
  }

  /** Find all artifacts produced by a run (direct and transitive) */
  findDerivedArtifacts(runId: string, maxDepth: number = 10): TrustNode[] {
    const artifacts: TrustNode[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: runId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const outgoing = this.getOutgoing(id);
      for (const edge of outgoing) {
        const targetNode = this.nodes.get(edge.target);
        if (targetNode) {
          if (targetNode.type === 'artifact') {
            artifacts.push(targetNode);
          }
          queue.push({ id: edge.target, depth: depth + 1 });
        }
      }
    }

    return artifacts;
  }

  /** Get nodes by type */
  getNodesByType(type: NodeType): TrustNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /** Get nodes by tenant */
  getNodesByTenant(tenantId: string): TrustNode[] {
    return Array.from(this.nodes.values()).filter(n => n.tenant_id === tenantId);
  }

  /** Graph statistics */
  getStats(): TrustGraphStats {
    const nodesByType = {} as Record<NodeType, number>;
    for (const node of this.nodes.values()) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    const edgesByType = {} as Record<EdgeType, number>;
    for (const edge of this.edges.values()) {
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    // Find orphaned nodes (no edges)
    let orphaned = 0;
    for (const [nodeId] of this.nodes) {
      const outgoing = this.adjacency.get(nodeId)?.size || 0;
      const incoming = this.reverseAdj.get(nodeId)?.size || 0;
      if (outgoing === 0 && incoming === 0) orphaned++;
    }

    return {
      total_nodes: this.nodes.size,
      total_edges: this.edges.size,
      nodes_by_type: nodesByType,
      edges_by_type: edgesByType,
      orphaned_nodes: orphaned,
      max_depth: this.computeMaxDepth(),
    };
  }

  /** Serialize graph for visualization */
  toJSON(): { nodes: TrustNode[]; edges: TrustEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  // ---------------------------------------------------------------------------
  // Convenience builders
  // ---------------------------------------------------------------------------

  /** Record a run and its artifacts */
  recordRun(
    runId: string,
    tenantId: string,
    toolId: string,
    inputArtifacts: Array<{ id: string; label: string; hash: string }>,
    outputArtifacts: Array<{ id: string; label: string; hash: string }>,
    policySetId?: string,
  ): void {
    const now = new Date().toISOString();

    // Run node
    this.addNode({
      id: runId,
      type: 'run',
      label: `Run ${runId.substring(0, 8)}`,
      metadata: { tool_id: toolId },
      hash: blake3Hex(runId),
      created_at: now,
      tenant_id: tenantId,
    });

    // Tool node (if not exists)
    if (!this.nodes.has(toolId)) {
      this.addNode({
        id: toolId,
        type: 'tool',
        label: toolId,
        metadata: {},
        hash: blake3Hex(toolId),
        created_at: now,
        tenant_id: tenantId,
      });
    }
    this.addEdge({ id: `${runId}->tool:${toolId}`, source: runId, target: toolId, type: 'executed_by', created_at: now });

    // Input artifacts
    for (const input of inputArtifacts) {
      if (!this.nodes.has(input.id)) {
        this.addNode({
          id: input.id,
          type: 'artifact',
          label: input.label,
          metadata: {},
          hash: input.hash,
          created_at: now,
          tenant_id: tenantId,
        });
      }
      this.addEdge({ id: `${input.id}->run:${runId}`, source: input.id, target: runId, type: 'input_to', created_at: now });
    }

    // Output artifacts
    for (const output of outputArtifacts) {
      this.addNode({
        id: output.id,
        type: 'artifact',
        label: output.label,
        metadata: {},
        hash: output.hash,
        created_at: now,
        tenant_id: tenantId,
      });
      this.addEdge({ id: `run:${runId}->${output.id}`, source: runId, target: output.id, type: 'generated_by', created_at: now });
    }

    // Policy governance
    if (policySetId) {
      if (!this.nodes.has(policySetId)) {
        this.addNode({
          id: policySetId,
          type: 'policy',
          label: `Policy ${policySetId.substring(0, 8)}`,
          metadata: {},
          hash: blake3Hex(policySetId),
          created_at: now,
          tenant_id: tenantId,
        });
      }
      this.addEdge({ id: `${runId}->policy:${policySetId}`, source: runId, target: policySetId, type: 'governed_by', created_at: now });
    }
  }

  private computeMaxDepth(): number {
    let maxDepth = 0;
    for (const nodeId of this.nodes.keys()) {
      const incoming = this.reverseAdj.get(nodeId);
      if (!incoming || incoming.size === 0) {
        // Root node - compute depth from here
        const depth = this.bfsDepth(nodeId);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    return maxDepth;
  }

  private bfsDepth(startId: string): number {
    let maxDepth = 0;
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);

      const outgoing = this.adjacency.get(id);
      if (outgoing) {
        for (const edgeId of outgoing) {
          const edge = this.edges.get(edgeId);
          if (edge) queue.push({ id: edge.target, depth: depth + 1 });
        }
      }
    }

    return maxDepth;
  }
}
