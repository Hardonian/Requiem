#include "requiem/types.hpp"

#include <sstream>

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
    case ErrorCode::config_invalid: return "config_invalid";
    case ErrorCode::proof_verification_failed: return "proof_verification_failed";
    case ErrorCode::signature_unavailable: return "signature_unavailable";
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
  if (seccomp_bpf) result.push_back("seccomp_bpf");
  if (job_objects) result.push_back("job_objects");
  if (restricted_token) result.push_back("restricted_token");
  if (process_mitigations) result.push_back("process_mitigations");
  if (network_isolation) result.push_back("network_isolation");
  return result;
}

std::vector<std::string> SandboxCapabilities::unsupported() const {
  std::vector<std::string> result;
  if (!workspace_confinement) result.push_back("workspace_confinement");
  if (!rlimits_cpu) result.push_back("rlimits_cpu");
  if (!rlimits_mem) result.push_back("rlimits_mem");
  if (!rlimits_fds) result.push_back("rlimits_fds");
  if (!seccomp_baseline) result.push_back("seccomp_baseline");
  if (!seccomp_bpf) result.push_back("seccomp_bpf");
  if (!job_objects) result.push_back("job_objects");
  if (!restricted_token) result.push_back("restricted_token");
  if (!process_mitigations) result.push_back("process_mitigations");
  if (!network_isolation) result.push_back("network_isolation");
  return result;
}

std::vector<std::string> SandboxCapabilities::partial() const {
  // v1.2: Report capabilities that are partially enforced
  std::vector<std::string> result;
  // Currently no partial enforcement, but this is where we'd report
  // things like "seccomp_baseline" when we have some but not all filters
  return result;
}

SandboxCapabilities detect_sandbox_capabilities() {
  SandboxCapabilities caps;
  
#ifdef _WIN32
  // Windows capabilities
  caps.job_objects = true;  // We use Job Objects
  caps.restricted_token = false;  // Not yet implemented (v1.2 target)
  caps.process_mitigations = false;  // Not yet implemented (v1.2 target)
  caps.workspace_confinement = true;  // Handled by path normalization
  caps.rlimits_cpu = false;
  caps.rlimits_mem = false;
  caps.rlimits_fds = false;
  caps.seccomp_baseline = false;
  caps.seccomp_bpf = false;
  caps.network_isolation = false;  // v1.2 target
#else
  // Linux/POSIX capabilities
  caps.workspace_confinement = true;  // Handled by path normalization
  caps.rlimits_cpu = true;  // Can set via setrlimit
  caps.rlimits_mem = true;  // Can set via setrlimit
  caps.rlimits_fds = true;  // Can set via setrlimit
  caps.seccomp_baseline = false;  // Not yet implemented (v1.2 target)
  caps.seccomp_bpf = false;  // Not yet implemented (v1.2 target)
  caps.job_objects = false;
  caps.restricted_token = false;
  caps.process_mitigations = false;
  caps.network_isolation = false;  // v1.2 target (via network namespace)
#endif

  return caps;
}

// ProofBundle implementation
std::string ProofBundle::to_json() const {
  std::ostringstream oss;
  oss << "{\"merkle_root\":\"" << merkle_root << "\",";
  oss << "\"input_digests\":[";
  for (size_t i = 0; i < input_digests.size(); ++i) {
    if (i > 0) oss << ",";
    oss << "\"" << input_digests[i] << "\"";
  }
  oss << "],\"output_digests\":[";
  for (size_t i = 0; i < output_digests.size(); ++i) {
    if (i > 0) oss << ",";
    oss << "\"" << output_digests[i] << "\"";
  }
  oss << "],\"policy_digest\":\"" << policy_digest << "\",";
  oss << "\"replay_transcript_digest\":\"" << replay_transcript_digest << "\",";
  oss << "\"signature_stub\":\"" << signature_stub << "\",";
  oss << "\"engine_version\":\"" << engine_version << "\",";
  oss << "\"contract_version\":\"" << contract_version << "\"}";
  return oss.str();
}

std::optional<ProofBundle> ProofBundle::from_json(const std::string& json) {
  // Simple parsing - in production would use proper JSON parser
  ProofBundle bundle;
  // Extract fields using simple string search
  auto extract_string = [&](const std::string& key) -> std::string {
    auto pos = json.find("\"" + key + "\"");
    if (pos == std::string::npos) return "";
    auto colon = json.find(":", pos);
    if (colon == std::string::npos) return "";
    auto quote = json.find("\"", colon);
    if (quote == std::string::npos) return "";
    auto end = json.find("\"", quote + 1);
    if (end == std::string::npos) return "";
    return json.substr(quote + 1, end - quote - 1);
  };
  
  bundle.merkle_root = extract_string("merkle_root");
  bundle.policy_digest = extract_string("policy_digest");
  bundle.replay_transcript_digest = extract_string("replay_transcript_digest");
  bundle.signature_stub = extract_string("signature_stub");
  bundle.engine_version = extract_string("engine_version");
  bundle.contract_version = extract_string("contract_version");
  
  if (bundle.merkle_root.empty()) return std::nullopt;
  return bundle;
}

// ExecutionMetrics implementation
std::string ExecutionMetrics::to_json() const {
  std::ostringstream oss;
  oss << "{\"exec_total\":" << exec_total << ",";
  oss << "\"exec_fail\":" << exec_fail << ",";
  oss << "\"timeouts\":" << timeouts << ",";
  oss << "\"queue_full\":" << queue_full << ",";
  oss << "\"latency_buckets\":{";
  bool first = true;
  for (const auto& [k, v] : latency_buckets) {
    if (!first) oss << ",";
    first = false;
    oss << "\"" << k << "\":" << v;
  }
  oss << "},\"cas_bytes_total\":" << cas_bytes_total << ",";
  oss << "\"cas_objects_total\":" << cas_objects_total << ",";
  oss << "\"cas_hit_rate\":" << cas_hit_rate << "}";
  return oss.str();
}

std::string ExecutionMetrics::to_prometheus() const {
  std::ostringstream oss;
  oss << "# HELP requiem_exec_total Total executions\n";
  oss << "# TYPE requiem_exec_total counter\n";
  oss << "requiem_exec_total " << exec_total << "\n\n";
  
  oss << "# HELP requiem_exec_fail Failed executions\n";
  oss << "# TYPE requiem_exec_fail counter\n";
  oss << "requiem_exec_fail " << exec_fail << "\n\n";
  
  oss << "# HELP requiem_timeouts Total timeouts\n";
  oss << "# TYPE requiem_timeouts counter\n";
  oss << "requiem_timeouts " << timeouts << "\n\n";
  
  oss << "# HELP requiem_cas_bytes_total Total CAS bytes stored\n";
  oss << "# TYPE requiem_cas_bytes_total gauge\n";
  oss << "requiem_cas_bytes_total " << cas_bytes_total << "\n\n";
  
  oss << "# HELP requiem_cas_objects_total Total CAS objects\n";
  oss << "# TYPE requiem_cas_objects_total gauge\n";
  oss << "requiem_cas_objects_total " << cas_objects_total << "\n\n";
  
  oss << "# HELP requiem_cas_hit_rate CAS cache hit rate\n";
  oss << "# TYPE requiem_cas_hit_rate gauge\n";
  oss << "requiem_cas_hit_rate " << cas_hit_rate << "\n";
  
  return oss.str();
}

}  // namespace requiem
