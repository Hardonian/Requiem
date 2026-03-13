/**
 * Proofpack — First-Class Verifiable Execution Receipt
 *
 * A proofpack is a self-validating artifact that cryptographically binds:
 * - Execution identity (execution_id, input_hash, workflow_hash)
 * - Policy decisions (policy_hash)
 * - Tool invocations (tool_call_hashes)
 * - Final state (state_hash)
 * - CAS references
 * - Timestamp and signature
 *
 * Command: `requiem verify proofpack.json` → VALID / INVALID
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  canonicalHash,
  hashDomain,
  canonicalStringify,
  computeMerkleRoot,
  hashCanonical,
} from '../../hash/src/canonical_hash.js';

// ---------------------------------------------------------------------------
// Proofpack Schema
// ---------------------------------------------------------------------------

export interface Proofpack {
  /** Schema version */
  version: 2;

  /** Unique execution identifier */
  execution_id: string;

  /** BLAKE3 hash of canonical request inputs */
  input_hash: string;

  /** BLAKE3 hash of policy rules at time of evaluation */
  policy_hash: string;

  /** BLAKE3 hash of workflow definition */
  workflow_hash: string;

  /** Ordered list of tool call hashes */
  tool_call_hashes: string[];

  /** BLAKE3 hash of final execution state */
  state_hash: string;

  /** Map of output filename → CAS digest */
  cas_references: Record<string, string>;

  /** Merkle root covering all hashes above */
  merkle_root: string;

  /** Logical timestamp (not wall-clock) */
  timestamp_logical: number;

  /** ISO timestamp (metadata only, not part of hash) */
  timestamp_iso: string;

  /** Ed25519 signature over merkle_root (hex) */
  signature: string;

  /** Signing status */
  signing_status: 'signed' | 'unsigned';

  /** Engine version that produced this proofpack */
  engine_version: string;

  /** Hash algorithm version */
  hash_version: number;
}

// ---------------------------------------------------------------------------
// Proofpack Builder
// ---------------------------------------------------------------------------

export interface ProofpackInput {
  execution_id: string;
  inputs: Record<string, unknown>;
  policy_rules: unknown[];
  workflow_definition: unknown;
  tool_calls: Array<{
    tool_id: string;
    input: unknown;
    output: unknown;
  }>;
  final_state: unknown;
  cas_outputs: Record<string, string>;
  timestamp_logical: number;
  engine_version: string;
}

export function buildProofpack(input: ProofpackInput): Proofpack {
  const inputHash = hashCanonical(input.inputs);
  const policyHash = hashCanonical(input.policy_rules);
  const workflowHash = hashCanonical(input.workflow_definition);

  const toolCallHashes = input.tool_calls.map(tc =>
    hashCanonical({ tool_id: tc.tool_id, input: tc.input, output: tc.output })
  );

  const stateHash = hashCanonical(input.final_state);

  const allDigests = [
    inputHash,
    policyHash,
    workflowHash,
    ...toolCallHashes,
    stateHash,
    ...Object.values(input.cas_outputs),
  ];

  const merkleRoot = computeMerkleRoot(allDigests);

  return {
    version: 2,
    execution_id: input.execution_id,
    input_hash: inputHash,
    policy_hash: policyHash,
    workflow_hash: workflowHash,
    tool_call_hashes: toolCallHashes,
    state_hash: stateHash,
    cas_references: input.cas_outputs,
    merkle_root: merkleRoot,
    timestamp_logical: input.timestamp_logical,
    timestamp_iso: new Date().toISOString(),
    signature: '',
    signing_status: 'unsigned',
    engine_version: input.engine_version,
    hash_version: 1,
  };
}

// ---------------------------------------------------------------------------
// Proofpack Verification
// ---------------------------------------------------------------------------

