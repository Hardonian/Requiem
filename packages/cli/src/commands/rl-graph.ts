/**
 * rl graph command - Show repo lineage graph / run graph
 */

import fs from 'fs';
import path from 'path';
import { RunLogRepository, PromptRepository } from '../db/operator-console.js';
import { RunLifecycleTracker } from '../lib/run-lifecycle.js';

interface GraphNode {
  id: string;
  type: 'run' | 'prompt' | 'artifact' | 'decision';
  label: string;
  status?: string;
  timestamp?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'triggered' | 'produced' | 'depends';
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  format: 'dot' | 'json';
}

export async function runGraph(
  subcommand: string,
  args: string[],
  options: { json: boolean }
): Promise<number> {
  switch (subcommand) {
    case 'repo':
      return runRepoGraph(args, options);
    case 'run':
      return runRunGraph(args[0], options);
    case 'trace':
      return runTraceGraph(args[0], options);
    default:
      console.error(`Unknown graph subcommand: ${subcommand}`);
      console.error('Usage: rl graph repo|run|trace');
      return 1;
  }
}

async function runRepoGraph(args: string[], options: { json: boolean }): Promise<number> {
  const runRepo = new RunLogRepository();
  const promptRepo = new PromptRepository();

  // Get recent runs and prompts
  const runs = runRepo.getRecentRuns(20);
  const prompts = promptRepo.list({ limit: 20 });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add prompt nodes
  for (const prompt of prompts) {
    nodes.push({
      id: `prompt:${prompt.id}`,
      type: 'prompt',
      label: `${prompt.name} v${prompt.version}`,
    });
  }

  // Add run nodes and edges
  for (const run of runs) {
    nodes.push({
      id: `run:${run.run_id}`,
      type: 'run',
      label: shortId(run.run_id),
      status: run.status,
      timestamp: run.start_time,
    });

    // Edge from prompt to run
    if (run.prompt_id) {
      edges.push({
        from: `prompt:${run.prompt_id}`,
        to: `run:${run.run_id}`,
        type: 'triggered',
      });
    }

    // Edge from parent run
    if (run.parent_run_id) {
      edges.push({
        from: `run:${run.parent_run_id}`,
        to: `run:${run.run_id}`,
        type: 'depends',
      });
    }
  }

  return outputGraph({ nodes, edges, format: options.json ? 'json' : 'dot' }, options);
}

