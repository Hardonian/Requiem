#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <vector>

#include "requiem/types.hpp"

namespace requiem {

// v1.2: Seccomp filter actions
enum class SeccompAction {
  allow,
  errno_code,
  kill,
  trap,
  trace
};

// v1.2: Seccomp rule for syscall filtering
struct SeccompRule {
  std::string syscall;
  SeccompAction action{SeccompAction::allow};
  int errno_code{0};
};

struct ProcessSpec {
  std::string command;
  std::vector<std::string> argv;
  std::map<std::string, std::string> env;
  std::string cwd;
  std::uint64_t timeout_ms{5000};
  std::size_t max_output_bytes{4096};
  bool deterministic{true};
  // v1.2: Sandbox enforcement options
  bool enforce_network_isolation{false};
  bool enforce_seccomp{false};
  std::vector<SeccompRule> seccomp_rules;  // Custom seccomp rules
  std::uint64_t max_memory_bytes{0};  // 0 = unlimited
  std::uint64_t max_file_descriptors{0};  // 0 = unlimited
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
  // STUB: seccomp-BPF is not implemented. The SeccompAction/SeccompRule types exist
  // but install_seccomp_filter() is not wired into run_process(). See SECURITY.md §seccomp-roadmap.
  // Capability report will list seccomp as "not_implemented", not false (disabled by choice).
  bool sandbox_seccomp{false};
  bool sandbox_restricted_token{false};
  bool sandbox_network_isolation{false};  // v1.2
  bool sandbox_process_mitigations{false};  // v1.2
  // v1.2: Detailed capability reporting
  // theatre_audit: lists features that are stubs vs truly available
  //   "seccomp"      -> "not_implemented" (Linux only, not wired)
  //   "job_objects"  -> "partial" on Windows (kill-on-close only; restricted tokens are stub)
  //   "rlimits"      -> "available" on Linux/macOS, "not_applicable" on Windows
  std::vector<std::string> enforced_capabilities;
  std::vector<std::string> failed_capabilities;
  std::vector<std::string> theatre_audit;  // stub/partial features listed here
};

ProcessResult run_process(const ProcessSpec& spec);

// Detect and return sandbox capabilities for current platform
SandboxCapabilities detect_platform_sandbox_capabilities();

// v1.2: Install seccomp-bpf filter (Linux only)
bool install_seccomp_filter(const std::vector<SeccompRule>& rules);

// v1.2: Apply Windows process mitigations
bool apply_windows_mitigations();

// v1.2: Create restricted token (Windows)
bool create_restricted_token();

// v1.2: Network isolation helpers
bool setup_network_namespace();  // Linux
bool enable_windows_network_isolation();  // Windows

}  // namespace requiem
