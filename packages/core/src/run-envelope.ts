import type { ArtifactRef, CostUnits, PolicyDecision, ProviderFingerprint } from './types.js';

export interface RunEnvelope {
  run_id: string;
  tenant_id: string;
  project_id: string;
  actor_id: string;
  created_at: string;
  engine_version: string;
  policy_version: string;
  promptset_version: string;
  provider_fingerprint: ProviderFingerprint;
  input_hash: string;
  output_hash: string;
  transcript_hash: string;
  cost_units: CostUnits;
  artifacts: ArtifactRef[];
  policy_decisions: PolicyDecision[];
  replay_pointers: {
    cas_root: string;
    trace_stream: string;
  };
}