async function runRunGraph(runId: string | undefined, options: { json: boolean }): Promise<number> {
  if (!runId) {
    console.error('Usage: rl graph run <run_id>');
    return 1;
  }

  const runRepo = new RunLogRepository();
  const run = runRepo.findByRunId(runId);

  if (!run) {
    console.error(`Run not found: ${runId}`);
    return 1;
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add this run
  nodes.push({
    id: `run:${run.run_id}`,
    type: 'run',
    label: shortId(run.run_id),
    status: run.status,
    timestamp: run.start_time,
  });

  // Add prompt if exists
  if (run.prompt_id) {
    nodes.push({
      id: `prompt:${run.prompt_id}`,
      type: 'prompt',
      label: 'Prompt',
    });
    edges.push({
      from: `prompt:${run.prompt_id}`,
      to: `run:${run.run_id}`,
      type: 'triggered',
    });
  }

  // Add parent if exists
  if (run.parent_run_id) {
    const parent = runRepo.findByRunId(run.parent_run_id);
    nodes.push({
      id: `run:${run.parent_run_id}`,
      type: 'run',
      label: shortId(run.parent_run_id),
      status: parent?.status ?? 'unknown',
    });
    edges.push({
      from: `run:${run.parent_run_id}`,
      to: `run:${run.run_id}`,
      type: 'depends',
    });
  }

  // Add child runs
  const allRuns = runRepo.list({ limit: 100 });
  const childRuns = allRuns.filter(r => r.parent_run_id === runId);
  for (const child of childRuns) {
    nodes.push({
      id: `run:${child.run_id}`,
      type: 'run',
      label: shortId(child.run_id),
      status: child.status,
    });
    edges.push({
      from: `run:${run.run_id}`,
      to: `run:${child.run_id}`,
      type: 'triggered',
    });
  }

  // Add artifacts if they exist
  if (run.artifact_path && fs.existsSync(run.artifact_path)) {
    nodes.push({
      id: `artifact:${run.run_id}`,
      type: 'artifact',
      label: 'Artifacts',
    });
    edges.push({
      from: `run:${run.run_id}`,
      to: `artifact:${run.run_id}`,
      type: 'produced',
    });
  }

  return outputGraph({ nodes, edges, format: options.json ? 'json' : 'dot' }, options);
}

async function runTraceGraph(traceId: string | undefined, options: { json: boolean }): Promise<number> {
  if (!traceId) {
    console.error('Usage: rl graph trace <trace_id>');
    return 1;
  }

  const runRepo = new RunLogRepository();
  const runs = runRepo.findByTraceId(traceId);

  if (runs.length === 0) {
    console.error(`No runs found for trace: ${traceId}`);
    return 1;
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Add all runs in this trace
  for (const run of runs) {
    nodes.push({
      id: `run:${run.run_id}`,
      type: 'run',
      label: shortId(run.run_id),
      status: run.status,
      timestamp: run.start_time,
    });

    // Connect to parent if in same trace
    if (run.parent_run_id && runs.some(r => r.run_id === run.parent_run_id)) {
      edges.push({
        from: `run:${run.parent_run_id}`,
        to: `run:${run.run_id}`,
        type: 'depends',
      });
    }

    // Connect to prompt
    if (run.prompt_id) {
      const promptId = `prompt:${run.prompt_id}`;
      if (!nodes.some(n => n.id === promptId)) {
        nodes.push({
          id: promptId,
          type: 'prompt',
          label: 'Prompt',
        });
      }
      edges.push({
        from: promptId,
        to: `run:${run.run_id}`,
        type: 'triggered',
      });
    }
  }

  return outputGraph({ nodes, edges, format: options.json ? 'json' : 'dot' }, options);
}

function outputGraph(graph: GraphResult, options: { json: boolean }): number {
  if (options.json) {
    console.log(JSON.stringify(graph, null, 2));
  } else {
    console.log(generateDotGraph(graph));
  }
  return 0;
}

function generateDotGraph(graph: GraphResult): string {
  const lines: string[] = [];
  lines.push('digraph ReadyLayer {');
  lines.push('  rankdir=TB;');
  lines.push('  node [shape=box, style=rounded];');
  lines.push('');

  // Define nodes with styles
  for (const node of graph.nodes) {
    const attrs: string[] = [];

    switch (node.type) {
      case 'prompt':
        attrs.push('shape=ellipse', 'fillcolor=lightblue', 'style=filled');
        break;
      case 'run':
        attrs.push('shape=box');
        if (node.status === 'completed') {
          attrs.push('fillcolor=lightgreen', 'style=filled');
        } else if (node.status === 'failed') {
          attrs.push('fillcolor=lightcoral', 'style=filled');
        } else if (node.status === 'running') {
          attrs.push('fillcolor=lightyellow', 'style=filled');
        }
        break;
      case 'artifact':
        attrs.push('shape=note', 'fillcolor=lightgray', 'style=filled');
        break;
    }

    attrs.push(`label="${node.label}"`);
    lines.push(`  "${node.id}" [${attrs.join(', ')}];`);
  }

  lines.push('');

  // Define edges
  for (const edge of graph.edges) {
    const attrs: string[] = [];

    switch (edge.type) {
      case 'triggered':
        attrs.push('style=solid');
        break;
      case 'depends':
        attrs.push('style=dashed');
        break;
      case 'produced':
        attrs.push('style=dotted');
        break;
    }

    lines.push(`  "${edge.from}" -> "${edge.to}" [${attrs.join(', ')}];`);
  }

  lines.push('}');
  return lines.join('\n');
}

function shortId(id: string): string {
  return id.length > 12 ? id.substring(0, 12) + '...' : id;
}

export default runGraph;
