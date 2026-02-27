// ready-layer/src/types/engine.ts
// EXTENSION_POINT: node_api_bridge
//   These types form the contract between the Next.js layer and the Node API boundary.
//   Current: types mirror the C++ engine JSON output schemas exactly.
//   Upgrade path: add Zod schemas for runtime validation at the API boundary.
//   Invariant: NEVER call the C++ engine directly from Next.js routes.
//   All engine calls must go through the Node API boundary (src/lib/engine-client.ts).

export interface VersionManifest {
  engine_semver: string;
  engine_abi_version: number;
  hash_algorithm_version: number;
  cas_format_version: number;
  protocol_framing_version: number;
  replay_log_version: number;
  audit_log_version: number;
  hash_primitive: string;
  build_timestamp: string;
  ok: boolean;
}

export interface LatencyHistogram {
  count: number;
  mean_us: number;
  p50_us: number;
  p95_us: number;
  p99_us: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

export interface FailureCategoryStats {
  cas_corruption: number;
  partial_journal_write: number;
  replay_mismatch: number;
  worker_crash: number;
  out_of_memory: number;
  hash_version_mismatch: number;
  backend_latency_spike: number;
  network_partition: number;
  other: number;
}

export interface DeterminismMetrics {
  replay_verifications: number;
  divergence_count: number;
  replay_verified_rate: number;
}

export interface CASMetrics {
  puts: number;
  gets: number;
  hits: number;
  hit_rate: number;
  dedupe_ratio: number;
}

export interface MemoryMetrics {
  peak_bytes_total: number;
  peak_bytes_max: number;
  rss_bytes_last: number;
}

export interface ConcurrencyMetrics {
  contention_count: number;
  avg_queue_depth: number;
}

export interface EngineStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  replay_divergences: number;  // backward compat field
  determinism: DeterminismMetrics;
  cas: CASMetrics;
  latency: LatencyHistogram;
  memory: MemoryMetrics;
  concurrency: ConcurrencyMetrics;
  failure_categories: FailureCategoryStats;
  cache_metrics: { l1_miss_rate: number; branch_miss_rate: number };
}

export interface WorkerIdentity {
  worker_id: string;
  node_id: string;
  cluster_mode: boolean;
  shard_id: number;
  total_shards: number;
}

export interface EngineStatusResponse {
  ok: boolean;
  engine_semver: string;
  hash_primitive: string;
  hash_backend: string;
  hash_available: boolean;
  worker: WorkerIdentity;
  stats: EngineStats;
}

export interface HealthResponse {
  ok: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  engine_version: string;
  timestamp_unix_ms: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  ok: boolean;
  message?: string;
}

export interface ExecutionRecord {
  execution_id: string;
  tenant_id: string;
  request_digest: string;
  result_digest: string;
  ok: boolean;
  error_code: string;
  duration_ns: number;
  timestamp_unix_ms: number;
  replay_verified: boolean;
  engine_semver: string;
  worker_id: string;
  node_id: string;
}

export interface CASIntegrityReport {
  ok: boolean;
  objects_checked: number;
  objects_corrupt: number;
  errors: string[];
  cas_format_version: number;
  hash_algorithm_version: number;
}

export interface ReplayVerifyResponse {
  ok: boolean;
  verified: boolean;
  result_digest: string;
  request_digest: string;
  error: string;
  engine_version: string;
  hash_algorithm_version: number;
}

// EXTENSION_POINT: governance_enhancements
// Add: AuditLogEntry with Merkle chain fields (previous_entry_digest, signature).
export interface AuditLogEntry extends ExecutionRecord {
  sequence: number;
  engine_abi_version: number;
  hash_algorithm_version: number;
  cas_format_version: number;
}

// ---------------------------------------------------------------------------
// Distributed Cluster Platform types
// ---------------------------------------------------------------------------

export interface ClusterWorkerRecord {
  worker_id: string;
  node_id: string;
  cluster_mode: boolean;
  shard_id: number;
  total_shards: number;
  healthy: boolean;
  executions_total: number;
  executions_inflight: number;
  queue_depth: number;
  registered_at_unix_ms: number;
  last_heartbeat_unix_ms: number;
}

export interface ClusterStatusResponse {
  cluster_mode: boolean;
  total_workers: number;
  healthy_workers: number;
  total_shards: number;
  local_worker_id: string;
  local_node_id: string;
  local_shard_id: number;
}

