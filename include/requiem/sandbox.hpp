#pragma once

// requiem/sandbox.hpp — Process sandbox and seccomp-BPF wiring (S-8).
//
// SECCOMP WIRING:
//   install_seccomp_filter() is now wired into run_process() when:
//     1. ProcessSpec::enforce_seccomp == true, AND
//     2. SandboxConfig::sandbox_enabled == true (global config, default: true).
//
//   On Linux: seccomp-BPF filter is installed in the child process before exec.
//   On Windows/macOS: no-op with a compile-time warning. ProcessResult::sandbox_seccomp
//   will remain false and "seccomp_not_available_on_platform" is added to theatre_audit.
//
// PLATFORM GUARDS:
//   #ifdef __linux__   -> seccomp available
//   #ifdef _WIN32      -> Windows mitigations only
//   #ifdef __APPLE__   -> sandbox(7) or no-op depending on config
//
// SANDBOX ENABLED FLAG:
//   Global SandboxConfig::sandbox_enabled defaults to true.
//   Set to false via REQUIEM_SANDBOX_DISABLED=1 env var for debugging.
//   When disabled: all sandbox enforcement is skipped, theatre_audit gets "sandbox_disabled".

#if defined(__linux__)
#  include <sys/prctl.h>
#  include <linux/seccomp.h>
#  include <linux/filter.h>
#  include <sys/syscall.h>
#else
#  if !defined(_WIN32) && !defined(__APPLE__)
#    pragma message("requiem/sandbox: seccomp not available on this platform; seccomp enforcement will be a no-op")
#  endif
#endif

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

// ---------------------------------------------------------------------------
// SandboxConfig — global sandbox configuration (S-8).
// ---------------------------------------------------------------------------
/// @brief Global sandbox configuration, initialized once at engine startup.
///
/// Reads REQUIEM_SANDBOX_DISABLED=1 from env to disable for debugging.
/// Defaults: sandbox_enabled=true.
struct SandboxConfig {
  /// Master switch: when false, all sandbox enforcement is skipped.
  /// Set to false via REQUIEM_SANDBOX_DISABLED=1. Defaults to true.
  bool sandbox_enabled{true};

  /// Load from environment. Call once at engine startup.
  static SandboxConfig from_env();
};

/// @brief Initialize global sandbox config from environment.
/// Must be called once at engine startup. Subsequent calls are no-ops.
void init_sandbox_config(const SandboxConfig& config = SandboxConfig::from_env());

/// @brief Returns the global sandbox configuration (read-only after init).
const SandboxConfig& global_sandbox_config();

// ---------------------------------------------------------------------------
// Process execution with sandbox enforcement.
// ---------------------------------------------------------------------------

/// @brief Run a process with optional sandbox enforcement.
///
/// Seccomp wiring (S-8):
///   When spec.enforce_seccomp == true AND global_sandbox_config().sandbox_enabled == true:
///   - On Linux: install_seccomp_filter(spec.seccomp_rules) is called in the
///     child process before exec(). Sets ProcessResult::sandbox_seccomp=true on success.
///   - On non-Linux: logs a platform warning and adds "seccomp_not_available_on_platform"
///     to ProcessResult::theatre_audit. Does NOT abort the process.
///   Sandbox installation failure (on Linux):
///   - Logs an error and adds "seccomp_install_failed" to failed_capabilities.
///   - Returns early with a non-zero exit_code and error_message set.
///
/// When global_sandbox_config().sandbox_enabled == false:
///   - All enforcement skipped. Adds "sandbox_disabled" to theatre_audit.
ProcessResult run_process(const ProcessSpec& spec);

// Detect and return sandbox capabilities for current platform
SandboxCapabilities detect_platform_sandbox_capabilities();

// v1.2: Install seccomp-bpf filter (Linux only).
// On non-Linux platforms this is a no-op that returns false.
bool install_seccomp_filter(const std::vector<SeccompRule>& rules);

// v1.2: Apply Windows process mitigations
bool apply_windows_mitigations();

// v1.2: Create restricted token (Windows)
bool create_restricted_token();

// v1.2: Network isolation helpers
bool setup_network_namespace();  // Linux
bool enable_windows_network_isolation();  // Windows

}  // namespace requiem
