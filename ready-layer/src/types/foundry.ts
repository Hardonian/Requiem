// ready-layer/src/types/foundry.ts
// Test Data Foundry type definitions

// ═══════════════════════════════════════════════════════════════════════════════
// CORE ENTITY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DatasetType = 'test' | 'train' | 'validation' | 'benchmark';
export type GeneratorType = 'synthetic' | 'augment' | 'mutate' | 'sample';
export type LabelType = 'manual' | 'auto' | 'predicted' | 'ground_truth';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type VectorType = 'data_drift' | 'concept_drift' | 'prediction_drift' | 'label_drift';
export type ArtifactType = 'dataset' | 'report' | 'log' | 'manifest' | 'checkpoint';
export type RunType = 'generator_run' | 'eval_run';
export type TargetType = 'model' | 'policy' | 'skill' | 'agent';

// ═══════════════════════════════════════════════════════════════════════════════
// DATASET TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Dataset {
  id: string;
  tenant_id: string;
  stable_hash: string;
  name: string;
  description?: string;
  dataset_type: DatasetType;
  schema_json?: Record<string, unknown>;
  item_count: number;
  size_bytes: number;
  version: number;
  parent_dataset_id?: string;
  labels_enabled: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface DatasetItem {
  id: string;
  tenant_id: string;
  dataset_id: string;
  stable_hash: string;
  item_index: number;
  content: Record<string, unknown>;
  content_type: string;
  size_bytes: number;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DatasetWithItems extends Dataset {
  items: DatasetItem[];
}

export interface Label {
  id: string;
  tenant_id: string;
  dataset_id: string;
  dataset_item_id: string;
  label_type: LabelType;
  label_key: string;
  label_value: Record<string, unknown>;
  confidence?: number;
  labeled_by?: string;
  source_generator_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATOR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Generator {
  id: string;
  tenant_id: string;
  stable_hash: string;
  name: string;
  description?: string;
  generator_type: GeneratorType;
  config_json: Record<string, unknown>;
  seed_value?: number;
  deterministic: boolean;
  version: number;
  parent_generator_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface GeneratorRun {
  id: string;
  tenant_id: string;
  run_id: string;
  generator_id: string;
  source_dataset_id?: string;
  output_dataset_id?: string;
  status: RunStatus;
  config_snapshot: Record<string, unknown>;
  seed_value?: number;
  item_count?: number;
  duration_ms?: number;
  trace_id: string;
  error_message?: string;
  error_code?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  created_by: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVALUATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EvalRun {
  id: string;
  tenant_id: string;
  run_id: string;
  dataset_id: string;
  target_type: TargetType;
  target_id: string;
  target_version?: string;
  status: RunStatus;
  metrics_json?: Record<string, unknown>;
  score_summary?: Record<string, unknown>;
  item_results_count: number;
  duration_ms?: number;
  trace_id: string;
  error_message?: string;
  error_code?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  created_by: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIFT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DriftVector {
  id: string;
  tenant_id: string;
  vector_name: string;
  vector_type: VectorType;
  source_type: string;
  source_id: string;
  baseline_dataset_id?: string;
  comparison_dataset_id?: string;
  drift_score?: number;
  threshold: number;
  is_drift_detected: boolean;
  features_json?: Record<string, unknown>;
  distribution_comparison?: Record<string, unknown>;
  trace_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTIFACT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RunArtifact {
  id: string;
  tenant_id: string;
  run_id: string;
  run_type: RunType;
  artifact_type: ArtifactType;
  artifact_name: string;
  content_hash: string;
  storage_path: string;
  size_bytes: number;
  mime_type?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  dataset_type?: DatasetType;
  schema_json?: Record<string, unknown>;
  labels_enabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface CreateDatasetResponse {
  ok: boolean;
  dataset?: Dataset;
  error?: string;
  trace_id: string;
}

export interface ListDatasetsRequest {
  dataset_type?: DatasetType;
  limit?: number;
  offset?: number;
}

export interface ListDatasetsResponse {
  ok: boolean;
  datasets: Dataset[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  trace_id: string;
}

export interface GetDatasetResponse {
  ok: boolean;
  dataset?: DatasetWithItems;
  error?: string;
  trace_id: string;
}

export interface RunGeneratorRequest {
  generator_id: string;
  source_dataset_id?: string;
  seed_value?: number;
  item_count?: number;
  config_override?: Record<string, unknown>;
  idempotency_key?: string;
}

export interface RunGeneratorResponse {
  ok: boolean;
  generator_run?: GeneratorRun;
  output_dataset?: Dataset;
  error?: string;
  trace_id: string;
}

export interface ListGeneratorRunsRequest {
  generator_id?: string;
  status?: RunStatus;
  limit?: number;
  offset?: number;
}

export interface ListGeneratorRunsResponse {
  ok: boolean;
  runs: GeneratorRun[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  trace_id: string;
}

export interface FetchArtifactsRequest {
  run_id: string;
  artifact_type?: ArtifactType;
}

export interface FetchArtifactsResponse {
  ok: boolean;
  artifacts: RunArtifact[];
  error?: string;
  trace_id: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDED SAMPLE DATASET TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SeededSampleConfig {
  seed: number;
  item_count: number;
  schema: 'simple' | 'complex' | 'edge_cases';
  include_labels: boolean;
  label_distribution?: Record<string, number>;
}

export interface SeededSampleDataset {
  config: SeededSampleConfig;
  dataset: Dataset;
  items: DatasetItem[];
  labels: Label[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC SERIALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Computes a stable hash for idempotency checking.
 * The hash should be deterministic based on content, not timing.
 */
export interface StableHashInput {
  tenant_id: string;
  name: string;
  content: Record<string, unknown>;
  version?: number;
}

/**
 * Problem+JSON error response for Foundry operations
 */
export interface FoundryProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  trace_id: string;
  code?: string;
  instance?: string;
}
