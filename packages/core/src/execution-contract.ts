/**
 * Deterministic Execution Contract
 *
 * Every execution through Requiem follows this strict contract:
 *
 * 1. Generate run_id
 * 2. Capture environment configuration
 * 3. Evaluate policies (deny-by-default)
 * 4. Execute with immutable event logging
 * 5. Persist tool inputs/outputs to CAS
 * 6. Generate proof bundle
 * 7. Enable replay from proof pack
 *
 * This contract is the canonical interface between the TypeScript control
 * plane and the C++ kernel.
 */

import { canonicalStringify } from './canonical-json.js';
import { blake3Hex, requestDigest, resultDigest, eventChainHash, policyProofHash } from './hash.js';

// ---------------------------------------------------------------------------
// Execution Request
// ---------------------------------------------------------------------------

export interface ExecutionEnvironment {
  node_version: string;
  platform: string;
  arch: string;
  engine_version: string;
  engine_abi_version: number;
  hash_algorithm: string;
  hash_version: number;
  cas_format_version: number;
  env_allowlist?: string[];
  env_denylist?: string[];
}

export interface ToolInvocation {
  tool_id: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  input_hash: string;
  output_hash?: string;
  duration_ms: number;
  error?: string;
  exit_code?: number;
}

export interface ExecutionStep {
  seq: number;
  step_type: 'tool_call' | 'policy_check' | 'llm_call' | 'cas_read' | 'cas_write' | 'checkpoint';
  timestamp_logical: number;
  tool?: ToolInvocation;
  policy_decision?: PolicyEvalResult;
  data_hash: string;
}

export interface ExecutionRequest {
  run_id: string;
  tenant_id: string;
  project_id: string;
  actor_id: string;
  created_at: string;
  command: string;
  args: string[];
  workspace_root: string;
  inputs: Record<string, string>;
  environment: ExecutionEnvironment;
  policy_version: string;
  timeout_ms: number;
  max_output_bytes: number;
  nonce?: string;
}

// ---------------------------------------------------------------------------
// Execution Result
// ---------------------------------------------------------------------------

export interface ExecutionMetrics {
  total_duration_ms: number;
  hash_duration_ms: number;
  policy_duration_ms: number;
  tool_duration_ms: number;
  cas_io_duration_ms: number;
  bytes_in: number;
  bytes_out: number;
  steps_executed: number;
  tools_invoked: number;
  policies_evaluated: number;
  cas_reads: number;
  cas_writes: number;
  peak_memory_bytes: number;
}

export interface ExecutionResult {
  run_id: string;
  ok: boolean;
  exit_code: number;
  error_code?: string;
  termination_reason?: string;
  request_digest: string;
  result_digest: string;
  trace_digest: string;
  stdout_digest: string;
  stderr_digest: string;
  output_digests: Record<string, string>;
  steps: ExecutionStep[];
  policy_decisions: PolicyEvalResult[];
  metrics: ExecutionMetrics;
  proof_bundle: ProofBundle;
}

// ---------------------------------------------------------------------------
// Policy Evaluation
// ---------------------------------------------------------------------------

export interface PolicyRule {
  rule_id: string;
  field: string;
  operator: 'eq' | 'neq' | 'exists' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte' | 'matches';
  value: string;
  effect: 'allow' | 'deny';
  priority: number;
}

export interface PolicyEvalResult {
  decision: 'allow' | 'deny';
  matched_rule_id: string;
  context_hash: string;
  rules_hash: string;
  proof_hash: string;
  evaluated_at_logical_time: number;
  evaluation_duration_ms: number;
}

// ---------------------------------------------------------------------------
// Proof Bundle
// ---------------------------------------------------------------------------

export interface ProofBundle {
  version: number;
  run_id: string;
  request_digest: string;
  result_digest: string;
  trace_digest: string;
  merkle_root: string;
  input_digests: Record<string, string>;
  output_digests: Record<string, string>;
  policy_proof_hashes: string[];
  engine_version: string;
  engine_abi_version: number;
  hash_algorithm: string;
  hash_version: number;
  timestamp_unix_ms: number;
}

// ---------------------------------------------------------------------------
// Proof Pack (on-disk format for replay)
// ---------------------------------------------------------------------------

export interface ProofPack {
  manifest: ProofBundle;
  run_log: ExecutionStep[];
  policy_evaluations: PolicyEvalResult[];
  artifacts: Record<string, string>; // filename -> CAS address
  signature?: string;
}

// ---------------------------------------------------------------------------
// Event Log Entry (mirrors C++ EventRecord)
// ---------------------------------------------------------------------------

