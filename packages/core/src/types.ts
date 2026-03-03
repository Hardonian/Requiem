export interface CostUnits {
  compute_units: number;
  memory_units: number;
  cas_io_units: number;
  network_units?: number;
}

export interface PolicyDecision {
  decision: 'allow' | 'deny';
  reasons: string[];
  rule_ids: string[];
}

export interface ArtifactRef {
  cas_address: string;
  filename: string;
  mime: string;
  size: number;
}

export interface ProviderFingerprint {
  model: string;
  vendor: string;
  params: Record<string, string | number | boolean>;
}
