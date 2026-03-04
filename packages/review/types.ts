export interface ProofTriggerEvent {
  proof_pack_cas: string;
  trigger_reason: 'manual' | 'policy_violation' | 'regression_detected' | 'adapter_ingest';
  context_artifacts: string[];
}

export interface ReviewFinding {
  rule: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  file?: string;
}

export interface ReviewArtifact {
  engine: string;
  version: string;
  findings: ReviewFinding[];
  suggested_patches: string[];
  confidence: number;
  model_name: string;
  model_version: string;
  prompt_template_hash: string;
  temperature: number;
  seed?: number;
}

export interface CorrectionProposal {
  source_review_cas: string;
  patch_artifacts: string[];
  impacted_files: string[];
}

export interface ReviewAdapter {
  name: string;
  version: string;
  analyze(diff_artifact: string, context_artifacts: string[]): ReviewArtifact;
  proposeFix(findings: ReviewFinding[]): string[];
}