export interface ClusterWorkersResponse {
  workers: ClusterWorkerRecord[];
}

export interface ShardRouteResponse {
  ok: boolean;
  tenant_id: string;
  shard_id: number;
  total_shards: number;
  is_local_shard: boolean;
  local_shard_id: number;
}

// ---------------------------------------------------------------------------
// Phase 5: Cluster Drift Types
// ---------------------------------------------------------------------------

export interface VersionMismatch {
  field: string;       // e.g. "engine_semver"
  expected: string;    // local (reference) value
  observed: string;    // offending worker's value
  worker_id: string;
}

export interface ClusterDriftResponse {
  ok: boolean;
  engine_version_mismatch: boolean;
  hash_version_mismatch: boolean;
  protocol_version_mismatch: boolean;
  auth_version_mismatch: boolean;
  replay_drift_rate: number;       // -1 if no replay verifications yet
  replay_divergences: number;
  replay_verifications: number;
  total_workers: number;
  compatible_workers: number;
  mismatches: VersionMismatch[];
}

// ---------------------------------------------------------------------------
// Phase 3: Auto-tuning Types
// ---------------------------------------------------------------------------

export interface TuningParameters {
  worker_thread_count: number;
  arena_size_bytes: number;
  cas_batch_size: number;
  scheduler_mode: string;
  gpu_kernel_mode: string;
}

export interface TelemetrySnapshot {
  p50_us: number;
  p95_us: number;
  p99_us: number;
  peak_memory_bytes: number;
  cas_hit_rate: number;
  contention_count: number;
  avg_queue_depth: number;
  total_executions: number;
  replay_divergences: number;
}

export interface AutotuneEvent {
  timestamp_unix_ms: number;
  action: string;
  rationale: string;
  snapshot_before: TelemetrySnapshot;
  params_before: TuningParameters;
  params_after: TuningParameters;
  applied: boolean;
  block_reason?: string;
}

export interface AutotuneState {
  current: TuningParameters;
  baseline: TuningParameters;
  event_count: number;
  policy: {
    tuning_interval_s: number;
    queue_depth_scale_up_threshold: number;
    memory_grow_ratio: number;
    cas_latency_scale_up_us: number;
    revert_if_p99_ratio: number;
  };
  recent_events?: AutotuneEvent[];
}

// ---------------------------------------------------------------------------
// Phase 4: Root Cause Diagnostics Types
// ---------------------------------------------------------------------------

export type FailureCategory =
  | 'determinism_drift'
  | 'migration_conflict'
  | 'dependency_drift'
  | 'resource_exhaustion'
  | 'cluster_mismatch'
  | 'cas_corruption'
  | 'unknown';

export interface DiagnosticEvidence {
  source: string;
  fact: string;
  relevance: string;
}

export interface DiagnosticSuggestion {
  action: string;
  command: string;
  rationale: string;
  safe: boolean;
}

export interface DiagnosticContext {
  engine_semver: string;
  engine_abi_version: number;
  hash_algorithm_version: number;
  cas_format_version: number;
  replay_divergences: number;
  p99_latency_us: number;
  peak_memory_bytes: number;
  cas_hit_rate: number;
  cluster_worker_count: number;
  cluster_mode: boolean;
  error_code: string;
  error_detail: string;
}

export interface DiagnosticReport {
  ok: boolean;
  category: FailureCategory;
  summary: string;
  analysis_duration_us: number;
  evidence: DiagnosticEvidence[];
  suggestions: DiagnosticSuggestion[];
  context: DiagnosticContext;
}

// ---------------------------------------------------------------------------
// Phase 2: RBAC Types
// ---------------------------------------------------------------------------

export type RbacRole = 'viewer' | 'auditor' | 'operator' | 'admin';

export interface RbacContext {
  ok: boolean;
  role: RbacRole;
  tenant_id: string;
  denial_reason?: string;
}

// ---------------------------------------------------------------------------
// Phase 7: Security / Node Auth Types
// ---------------------------------------------------------------------------

export interface NodeAuthInfo {
  auth_version: number;
  node_id: string;
  issued_at_unix_ms: number;
  expires_at_unix_ms: number;
  token_present: boolean;
}

// Extended WorkerIdentity with version stamps (Phase 5+7).
export interface WorkerIdentityExtended extends WorkerIdentity {
  auth_version: number;
  engine_semver: string;
  engine_abi_version: number;
  hash_algorithm_version: number;
  protocol_framing_version: number;
}
