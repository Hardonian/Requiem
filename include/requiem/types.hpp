#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace requiem {

struct ExecPolicy {
  bool deterministic{true};
  bool allow_outside_workspace{false};
  bool inherit_env{false};
  std::vector<std::string> env_allowlist;
  std::vector<std::string> env_denylist{"RANDOM", "TZ", "HOSTNAME", "PWD", "OLDPWD", "SHLVL"};
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
  std::string result_digest;
  std::vector<TraceEvent> trace_events;
  std::map<std::string, std::string> output_digests;
};

}  // namespace requiem
