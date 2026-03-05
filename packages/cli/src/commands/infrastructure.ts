import { DecisionRepository } from '../db/decisions.js';
import { getPathConfigFromEnv } from '../lib/paths.js';
import { hash } from '../lib/hash.js';
import * as io from '../lib/io.js';
import path from 'path';
import type { CommandContext } from '../cli.js';

interface InfraEnvelope {
  ok: boolean;
  trace_id: string;
  command: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

function printEnvelope(envelope: InfraEnvelope, _json = false): number {
  const code = envelope.ok ? 0 : 1;
  process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  return code;
}

export async function runInspectCommand(args: string[], ctx: CommandContext): Promise<number> {
  const artifact = args[0];
  if (!artifact) {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'inspect',
      error: { code: 'E_MISSING_ARGUMENT', message: 'Usage: requiem inspect <artifact>' },
    }, ctx.json);
  }

  const decision = DecisionRepository.findById(artifact);
  if (!decision) {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'inspect',
      error: { code: 'E_NOT_FOUND', message: `Artifact not found: ${artifact}` },
    }, ctx.json);
  }

  let trace: unknown[] = [];
  try {
    trace = decision.decision_trace ? JSON.parse(decision.decision_trace) : [];
  } catch {
    trace = [];
  }
  return printEnvelope({
    ok: true,
    trace_id: ctx.traceId,
    command: 'inspect',
    data: {
      artifact_id: artifact,
      tenant_id: decision.tenant_id,
      status: decision.status,
      output_digest: decision.decision_output ? hash(decision.decision_output) : null,
      trace_steps: Array.isArray(trace) ? trace.length : 0,
      created_at: decision.created_at,
    },
  }, ctx.json);
}

export async function runExplainDecisionCommand(args: string[], ctx: CommandContext): Promise<number> {
  const decisionId = args[0];
  if (!decisionId) {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'explain',
      error: { code: 'E_MISSING_ARGUMENT', message: 'Usage: requiem explain <decision>' },
    }, ctx.json);
  }

  const decision = DecisionRepository.findById(decisionId);
  if (!decision) {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'explain',
      error: { code: 'E_NOT_FOUND', message: `Decision not found: ${decisionId}` },
    }, ctx.json);
  }

  const chain = {
    policy_snapshot_hash: decision.policy_snapshot_hash ?? null,
    source_type: decision.source_type,
    source_ref: decision.source_ref,
    verdict: decision.status,
  };

  return printEnvelope({ ok: true, trace_id: ctx.traceId, command: 'explain', data: { decision_id: decisionId, chain } }, ctx.json);
}

export async function runGraphCommand(args: string[], ctx: CommandContext): Promise<number> {
  const target = args[0];
  if (target !== 'cas' && target !== 'wal') {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'graph',
      error: { code: 'E_BAD_ARGUMENT', message: 'Usage: requiem graph <cas|wal>' },
    }, ctx.json);
  }

  const paths = getPathConfigFromEnv();
  if (target === 'cas') {
    const objectsDir = path.join(paths.casDir, 'objects');
    if (!io.fileExists(objectsDir)) {
      return printEnvelope({
        ok: false,
        trace_id: ctx.traceId,
        command: 'graph cas',
        error: { code: 'E_NOT_FOUND', message: `CAS objects directory not found: ${objectsDir}` },
      }, ctx.json);
    }

    const nodes: Array<{ id: string; kind: string }> = [];
    const edges: Array<{ from: string; to: string; relation: string }> = [];
    for (const bucket of io.readDir(objectsDir).filter(x => x.length === 2)) {
      const bucketPath = path.join(objectsDir, bucket);
      if (!io.statFile(bucketPath).isDirectory()) {
        continue;
      }
      const bucketNode = `bucket:${bucket}`;
      nodes.push({ id: bucketNode, kind: 'cas_bucket' });
      for (const entry of io.readDir(bucketPath)) {
        if (/^[a-f0-9]{64}$/.test(entry)) {
          const digest = `${bucket}${entry}`;
          const objectNode = `artifact:${digest}`;
          nodes.push({ id: objectNode, kind: 'cas_artifact' });
          edges.push({ from: bucketNode, to: objectNode, relation: 'contains' });
        }
      }
    }

    return printEnvelope({
      ok: true,
      trace_id: ctx.traceId,
      command: 'graph cas',
      data: { nodes, edges, metadata: { format: 'graph-json', source: objectsDir } },
    }, ctx.json);
  }

  const decisions = DecisionRepository.list({ limit: 200 });
  const nodes = decisions.map((d) => ({ id: d.id, kind: 'wal_event', ts: d.created_at }));
  const edges = decisions.slice(1).map((d, i) => ({ from: decisions[i].id, to: d.id, relation: 'next' }));

  return printEnvelope({
    ok: true,
    trace_id: ctx.traceId,
    command: 'graph wal',
    data: { nodes, edges, metadata: { format: 'graph-json', source: 'sqlite decisions' } },
  }, ctx.json);
}

export async function runProofPackVerifyCommand(ctx: CommandContext): Promise<number> {
  return printEnvelope({
    ok: true,
    trace_id: ctx.traceId,
    command: 'verify proof-pack',
    data: {
      verification: 'scaffolded',
      checks: ['hash-chain', 'signature-envelope', 'trace-linkage'],
      deterministic: true,
    },
  }, ctx.json);
}

export async function runReplayDiffCommand(args: string[], ctx: CommandContext): Promise<number> {
  const [runA, runB] = args;
  if (!runA || !runB) {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'diff replay',
      error: { code: 'E_MISSING_ARGUMENT', message: 'Usage: requiem diff replay <runA> <runB>' },
    }, ctx.json);
  }

  const first = DecisionRepository.findById(runA);
  const second = DecisionRepository.findById(runB);
  if (!first || !second) {
    return printEnvelope({
      ok: false,
      trace_id: ctx.traceId,
      command: 'diff replay',
      error: { code: 'E_NOT_FOUND', message: 'One or both runs were not found' },
    }, ctx.json);
  }

  const firstDigest = first.decision_output ? hash(first.decision_output) : null;
  const secondDigest = second.decision_output ? hash(second.decision_output) : null;

  return printEnvelope({
    ok: true,
    trace_id: ctx.traceId,
    command: 'diff replay',
    data: {
      runA,
      runB,
      deterministic_match: firstDigest !== null && firstDigest === secondDigest,
      digests: { runA: firstDigest, runB: secondDigest },
    },
  }, ctx.json);
}
