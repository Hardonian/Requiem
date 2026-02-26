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
};

std::string to_string(ErrorCode code);

struct ExecPolicy {
  bool deterministic{true};
  bool allow_outside_workspace{false};
  bool inherit_env{false};
  std::string mode{"strict"};
  std::string time_mode{"fixed_zero"};
  std::vector<std::string> env_allowlist;
  std::vector<std::string> env_denylist{"RANDOM", "TZ", "HOSTNAME", "PWD", "OLDPWD", "SHLVL"};
  std::map<std::string, std::string> required_env{{"PYTHONHASHSEED", "0"}};
};

struct PolicyApplied {
  std::string mode;
  std::string time_mode;
  std::vector<std::string> allowed_keys;
  std::vector<std::string> denied_keys;
  std::vector<std::string> injected_required_keys;
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
};

}  // namespace requiem
