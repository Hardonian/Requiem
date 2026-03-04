import { randomUUID } from 'node:crypto';
import { buildProblemJSON } from '../../../core/src/truth-spine.js';
import { getLatestFingerprintCAS } from './runtime-fingerprint.js';

export type RequiredProof = 'determinism' | 'integrity' | 'trust' | 'economics' | 'simulation';

export interface ProofPackRefs {
  determinism?: string;
  integrity?: string;
  trust?: string;
  economics?: string;
  simulation?: string;
  runtime_fingerprint_cas?: string;
}

export interface ProofDependencyConfig {
  requiredProofs: RequiredProof[];
  simulationEnabled: boolean;
}

let memoizedConfig: Readonly<ProofDependencyConfig> | null = null;

function parseBoolean(input: string | undefined, defaultValue: boolean): boolean {
  if (input === undefined) return defaultValue;
  return input.toLowerCase() === 'true';
}

function loadConfig(): Readonly<ProofDependencyConfig> {
  if (memoizedConfig) return memoizedConfig;

  const simulationEnabled = parseBoolean(process.env.REQUIEM_SIMULATION_ENABLED, false);
  const configured = process.env.REQUIEM_REQUIRED_PROOFS
    ?.split(',')
    .map((x) => x.trim())
    .filter(Boolean) as RequiredProof[] | undefined;

  const secureDefault: RequiredProof[] = ['determinism', 'integrity', 'trust', 'economics'];
  if (simulationEnabled) secureDefault.push('simulation');

  const requiredProofs = configured && configured.length > 0 ? configured : secureDefault;
  memoizedConfig = Object.freeze({
    requiredProofs: [...requiredProofs],
    simulationEnabled,
  });
  return memoizedConfig;
}

export class ProofDependencyError extends Error {
  readonly status = 409;
  readonly problem: ReturnType<typeof buildProblemJSON>;

  constructor(missing: RequiredProof[], traceId?: string) {
    super('Required proof packs are not available');
    this.name = 'ProofDependencyError';
    this.problem = buildProblemJSON({
      status: 409,
      title: 'Proof dependencies missing',
      detail: 'Required proof packs are not available',
      traceId: traceId ?? randomUUID(),
      code: 'proof_dependencies_missing',
      reasons: missing,
      errors: missing.map((proof) => ({ proof, reason: 'missing' })),
    });
  }
}

export function enforceProofDependencies(input: { proofs?: ProofPackRefs; traceId?: string }): ProofPackRefs {
  const config = loadConfig();
  const proofs: ProofPackRefs = {
    runtime_fingerprint_cas: getLatestFingerprintCAS() ?? undefined,
    ...(input.proofs ?? {}),
  };

  const missing = config.requiredProofs.filter((proof) => !proofs[proof]);
  if (missing.length > 0) {
    throw new ProofDependencyError(missing, input.traceId);
  }

  return proofs;
}

export function __resetProofDependencyConfigForTests(): void {
  memoizedConfig = null;
}