export interface EventRecord {
  seq: number;
  prev: string; // hash of previous record (chain)
  ts_logical: number;
  event_type: string;
  actor: string;
  data_hash: string;
  execution_id: string;
  tenant_id: string;
  request_digest: string;
  result_digest: string;
  engine_semver: string;
  hash_algorithm_version: number;
  replay_verified: boolean;
  ok: boolean;
  error_code?: string;
  duration_ns: number;
  timestamp_unix_ms: number;
  worker_id: string;
  node_id: string;
}

// ---------------------------------------------------------------------------
// Contract Functions
// ---------------------------------------------------------------------------

const GENESIS_PREV = '0'.repeat(64);

/** Compute request digest from canonical JSON */
export function computeRequestDigest(request: ExecutionRequest): string {
  return requestDigest(canonicalStringify(request));
}

/** Compute result digest from canonical JSON */
export function computeResultDigest(result: Omit<ExecutionResult, 'result_digest'>): string {
  return resultDigest(canonicalStringify(result));
}

/** Compute event chain hash */
export function computeEventChainHash(record: EventRecord): string {
  return eventChainHash(canonicalStringify(record));
}

/** Compute policy proof hash */
export function computePolicyProofHash(decision: PolicyEvalResult): string {
  return policyProofHash(canonicalStringify(decision));
}

/** Generate a Merkle root from a list of digests */
export function computeMerkleRoot(digests: string[]): string {
  if (digests.length === 0) return blake3Hex('empty_tree');
  if (digests.length === 1) return digests[0];

  const pairs: string[] = [];
  for (let i = 0; i < digests.length; i += 2) {
    const left = digests[i];
    const right = i + 1 < digests.length ? digests[i + 1] : left;
    pairs.push(blake3Hex(left + right));
  }
  return computeMerkleRoot(pairs);
}

/** Build a proof bundle from execution results */
export function buildProofBundle(
  request: ExecutionRequest,
  result: Omit<ExecutionResult, 'proof_bundle' | 'result_digest'>,
): ProofBundle {
  const allDigests = [
    result.request_digest,
    result.trace_digest,
    result.stdout_digest,
    result.stderr_digest,
    ...Object.values(result.output_digests),
    ...result.policy_decisions.map(d => d.proof_hash),
  ];

  return {
    version: 2,
    run_id: request.run_id,
    request_digest: result.request_digest,
    result_digest: '', // filled after result_digest computed
    trace_digest: result.trace_digest,
    merkle_root: computeMerkleRoot(allDigests),
    input_digests: Object.fromEntries(
      Object.entries(request.inputs).map(([k, v]) => [k, blake3Hex(v)])
    ),
    output_digests: result.output_digests,
    policy_proof_hashes: result.policy_decisions.map(d => d.proof_hash),
    engine_version: request.environment.engine_version,
    engine_abi_version: request.environment.engine_abi_version,
    hash_algorithm: request.environment.hash_algorithm,
    hash_version: request.environment.hash_version,
    timestamp_unix_ms: Date.now(),
  };
}

/** Build a complete proof pack for replay */
export function buildProofPack(
  bundle: ProofBundle,
  steps: ExecutionStep[],
  policyEvals: PolicyEvalResult[],
  artifacts: Record<string, string>,
): ProofPack {
  return {
    manifest: bundle,
    run_log: steps,
    policy_evaluations: policyEvals,
    artifacts,
  };
}

/** Verify event chain integrity */
export function verifyEventChain(events: EventRecord[]): {
  ok: boolean;
  verified: number;
  failures: Array<{ seq: number; error: string }>;
} {
  const failures: Array<{ seq: number; error: string }> = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const expectedPrev = i === 0 ? GENESIS_PREV : computeEventChainHash(events[i - 1]);

    if (event.prev !== expectedPrev) {
      failures.push({
        seq: event.seq,
        error: `Chain break: expected prev=${expectedPrev.substring(0, 16)}... got ${event.prev.substring(0, 16)}...`,
      });
    }
  }

  return {
    ok: failures.length === 0,
    verified: events.length,
    failures,
  };
}

/** Verify a proof bundle matches claimed digests */
export function verifyProofBundle(bundle: ProofBundle): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Verify Merkle root
  const allDigests = [
    bundle.request_digest,
    bundle.trace_digest,
    ...Object.values(bundle.output_digests),
    ...bundle.policy_proof_hashes,
  ];
  const computedRoot = computeMerkleRoot(allDigests);
  if (computedRoot !== bundle.merkle_root) {
    errors.push(`Merkle root mismatch: computed=${computedRoot.substring(0, 16)}... claimed=${bundle.merkle_root.substring(0, 16)}...`);
  }

  // Verify hash version
  if (bundle.hash_version !== 1) {
    errors.push(`Unknown hash version: ${bundle.hash_version}`);
  }

  return { ok: errors.length === 0, errors };
}
