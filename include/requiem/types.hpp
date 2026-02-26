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
};

std::string to_string(ErrorCode code);

// Sandbox capabilities detected at runtime
struct SandboxCapabilities {
  bool workspace_confinement{false};
  bool rlimits_cpu{false};
  bool rlimits_mem{false};
  bool rlimits_fds{false};
  bool seccomp_baseline{false};
  bool job_objects{false};
  bool restricted_token{false};
  bool process_mitigations{false};
  
  std::vector<std::string> enforced() const;
  std::vector<std::string> unsupported() const;
};

SandboxCapabilities detect_sandbox_capabilities();

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
  std::vector<std::string> enforced;
  std::vector<std::string> unsupported;
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
};

struct TraceEvent {
  std::uint64_t seq{0};
  std::uint64_t t_ns{0};
  std::string type;
  std::map<std::string, std::string> data;
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
  // Enterprise features
  std::string signature;  // Stub for signed result envelope
  std::string audit_log_id;
};

}  // namespace requiem
