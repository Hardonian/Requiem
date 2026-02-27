#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <vector>

#include "requiem/types.hpp"

namespace requiem {

struct ProcessSpec {
  std::string command;
  std::vector<std::string> argv;
  std::map<std::string, std::string> env;
  std::string cwd;
  std::uint64_t timeout_ms{5000};
  std::size_t max_output_bytes{4096};
  bool deterministic{true};
};

struct ProcessResult {
  int exit_code{0};
  bool timed_out{false};
  bool stdout_truncated{false};
  bool stderr_truncated{false};
  std::string stdout_text;
  std::string stderr_text;
  std::string error_message;
  // Sandbox capabilities actually applied
  bool sandbox_workspace_confinement{false};
  bool sandbox_job_object{false};
  bool sandbox_rlimits{false};
  bool sandbox_seccomp{false};
  bool sandbox_restricted_token{false};
};

ProcessResult run_process(const ProcessSpec& spec);

// Detect and return sandbox capabilities for current platform
SandboxCapabilities detect_platform_sandbox_capabilities();

}  // namespace requiem
