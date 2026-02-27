#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace requiem {

enum class ErrorCode {
  none,
  json_parse_error,
  json_duplicate_key,
  path_escape,
  missing_input,
  spawn_failed,
  timeout,
  cas_integrity_failed,
  replay_failed,
  drift_detected,
  hash_unavailable_blake3,
  sandbox_unavailable,
  quota_exceeded,
  config_invalid,
  proof_verification_failed,
  signature_unavailable,
};

std::string to_string(ErrorCode code);

// Sandbox capabilities detected at runtime
struct SandboxCapabilities {
  bool workspace_confinement{false};
  bool rlimits_cpu{false};
  bool rlimits_mem{false};
  bool rlimits_fds{false};
  bool seccomp_baseline{false};
  bool seccomp_bpf{false};        // v1.2: Full seccomp-bpf filtering
  bool job_objects{false};
  bool restricted_token{false};
  bool process_mitigations{false}; // v1.2: Windows process mitigations
  bool network_isolation{false};   // v1.2: True network isolation
  
  std::vector<std::string> enforced() const;
  std::vector<std::string> unsupported() const;
  // v1.2: Report partial enforcement (truthful capability reporting)
  std::vector<std::string> partial() const;
};

SandboxCapabilities detect_sandbox_capabilities();

// v1.1: Config schema versioning
struct ConfigSchema {
  std::string config_version{"1.1"};  // Added in v1.1
  bool strict_mode{true};              // Reject unknown fields if true
};

struct ExecPolicy {
  bool deterministic{true};
  bool allow_outside_workspace{false};
  bool inherit_env{false};
  std::string mode{"strict"};
  std::string time_mode{"fixed_zero"};
  std::string scheduler_mode{"turbo"};  // "repro" or "turbo"
  std::vector<std::string> env_allowlist;
  std::vector<std::string> env_denylist{"RANDOM", "TZ", "HOSTNAME", "PWD", "OLDPWD", "SHLVL"};
  std::map<std::string, std::string> required_env{{"PYTHONHASHSEED", "0"}};
  // Sandbox options
  bool enforce_sandbox{true};
  std::uint64_t max_memory_bytes{0};  // 0 = unlimited
  std::uint64_t max_file_descriptors{0};  // 0 = unlimited
  // v1.2: Network isolation
  bool deny_network{false};  // Request network isolation
};

struct PolicyApplied {
  std::string mode;
  std::string time_mode;
  std::vector<std::string> allowed_keys;
  std::vector<std::string> denied_keys;
  std::vector<std::string> injected_required_keys;
};

struct SandboxApplied {
  bool workspace_confinement{false};
  bool rlimits{false};
  bool seccomp{false};
  bool job_object{false};
  bool restricted_token{false};
  bool network_isolation{false};  // v1.2
  std::vector<std::string> enforced;
  std::vector<std::string> unsupported;
  std::vector<std::string> partial;  // v1.2: Partial enforcement
};

struct LlmOptions {
  std::string mode{"none"};  // "none", "subprocess", "sidecar", "freeze_then_compute", "attempt_deterministic"
  std::vector<std::string> runner_argv;
  std::string model_ref;
  std::uint64_t seed{0};
  bool has_seed{false};
  std::map<std::string, std::string> sampler;
  bool include_in_digest{false};
  double determinism_confidence{0.0};  // 0.0-1.0, only for attempt_deterministic
};

// v1.1: Request lifecycle metadata
struct RequestLifecycle {
  std::string request_id;
  std::string start_timestamp;   // ISO8601 format (excluded from digest)
  std::string end_timestamp;     // ISO8601 format (excluded from digest)
  std::string status;            // pending|running|completed|failed|cancelled
};

struct ExecutionRequest {
  std::string request_id;
  std::string command;
  std::vector<std::string> argv;
  std::map<std::string, std::string> env;
  std::string cwd;
  std::string workspace_root{"."};
  std::map<std::string, std::string> inputs;
  std::vector<std::string> outputs;
  std::uint64_t nonce{0};
  std::uint64_t timeout_ms{5000};
  std::size_t max_output_bytes{4096};
  ExecPolicy policy;
  LlmOptions llm;
  // Multi-tenant support
  std::string tenant_id;
  // v1.1: Config version for compatibility
  std::string config_version{"1.1"};
  // v1.3: Engine selection for dual-run
  std::string engine_mode{"requiem"};  // "requiem", "rust", "dual"
};

struct TraceEvent {
  std::uint64_t seq{0};
  std::uint64_t t_ns{0};
  std::string type;
  std::map<std::string, std::string> data;
};

// v1.2: Determinism confidence reporting
struct DeterminismConfidence {
  std::string level;  // "high"|"medium"|"best_effort"
  std::vector<std::string> reasons;
  double score{0.0};  // 0.0-1.0
};

struct ExecutionResult {
  bool ok{false};
  int exit_code{0};
  std::string error_code;
  std::string termination_reason;
  bool stdout_truncated{false};
  bool stderr_truncated{false};
  std::string stdout_text;
  std::string stderr_text;
  std::string request_digest;
  std::string trace_digest;
  std::string stdout_digest;
  std::string stderr_digest;
  std::string result_digest;
  std::vector<TraceEvent> trace_events;
  std::map<std::string, std::string> output_digests;
  PolicyApplied policy_applied;
  SandboxApplied sandbox_applied;
  // v1.2: Determinism confidence
  DeterminismConfidence determinism_confidence;
  // Enterprise features
  std::string signature;  // Stub for signed result envelope
  std::string audit_log_id;
  // v1.1: Lifecycle metadata (excluded from digest)
  std::string request_id;
  std::string start_timestamp;
  std::string end_timestamp;
  std::uint64_t duration_ms{0};
};

// v1.2: Proof bundle for verification
struct ProofBundle {
  std::string merkle_root;
  std::vector<std::string> input_digests;
  std::vector<std::string> output_digests;
  std::string policy_digest;
  std::string replay_transcript_digest;
  std::string signature_stub;  // Optional signature metadata
  std::string engine_version;
  std::string contract_version;
  
  std::string to_json() const;
  static std::optional<ProofBundle> from_json(const std::string& json);
};

// v1.1: Metrics counters
struct ExecutionMetrics {
  std::uint64_t exec_total{0};
  std::uint64_t exec_fail{0};
  std::uint64_t timeouts{0};
  std::uint64_t queue_full{0};
  // Latency histogram buckets (ms)
  std::map<std::string, std::uint64_t> latency_buckets;
  // CAS metrics
  std::uint64_t cas_bytes_total{0};
  std::uint64_t cas_objects_total{0};
  double cas_hit_rate{0.0};
  
  std::string to_json() const;
  std::string to_prometheus() const;
};

// v1.3: Engine selection policy
struct EngineSelectionPolicy {
  std::string default_engine{"requiem"};
  std::map<std::string, std::string> tenant_engines;  // tenant_id -> engine
  std::map<std::string, std::string> workload_engines; // workload_type -> engine
  double dual_run_sampling_rate{0.0};  // 0.0-1.0
  std::string dual_run_diff_output;    // Path to write diffs
};

}  // namespace requiem
