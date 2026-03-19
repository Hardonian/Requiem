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

// ---------------------------------------------------------------------------
// PHASE A: Budget Types
// ---------------------------------------------------------------------------

export interface BudgetUnit {
  limit: number;
  used: number;
  remaining: number;
}

export interface Budget {
  tenant_id: string;
  budgets: {
    exec?: BudgetUnit;
    cas_put?: BudgetUnit;
    cas_get?: BudgetUnit;
    policy_eval?: BudgetUnit;
    plan_step?: BudgetUnit;
  };
  budget_hash: string;
  version: number;
}

export interface BudgetSetRequest {
  tenant_id: string;
  unit: 'exec' | 'cas_put' | 'cas_get' | 'policy_eval' | 'plan_step';
  limit: number;
}

export interface BudgetSetResponse {
  ok: boolean;
  budget?: Budget;
  error?: TypedError;
}

export interface BudgetShowResponse {
  ok: boolean;
  budget?: Budget;
  error?: TypedError;
}

export interface BudgetResetResponse {
  ok: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// PHASE A: Receipt Types
// ---------------------------------------------------------------------------

export interface Receipt {
  receipt_version: number;
  operation: string;
  tenant_id: string;
  request_digest: string;
  units_charged: number;
  budget_before: number;
  budget_after: number;
  denied: boolean;
  receipt_hash: string;
  event_log_seq: number;
  timestamp_unix_ms: number;
}

export interface ReceiptShowResponse {
  ok: boolean;
  receipt?: Receipt;
  error?: TypedError;
}

export interface ReceiptVerifyResponse {
  ok: boolean;
  valid: boolean;
  receipt_hash_computed: string;
  receipt_hash_stored: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// PHASE A: Snapshot Types
// ---------------------------------------------------------------------------

export interface Snapshot {
  snapshot_version: number;
  logical_time: number;
  event_log_head: string;
  cas_root_hash: string;
  active_caps: string[];
  revoked_caps: string[];
  budgets: Record<string, Budget>;
  policies: Record<string, string>;
  snapshot_hash: string;
  timestamp_unix_ms: number;
}

export interface SnapshotCreateResponse {
  ok: boolean;
  snapshot?: Snapshot;
  error?: TypedError;
}

export interface SnapshotListResponse {
  ok: boolean;
  snapshots: Snapshot[];
  total: number;
}

export interface SnapshotRestoreResponse {
  ok: boolean;
  restored_logical_time: number;
  message: string;
  error?: TypedError;
}

// ---------------------------------------------------------------------------
// PHASE A: Plan Types
// ---------------------------------------------------------------------------

export interface PlanStep {
  step_id: string;
  kind: 'exec' | 'cas_put' | 'policy_eval' | 'gate';
  depends_on: string[];
  config: Record<string, unknown>;
}

export interface Plan {
  plan_id: string;
  plan_version: number;
  steps: PlanStep[];
  plan_hash: string;
}

export interface PlanStepResult {
  ok: boolean;
  result_digest?: string;
  duration_ns: number;
  error?: string;
}

export interface PlanRunResult {
  run_id: string;
  plan_hash: string;
  steps_completed: number;
  steps_total: number;
  ok: boolean;
  step_results: Record<string, PlanStepResult>;
  receipt_hash: string;
  started_at_unix_ms: number;
  completed_at_unix_ms: number;
}

export interface PlanAddRequest {
  plan_id: string;
  steps: PlanStep[];
}

export interface PlanAddResponse {
  ok: boolean;
  plan?: Plan;
  error?: TypedError;
}

export interface PlanListResponse {
  ok: boolean;
  plans: Plan[];
  total: number;
}

export interface PlanRunResponse {
  ok: boolean;
  result?: PlanRunResult;
  error?: TypedError;
}

export interface PlanShowResponse {
  ok: boolean;
  plan?: Plan;
  runs?: PlanRunResult[];
  error?: TypedError;
}

export interface PlanReplayResponse {
  ok: boolean;
  original_run_id: string;
  replay_run_id: string;
  exact_match: boolean;
  receipt_hash_original: string;
  receipt_hash_replay: string;
  error?: TypedError;
}

// ---------------------------------------------------------------------------
// SaaS multi-org and durable job queue types
// ---------------------------------------------------------------------------

export type TenantAdminRole = 'admin' | 'operator' | 'viewer';
export type TenantJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retry_wait' | 'cancelled';

export interface TenantOrganization {
  org_id: string;
  tenant_id: string;
  name: string;
  slug: string;
  status: 'active' | 'paused' | 'degraded';
  plan: 'free' | 'growth' | 'enterprise';
  budget_cents: number;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at_unix_ms: number;
  updated_at_unix_ms: number;
}

export interface TenantOrganizationMember {
  org_id: string;
  actor_id: string;
  role: TenantAdminRole;
  created_at_unix_ms: number;
  updated_at_unix_ms: number;
}

export interface TenantOrganizationHealth {
  org_id: string;
  tenant_id: string;
  status: 'healthy' | 'degraded' | 'paused';
  queue_depth: number;
  jobs_running: number;
  last_job_completed_at_unix_ms: number | null;
  last_error_code: string | null;
}

export interface TenantJobRecord {
  job_id: string;
  tenant_id: string;
  org_id: string;
  plan_hash: string;
  status: TenantJobStatus;
  attempt_count: number;
  max_attempts: number;
  lease_owner: string | null;
  lease_expires_at_unix_ms: number | null;
  next_attempt_at_unix_ms: number;
  last_error_code: string | null;
  last_error_detail: string | null;
  created_by: string;
  created_at_unix_ms: number;
  updated_at_unix_ms: number;
  completed_run_id: string | null;
}

export interface TenantOrganizationsListResponse {
  ok: boolean;
  organizations: TenantOrganization[];
  memberships: TenantOrganizationMember[];
  total: number;
}

export interface TenantOrganizationMutationResponse {
  ok: boolean;
  organization?: TenantOrganization;
  membership?: TenantOrganizationMember;
  deleted?: boolean;
  error?: TypedError;
}

export interface TenantAdminValidationResponse {
  ok: boolean;
  org_id: string;
  actor_id: string;
  role: TenantAdminRole | null;
  allow: boolean;
  reasons: string[];
}

export interface TenantHealthResponse {
  ok: boolean;
  tenant_id: string;
  organizations: TenantOrganizationHealth[];
  totals: {
    organizations: number;
    running_jobs: number;
    pending_jobs: number;
    failed_jobs: number;
  };
}

export interface TenantJobsResponse {
  ok: boolean;
  jobs: TenantJobRecord[];
  total: number;
}

export interface TenantJobMutationResponse {
  ok: boolean;
  job?: TenantJobRecord;
  jobs?: TenantJobRecord[];
  run_id?: string | null;
  recovered_jobs?: string[];
  error?: TypedError;
}

// ---------------------------------------------------------------------------
// PHASE A: Capability Types
// ---------------------------------------------------------------------------

export interface CapabilityToken {
  cap_version: number;
  fingerprint: string;
  issuer_fingerprint: string;
  subject: string;
  permissions: string[];
  not_before: number;
  not_after: number;
  nonce: number;
  signature: string;
}

export interface CapabilityMintRequest {
  subject: string;
  permissions: string[];
  not_before?: number;
  not_after?: number;
}

export interface CapabilityMintResponse {
  ok: boolean;
  fingerprint?: string;
  subject?: string;
  scopes?: string[];
  not_before?: number;
  not_after?: number;
  error?: TypedError;
}

export interface CapabilityInspectResponse {
  ok: boolean;
  token?: CapabilityToken;
  error?: TypedError;
}

export interface CapabilityListItem {
  actor: string;
  seq: number;
  data_hash: string;
  event_type: string;
}

export interface CapabilityListResponse {
  ok: boolean;
  capabilities: CapabilityListItem[];
  total: number;
}

export interface CapabilityRevokeResponse {
  ok: boolean;
  fingerprint: string;
  revoked: boolean;
}

// ---------------------------------------------------------------------------
// PHASE A: Policy Types
// ---------------------------------------------------------------------------

export interface PolicyRule {
  rule_id: string;
  condition: {
    field: string;
    op: 'eq' | 'neq' | 'in' | 'not_in' | 'exists' | 'gt' | 'lt' | 'gte' | 'lte' | 'matches';
    value: unknown;
  };
  effect: 'allow' | 'deny';
  priority: number;
}

export interface PolicyDecision {
  decision: 'allow' | 'deny';
  matched_rule_id?: string;
  context_hash: string;
  rules_hash: string;
  proof_hash: string;
  evaluated_at_logical_time: number;
}

export interface PolicyAddResponse {
  ok: boolean;
  policy_hash?: string;
  size?: number;
  error?: TypedError;
}

export interface PolicyListItem {
  hash: string;
  size: number;
  created_at_unix_ms?: number;
}

export interface PolicyListResponse {
  ok: boolean;
  policies: PolicyListItem[];
  total: number;
}

export interface PolicyEvalResponse {
  ok: boolean;
  decision?: PolicyDecision;
  error?: TypedError;
}

export interface PolicyVersionsResponse {
  ok: boolean;
  policy_id: string;
  versions: string[];
}

export interface PolicyTestResponse {
  ok: boolean;
  tests_run: number;
  tests_passed: number;
  tests_failed: number;
  failures?: Array<{
    test_name: string;
    expected: string;
    actual: string;
  }>;
}

// ---------------------------------------------------------------------------
// PHASE A: Event Log Types
// ---------------------------------------------------------------------------

export interface EventLogEntry {
  seq: number;
  prev: string;
  ts_logical: number;
  event_type: string;
  actor: string;
  data_hash: string;
  execution_id: string;
  tenant_id: string;
  request_digest: string;
  result_digest: string;
  engine_semver: string;
  engine_abi_version: number;
  hash_algorithm_version: number;
  cas_format_version: number;
  replay_verified: boolean;
  ok: boolean;
  error_code: string;
  duration_ns: number;
  worker_id: string;
  node_id: string;
}

export interface EventLogTailResponse {
  ok: boolean;
  events: EventLogEntry[];
}

export interface EventLogReadResponse {
  ok: boolean;
  events: EventLogEntry[];
  total: number;
}

export interface EventLogSearchResponse {
  ok: boolean;
  events: EventLogEntry[];
  query: string;
  total: number;
}

export interface EventLogVerifyFailure {
  seq: number;
  error: string;
}

export interface EventLogVerifyResponse {
  ok: boolean;
  total_events: number;
  verified_events: number;
  failures: EventLogVerifyFailure[];
}

// ---------------------------------------------------------------------------
// PHASE A: CAS Types
// ---------------------------------------------------------------------------

export interface CasObject {
  digest: string;
  encoding: string;
  original_size: number;
  stored_size: number;
  created_at_unix_ms?: number;
}

export interface CasPutResponse {
  ok: boolean;
  digest?: string;
  size?: number;
  encoding?: string;
  error?: TypedError;
}

export interface CasGetResponse {
  ok: boolean;
  digest?: string;
  content?: string;
  size?: number;
  error?: TypedError;
}

export interface CasListResponse {
  ok: boolean;
  objects: CasObject[];
  total: number;
}

export interface CasVerifyResult {
  digest: string;
  ok: boolean;
  stored_size: number;
  original_size: number;
  encoding: string;
  hash_match: boolean;
}

export interface CasVerifyResponse {
  ok: boolean;
  results: CasVerifyResult[];
  verified_count: number;
  errors_count: number;
}

export interface CasGcResponse {
  ok: boolean;
  dry_run: boolean;
  count: number;
  stored_bytes: number;
  bytes_reclaimed?: number;
}

// ---------------------------------------------------------------------------
// Common: Typed Error Envelope
// ---------------------------------------------------------------------------

export interface TypedError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Common: API Response Envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  v: number;
  kind: string;
  data: T | null;
  error: TypedError | null;
}

// ---------------------------------------------------------------------------
// Common: Paginated Response
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
  trace_id: string;
}
