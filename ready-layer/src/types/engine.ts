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
