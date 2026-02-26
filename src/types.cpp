#include "requiem/types.hpp"

namespace requiem {

std::string to_string(ErrorCode code) {
  switch (code) {
    case ErrorCode::none: return "";
    case ErrorCode::json_parse_error: return "json_parse_error";
    case ErrorCode::json_duplicate_key: return "json_duplicate_key";
    case ErrorCode::path_escape: return "path_escape";
    case ErrorCode::missing_input: return "missing_input";
    case ErrorCode::spawn_failed: return "spawn_failed";
    case ErrorCode::timeout: return "timeout";
    case ErrorCode::cas_integrity_failed: return "cas_integrity_failed";
    case ErrorCode::replay_failed: return "replay_failed";
    case ErrorCode::drift_detected: return "drift_detected";
    case ErrorCode::hash_unavailable_blake3: return "hash_unavailable_blake3";
    case ErrorCode::sandbox_unavailable: return "sandbox_unavailable";
    case ErrorCode::quota_exceeded: return "quota_exceeded";
  }
  return "";
}

std::vector<std::string> SandboxCapabilities::enforced() const {
  std::vector<std::string> result;
  if (workspace_confinement) result.push_back("workspace_confinement");
  if (rlimits_cpu) result.push_back("rlimits_cpu");
  if (rlimits_mem) result.push_back("rlimits_mem");
  if (rlimits_fds) result.push_back("rlimits_fds");
  if (seccomp_baseline) result.push_back("seccomp_baseline");
  if (job_objects) result.push_back("job_objects");
  if (restricted_token) result.push_back("restricted_token");
  if (process_mitigations) result.push_back("process_mitigations");
  return result;
}

std::vector<std::string> SandboxCapabilities::unsupported() const {
  std::vector<std::string> result;
  if (!workspace_confinement) result.push_back("workspace_confinement");
  if (!rlimits_cpu) result.push_back("rlimits_cpu");
  if (!rlimits_mem) result.push_back("rlimits_mem");
  if (!rlimits_fds) result.push_back("rlimits_fds");
  if (!seccomp_baseline) result.push_back("seccomp_baseline");
  if (!job_objects) result.push_back("job_objects");
  if (!restricted_token) result.push_back("restricted_token");
  if (!process_mitigations) result.push_back("process_mitigations");
  return result;
}

SandboxCapabilities detect_sandbox_capabilities() {
  SandboxCapabilities caps;
  
#ifdef _WIN32
  // Windows capabilities
  caps.job_objects = true;  // We use Job Objects
  caps.restricted_token = false;  // Not yet implemented
  caps.process_mitigations = false;  // Not yet implemented
  caps.workspace_confinement = true;  // Handled by path normalization
  caps.rlimits_cpu = false;
  caps.rlimits_mem = false;
  caps.rlimits_fds = false;
  caps.seccomp_baseline = false;
#else
  // Linux/POSIX capabilities
  caps.workspace_confinement = true;  // Handled by path normalization
  caps.rlimits_cpu = true;  // Can set via setrlimit
  caps.rlimits_mem = true;  // Can set via setrlimit
  caps.rlimits_fds = true;  // Can set via setrlimit
  caps.seccomp_baseline = false;  // Not yet implemented
  caps.job_objects = false;
  caps.restricted_token = false;
  caps.process_mitigations = false;
#endif

  return caps;
}

}  // namespace requiem