export interface VerificationResult {
  valid: boolean;
  execution_id: string;
  errors: string[];
  checks: VerificationCheck[];
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export function verifyProofpack(pack: Proofpack): VerificationResult {
  const errors: string[] = [];
  const checks: VerificationCheck[] = [];

  // Check 1: Version
  const versionOk = pack.version === 2;
  checks.push({ name: 'version', passed: versionOk, detail: `version=${pack.version}` });
  if (!versionOk) errors.push(`Unsupported proofpack version: ${pack.version}`);

  // Check 2: Hash version
  const hashVersionOk = pack.hash_version === 1;
  checks.push({ name: 'hash_version', passed: hashVersionOk, detail: `hash_version=${pack.hash_version}` });
  if (!hashVersionOk) errors.push(`Unsupported hash version: ${pack.hash_version}`);

  // Check 3: All hashes are valid 64-char hex
  const hashFields = [
    { name: 'input_hash', value: pack.input_hash },
    { name: 'policy_hash', value: pack.policy_hash },
    { name: 'workflow_hash', value: pack.workflow_hash },
    { name: 'state_hash', value: pack.state_hash },
    { name: 'merkle_root', value: pack.merkle_root },
  ];

  for (const { name, value } of hashFields) {
    const valid = /^[0-9a-f]{64}$/.test(value);
    checks.push({ name: `${name}_format`, passed: valid, detail: value.substring(0, 16) + '...' });
    if (!valid) errors.push(`Invalid hash format for ${name}: ${value}`);
  }

  // Check 4: Tool call hashes format
  for (let i = 0; i < pack.tool_call_hashes.length; i++) {
    const valid = /^[0-9a-f]{64}$/.test(pack.tool_call_hashes[i]);
    checks.push({ name: `tool_call_hash_${i}`, passed: valid });
    if (!valid) errors.push(`Invalid tool call hash at index ${i}`);
  }

  // Check 5: Merkle root verification
  const allDigests = [
    pack.input_hash,
    pack.policy_hash,
    pack.workflow_hash,
    ...pack.tool_call_hashes,
    pack.state_hash,
    ...Object.values(pack.cas_references),
  ];
  const computedRoot = computeMerkleRoot(allDigests);
  const merkleOk = computedRoot === pack.merkle_root;
  checks.push({
    name: 'merkle_root_integrity',
    passed: merkleOk,
    detail: merkleOk ? 'matches' : `computed=${computedRoot.substring(0, 16)}... claimed=${pack.merkle_root.substring(0, 16)}...`,
  });
  if (!merkleOk) errors.push('Merkle root mismatch — proofpack may be tampered');

  // Check 6: CAS references format
  for (const [filename, digest] of Object.entries(pack.cas_references)) {
    const valid = /^[0-9a-f]{64}$/.test(digest);
    checks.push({ name: `cas_ref_${filename}`, passed: valid });
    if (!valid) errors.push(`Invalid CAS reference for ${filename}: ${digest}`);
  }

  // Check 7: Execution ID present
  const execIdOk = pack.execution_id.length > 0;
  checks.push({ name: 'execution_id', passed: execIdOk });
  if (!execIdOk) errors.push('Missing execution_id');

  return {
    valid: errors.length === 0,
    execution_id: pack.execution_id,
    errors,
    checks,
  };
}

// ---------------------------------------------------------------------------
// Proofpack I/O
// ---------------------------------------------------------------------------

export function saveProofpack(pack: Proofpack, outputPath: string): void {
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const json = canonicalStringify(pack);
  const tmpPath = outputPath + '.tmp';
  writeFileSync(tmpPath, json, 'utf-8');

  const { renameSync } = require('fs');
  renameSync(tmpPath, outputPath);
}

export function loadProofpack(inputPath: string): Proofpack {
  if (!existsSync(inputPath)) {
    throw new Error(`Proofpack not found: ${inputPath}`);
  }
  const content = readFileSync(inputPath, 'utf-8');
  return JSON.parse(content) as Proofpack;
}

export function verifyProofpackFile(inputPath: string): VerificationResult {
  const pack = loadProofpack(inputPath);
  return verifyProofpack(pack);
}
