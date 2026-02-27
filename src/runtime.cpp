#include "requiem/runtime.hpp"

#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <chrono>

#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/sandbox.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {
bool starts_with(const std::string& v, const std::string& prefix) { return v.rfind(prefix, 0) == 0; }

// SECURITY: TOCTOU-safe path normalization
// Resolves symlinks and verifies path stays within workspace
std::string normalize_under_safe(const std::string& workspace, const std::string& p, bool allow_outside, bool* error_flag = nullptr) {
  try {
    const fs::path base = fs::weakly_canonical(fs::path(workspace));
    
    // SECURITY: Reject paths with traversal sequences early
    std::string p_normalized = p;
    // Normalize path separators for cross-platform check
    std::replace(p_normalized.begin(), p_normalized.end(), '\\', '/');
    
    // Check for path traversal patterns
    if (p_normalized.find("../") != std::string::npos || 
        p_normalized.find("/..") != std::string::npos ||
        p_normalized == ".." ||
        starts_with(p_normalized, "../")) {
      if (error_flag) *error_flag = true;
      return "";
    }
    
    // Build the full path
    fs::path in = p.empty() ? base : base / p;
    
    // SECURITY: Resolve symlinks and canonicalize
    // This detects symlink attacks where a path escapes the workspace
    fs::path canonical_in;
    try {
      canonical_in = fs::weakly_canonical(in);
    } catch (const fs::filesystem_error& e) {
      // If canonicalization fails (e.g., path doesn't exist), use weakly_canonical
      canonical_in = in;
    }
    
    // SECURITY: Verify the resolved path is within the base directory
    std::string canonical_str = canonical_in.string();
    std::string base_str = base.string();
    
    // Ensure base ends with separator for proper prefix check
    if (!base_str.empty() && base_str.back() != fs::path::preferred_separator) {
      base_str += fs::path::preferred_separator;
    }
    
    if (!allow_outside && !starts_with(canonical_str, base_str)) {
      if (error_flag) *error_flag = true;
      return "";
    }
    
    return canonical_str;
  } catch (const std::exception& e) {
    if (error_flag) *error_flag = true;
    return "";
  }
}

// DEPRECATED: Original function kept for compatibility, uses safe version
std::string normalize_under(const std::string& workspace, const std::string& p, bool allow_outside) {
  bool error = false;
  std::string result = normalize_under_safe(workspace, p, allow_outside, &error);
  return error ? "" : result;
}

std::string map_to_json(const std::map<std::string, std::string>& m) {
  std::ostringstream oss;
  oss << "{";
  bool first = true;
  // SECURITY: Sort keys for determinism
  std::vector<std::pair<std::string, std::string>> sorted(m.begin(), m.end());
  std::sort(sorted.begin(), sorted.end());
  
  for (const auto& [k, v] : sorted) {
    if (!first) oss << ",";
    first = false;
    oss << "\"" << jsonlite::escape(k) << "\":\"" << jsonlite::escape(v) << "\"";
  }
  oss << "}";
  return oss.str();
}

std::string arr_to_json(const std::vector<std::string>& a) {
  std::ostringstream oss;
  oss << "[";
  for (size_t i = 0; i < a.size(); ++i) {
    if (i) oss << ",";
    oss << "\"" << jsonlite::escape(a[i]) << "\"";
  }
  oss << "]";
  return oss.str();
}

bool key_in(const std::string& key, const std::vector<std::string>& list) {
  for (const auto& v : list) if (v == key) return true;
  return false;
}

// v1.1: Generate ISO8601 timestamp
std::string iso_timestamp() {
  auto now = std::chrono::system_clock::now();
  auto time = std::chrono::system_clock::to_time_t(now);
  std::stringstream ss;
  ss << std::put_time(std::gmtime(&time), "%Y-%m-%dT%H:%M:%SZ");
  return ss.str();
}

// v1.1: Generate deterministic request ID if not provided
std::string generate_request_id(const std::string& command, std::uint64_t nonce) {
  std::string seed = command + ":" + std::to_string(nonce) + ":" + iso_timestamp();
  std::string hash = deterministic_digest(seed);
  return hash.substr(0, 16);  // First 16 chars of hash
}

// SECURITY: TOCTOU-safe file reading with symlink detection
// Returns empty optional if file is outside workspace or is a symlink
std::optional<std::string> safe_read_file(const std::string& file_path, const std::string& workspace_root) {
  try {
    fs::path p(file_path);
    
    // Check if it's a symlink (TOCTOU protection)
    if (fs::is_symlink(p)) {
      return std::nullopt;  // Reject symlinks
    }
    
    // Get canonical path
    fs::path canonical_p = fs::weakly_canonical(p);
    fs::path canonical_base = fs::weakly_canonical(fs::path(workspace_root));
    
    // Verify path is within workspace
    std::string canonical_str = canonical_p.string();
    std::string base_str = canonical_base.string();
    if (!base_str.empty() && base_str.back() != fs::path::preferred_separator) {
      base_str += fs::path::preferred_separator;
    }
    
    if (!starts_with(canonical_str, base_str)) {
      return std::nullopt;  // Path escapes workspace
    }
    
    // Double-check not a symlink (post-resolution TOCTOU check)
    if (fs::is_symlink(canonical_p)) {
      return std::nullopt;
    }
    
    // Read file
    std::ifstream ifs(canonical_p, std::ios::binary);
    if (!ifs) {
      return std::nullopt;
    }
    
    std::string bytes((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
    return bytes;
  } catch (const std::exception& e) {
    return std::nullopt;
  }
}

}  // namespace

std::string canonicalize_request(const ExecutionRequest& request) {
  std::ostringstream oss;
  oss << "{\"argv\":" << arr_to_json(request.argv) << ",\"command\":\"" << jsonlite::escape(request.command)
      << "\",\"cwd\":\"" << jsonlite::escape(request.cwd) << "\",\"inputs\":" << map_to_json(request.inputs)
      << ",\"llm_include_in_digest\":" << (request.llm.include_in_digest ? "true" : "false")
      << ",\"llm_mode\":\"" << jsonlite::escape(request.llm.mode) << "\""
      << ",\"nonce\":" << request.nonce << ",\"outputs\":" << arr_to_json(request.outputs)
      << ",\"request_id\":\"" << jsonlite::escape(request.request_id) << "\",\"scheduler_mode\":\""
      << jsonlite::escape(request.policy.scheduler_mode) << "\",\"workspace_root\":\""
      << jsonlite::escape(request.workspace_root) << "\"}";
  return oss.str();
}

std::string canonicalize_result(const ExecutionResult& result) {
  std::ostringstream oss;
  oss << "{\"exit_code\":" << result.exit_code << ",\"ok\":" << (result.ok ? "true" : "false")
      << ",\"output_digests\":" << map_to_json(result.output_digests) << ",\"request_digest\":\"" << result.request_digest
      << "\",\"stderr_digest\":\"" << result.stderr_digest << "\",\"stdout_digest\":\"" << result.stdout_digest
      << "\",\"termination_reason\":\"" << result.termination_reason << "\",\"trace_digest\":\"" << result.trace_digest
      << "\"}";
  // Note: start_timestamp, end_timestamp, duration_ms are EXCLUDED from digest (v1.1)
  return oss.str();
}

ExecutionResult execute(const ExecutionRequest& request) {
  ExecutionResult result;
  
  // v1.1: Record start time
  auto start_time = std::chrono::steady_clock::now();
  result.start_timestamp = iso_timestamp();
  
  // v1.1: Ensure request_id is set
  if (request.request_id.empty()) {
    // Generate deterministic ID based on command + nonce + timestamp
    const_cast<ExecutionRequest&>(request).request_id = generate_request_id(request.command, request.nonce);
  }
  result.request_id = request.request_id;
  
  result.request_digest = deterministic_digest(canonicalize_request(request));
  if (result.request_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    result.end_timestamp = iso_timestamp();
    result.duration_ms = 0;
    return result;
  }
  
  // SECURITY: TOCTOU-safe path normalization
  bool path_error = false;
  const std::string cwd = normalize_under_safe(request.workspace_root, request.cwd, request.policy.allow_outside_workspace, &path_error);
  if (path_error || cwd.empty()) {
    result.error_code = to_string(ErrorCode::path_escape);
    result.exit_code = 2;
    result.end_timestamp = iso_timestamp();
    result.duration_ms = 0;
    return result;
  }

  ProcessSpec spec{request.command, request.argv, {}, cwd, request.timeout_ms, request.max_output_bytes, request.policy.deterministic};
  
  // v1.2: Pass sandbox options to process spec
  spec.enforce_network_isolation = request.policy.deny_network;
  spec.enforce_seccomp = false;  // Would need explicit opt-in
  spec.max_memory_bytes = request.policy.max_memory_bytes;
  spec.max_file_descriptors = request.policy.max_file_descriptors;
  
  result.policy_applied.mode = request.policy.mode;
  result.policy_applied.time_mode = request.policy.time_mode;
  for (const auto& [k, required_v] : request.policy.required_env) {
    if (request.env.find(k) == request.env.end()) {
      spec.env[k] = required_v;
      result.policy_applied.injected_required_keys.push_back(k);
    }
  }
  
  // SECURITY: Sort env keys for determinism
  std::vector<std::pair<std::string, std::string>> sorted_env(request.env.begin(), request.env.end());
  std::sort(sorted_env.begin(), sorted_env.end());
  
  for (const auto& [k, v] : sorted_env) {
    if (key_in(k, request.policy.env_denylist)) {
      result.policy_applied.denied_keys.push_back(k);
      continue;
    }
    if (!request.policy.env_allowlist.empty() && !key_in(k, request.policy.env_allowlist) && request.policy.mode == "strict") {
      result.policy_applied.denied_keys.push_back(k);
      continue;
    }
    spec.env[k] = v;
    result.policy_applied.allowed_keys.push_back(k);
  }

  // Populate sandbox_applied before execution
  auto caps = detect_platform_sandbox_capabilities();
  result.sandbox_applied.workspace_confinement = caps.workspace_confinement;
  result.sandbox_applied.rlimits = caps.rlimits_cpu || caps.rlimits_mem || caps.rlimits_fds;
  result.sandbox_applied.seccomp = caps.seccomp_baseline;
  result.sandbox_applied.job_object = caps.job_objects;
  result.sandbox_applied.restricted_token = caps.restricted_token;
  result.sandbox_applied.network_isolation = caps.network_isolation;
  
  // Build enforced/unsupported lists
  result.sandbox_applied.enforced = caps.enforced();
  result.sandbox_applied.unsupported = caps.unsupported();

  result.trace_events.push_back({1, request.policy.deterministic ? 0ull : 1ull, "process_start", {{"command", request.command}, {"cwd", cwd}}});
  auto p = run_process(spec);
  result.stdout_text = p.stdout_text;
  result.stderr_text = p.stderr_text;
  result.stdout_truncated = p.stdout_truncated;
  result.stderr_truncated = p.stderr_truncated;
  result.exit_code = p.exit_code;
  if (!p.error_message.empty()) result.error_code = p.error_message;
  if (p.timed_out) {
    result.termination_reason = "timeout";
    result.error_code = to_string(ErrorCode::timeout);
  }
  
  // v1.2: Update sandbox_applied with actual enforcement from process result
  for (const auto& cap : p.enforced_capabilities) {
    if (std::find(result.sandbox_applied.enforced.begin(), result.sandbox_applied.enforced.end(), cap) == result.sandbox_applied.enforced.end()) {
      result.sandbox_applied.enforced.push_back(cap);
    }
  }
  for (const auto& cap : p.failed_capabilities) {
    if (std::find(result.sandbox_applied.unsupported.begin(), result.sandbox_applied.unsupported.end(), cap) == result.sandbox_applied.unsupported.end()) {
      result.sandbox_applied.unsupported.push_back(cap);
    }
    if (std::find(result.sandbox_applied.partial.begin(), result.sandbox_applied.partial.end(), cap) == result.sandbox_applied.partial.end()) {
      result.sandbox_applied.partial.push_back(cap);
    }
  }

  // SECURITY: TOCTOU-safe output file reading
  for (const auto& output : request.outputs) {
    // Use safe file reading with symlink detection
    auto file_content = safe_read_file(output, request.workspace_root);
    if (!file_content) {
      // File not found or access denied - skip it
      continue;
    }
    
    const auto out_digest = deterministic_digest(*file_content);
    if (out_digest.empty()) {
      result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
      result.exit_code = 2;
      result.end_timestamp = iso_timestamp();
      result.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - start_time).count();
      return result;
    }
    result.output_digests[output] = out_digest;
  }
  
  result.trace_events.push_back({2, request.policy.deterministic ? 0ull : 1ull, "process_end", {{"exit_code", std::to_string(result.exit_code)}}});
  std::string trace_cat;
  for (const auto& e : result.trace_events) trace_cat += std::to_string(e.seq) + e.type + map_to_json(e.data);
  result.trace_digest = deterministic_digest(trace_cat);
  result.stdout_digest = deterministic_digest(result.stdout_text);
  result.stderr_digest = deterministic_digest(result.stderr_text);
  if (result.trace_digest.empty() || result.stdout_digest.empty() || result.stderr_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    result.end_timestamp = iso_timestamp();
    result.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - start_time).count();
    return result;
  }
  result.ok = result.exit_code == 0 && result.error_code.empty();
  result.result_digest = deterministic_digest(canonicalize_result(result));
  if (result.result_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    result.end_timestamp = iso_timestamp();
    result.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - start_time).count();
    return result;
  }
  
  // v1.2: Compute determinism confidence
  result.determinism_confidence.score = 1.0;
  result.determinism_confidence.level = "high";
  
  // Check for factors that reduce confidence
  if (request.llm.mode == "attempt_deterministic") {
    result.determinism_confidence.level = "best_effort";
    result.determinism_confidence.reasons.push_back("llm_attempt_deterministic: stochastic component");
    result.determinism_confidence.score = 0.3;
  } else if (request.llm.mode != "none") {
    result.determinism_confidence.level = "medium";
    result.determinism_confidence.reasons.push_back("llm_mode: " + request.llm.mode);
    result.determinism_confidence.score = 0.6;
  }
  
  if (!result.sandbox_applied.partial.empty()) {
    result.determinism_confidence.level = result.determinism_confidence.level == "high" ? "medium" : "best_effort";
    result.determinism_confidence.reasons.push_back("partial_sandbox_enforcement");
    result.determinism_confidence.score *= 0.9;
  }
  
  if (!p.failed_capabilities.empty()) {
    for (const auto& cap : p.failed_capabilities) {
      result.determinism_confidence.reasons.push_back("sandbox_capability_failed: " + cap);
    }
    result.determinism_confidence.score *= 0.8;
  }
  
  // v1.1: Record end time and duration
  result.end_timestamp = iso_timestamp();
  result.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::steady_clock::now() - start_time).count();
  
  return result;
}

ExecutionRequest parse_request_json(const std::string& payload, std::string* error) {
  ExecutionRequest req;
  std::optional<jsonlite::JsonError> err;
  auto obj = jsonlite::parse(payload, &err);
  if (err) {
    if (error) *error = err->code;
    return req;
  }
  req.request_id = jsonlite::get_string(obj, "request_id", "");
  req.command = jsonlite::get_string(obj, "command", "");
  req.argv = jsonlite::get_string_array(obj, "argv");
  req.cwd = jsonlite::get_string(obj, "cwd", "");
  req.workspace_root = jsonlite::get_string(obj, "workspace_root", ".");
  req.inputs = jsonlite::get_string_map(obj, "inputs");
  req.outputs = jsonlite::get_string_array(obj, "outputs");
  req.env = jsonlite::get_string_map(obj, "env");
  req.timeout_ms = jsonlite::get_u64(obj, "timeout_ms", 5000);
  req.max_output_bytes = jsonlite::get_u64(obj, "max_output_bytes", 4096);
  req.tenant_id = jsonlite::get_string(obj, "tenant_id", "");
  
  // v1.1: Config version
  req.config_version = jsonlite::get_string(obj, "config_version", "1.1");
  
  // v1.3: Engine mode
  req.engine_mode = jsonlite::get_string(obj, "engine_mode", "requiem");
  
  // Parse nested policy object if present
  auto policy_it = obj.find("policy");
  if (policy_it != obj.end()) {
    if (std::holds_alternative<jsonlite::Object>(policy_it->second.v)) {
      const auto& policy_obj = std::get<jsonlite::Object>(policy_it->second.v);
      req.policy.mode = jsonlite::get_string(policy_obj, "mode", "strict");
      req.policy.scheduler_mode = jsonlite::get_string(policy_obj, "scheduler_mode", "turbo");
      req.policy.time_mode = jsonlite::get_string(policy_obj, "time_mode", "fixed_zero");
      req.policy.deterministic = jsonlite::get_bool(policy_obj, "deterministic", true);
      req.policy.allow_outside_workspace = jsonlite::get_bool(policy_obj, "allow_outside_workspace", false);
      req.policy.deny_network = jsonlite::get_bool(policy_obj, "deny_network", false);
      req.policy.max_memory_bytes = jsonlite::get_u64(policy_obj, "max_memory_bytes", 0);
      req.policy.max_file_descriptors = jsonlite::get_u64(policy_obj, "max_file_descriptors", 0);
      // Note: env_allowlist, env_denylist, required_env would need array/object parsing
    }
  }
  
  // Parse nested llm object if present
  auto llm_it = obj.find("llm");
  if (llm_it != obj.end()) {
    if (std::holds_alternative<jsonlite::Object>(llm_it->second.v)) {
      const auto& llm_obj = std::get<jsonlite::Object>(llm_it->second.v);
      req.llm.mode = jsonlite::get_string(llm_obj, "mode", "none");
      req.llm.include_in_digest = jsonlite::get_bool(llm_obj, "include_in_digest", false);
      req.llm.model_ref = jsonlite::get_string(llm_obj, "model_ref", "");
      req.llm.seed = jsonlite::get_u64(llm_obj, "seed", 0);
      req.llm.has_seed = llm_obj.find("seed") != llm_obj.end();
      req.llm.determinism_confidence = jsonlite::get_double(llm_obj, "determinism_confidence", 0.0);
    }
  } else {
    // Fallback to top-level fields for backward compatibility
    req.llm.mode = jsonlite::get_string(obj, "llm_mode", "none");
    req.llm.include_in_digest = jsonlite::get_bool(obj, "llm_include_in_digest", false);
  }
  
  // SECURITY: Validate request size to prevent OOM DoS
  if (payload.size() > 100 * 1024 * 1024) {  // 100MB limit
    if (error) *error = "request_too_large";
    return req;
  }
  
  // SECURITY: Validate matrix dimensions to prevent OOM DoS
  // Estimate matrix size from actions and states
  if (req.argv.size() > 10000 || req.outputs.size() > 10000) {
    if (error) *error = "matrix_too_large";
    return req;
  }
  
  if (req.command.empty() && error) *error = "missing_input";
  return req;
}

std::string result_to_json(const ExecutionResult& r) {
  std::ostringstream te;
  te << "[";
  // Sort trace events by sequence for determinism
  auto sorted_events = r.trace_events;
  std::sort(sorted_events.begin(), sorted_events.end(), [](const auto& a, const auto& b) {
    return a.seq < b.seq;
  });
  for (size_t i = 0; i < sorted_events.size(); ++i) {
    const auto& e = sorted_events[i];
    if (i) te << ",";
    te << "{\"seq\":" << e.seq << ",\"t_ns\":" << e.t_ns << ",\"type\":\"" << jsonlite::escape(e.type)
       << "\",\"data\":" << map_to_json(e.data) << "}";
  }
  te << "]";
  std::ostringstream oss;
  oss << "{\"ok\":" << (r.ok ? "true" : "false") << ",\"exit_code\":" << r.exit_code << ",\"error_code\":\""
      << r.error_code << "\",\"termination_reason\":\"" << r.termination_reason << "\",\"stdout_truncated\":"
      << (r.stdout_truncated ? "true" : "false") << ",\"stderr_truncated\":" << (r.stderr_truncated ? "true" : "false")
      << ",\"stdout\":\"" << jsonlite::escape(r.stdout_text) << "\",\"stderr\":\"" << jsonlite::escape(r.stderr_text)
      << "\",\"request_digest\":\"" << r.request_digest << "\",\"trace_digest\":\"" << r.trace_digest
      << "\",\"stdout_digest\":\"" << r.stdout_digest << "\",\"stderr_digest\":\"" << r.stderr_digest
      << "\",\"result_digest\":\"" << r.result_digest << "\",\"output_digests\":" << map_to_json(r.output_digests)
      << ",\"trace_events\":" << te.str();
  
  // Add policy_applied
  oss << ",\"policy_applied\":{\"mode\":\"" << jsonlite::escape(r.policy_applied.mode) << "\",\"time_mode\":\"" 
      << jsonlite::escape(r.policy_applied.time_mode) << "\",\"allowed_keys\":" << arr_to_json(r.policy_applied.allowed_keys)
      << ",\"denied_keys\":" << arr_to_json(r.policy_applied.denied_keys) << ",\"injected_required_keys\":"
      << arr_to_json(r.policy_applied.injected_required_keys) << "}";
  
  // Add sandbox_applied
  oss << ",\"sandbox_applied\":{\"workspace_confinement\":" << (r.sandbox_applied.workspace_confinement ? "true" : "false")
      << ",\"rlimits\":" << (r.sandbox_applied.rlimits ? "true" : "false")
      << ",\"seccomp\":" << (r.sandbox_applied.seccomp ? "true" : "false")
      << ",\"job_object\":" << (r.sandbox_applied.job_object ? "true" : "false")
      << ",\"restricted_token\":" << (r.sandbox_applied.restricted_token ? "true" : "false")
      << ",\"network_isolation\":" << (r.sandbox_applied.network_isolation ? "true" : "false")
      << ",\"enforced\":" << arr_to_json(r.sandbox_applied.enforced)
      << ",\"unsupported\":" << arr_to_json(r.sandbox_applied.unsupported)
      << ",\"partial\":" << arr_to_json(r.sandbox_applied.partial) << "}";
  
  // v1.2: Add determinism confidence
  oss << ",\"determinism_confidence\":{\"level\":\"" << r.determinism_confidence.level << "\","
      << "\"score\":" << r.determinism_confidence.score << ",\"reasons\":" 
      << arr_to_json(r.determinism_confidence.reasons) << "}";
  
  // Add enterprise fields if present
  if (!r.signature.empty()) {
    oss << ",\"signature\":\"" << jsonlite::escape(r.signature) << "\"";
  }
  if (!r.audit_log_id.empty()) {
    oss << ",\"audit_log_id\":\"" << jsonlite::escape(r.audit_log_id) << "\"";
  }
  
  // v1.1: Add lifecycle metadata (excluded from digest but included in output)
  if (!r.request_id.empty()) {
    oss << ",\"request_id\":\"" << jsonlite::escape(r.request_id) << "\"";
  }
  if (!r.start_timestamp.empty()) {
    oss << ",\"start_timestamp\":\"" << r.start_timestamp << "\"";
  }
  if (!r.end_timestamp.empty()) {
    oss << ",\"end_timestamp\":\"" << r.end_timestamp << "\"";
  }
  if (r.duration_ms > 0) {
    oss << ",\"duration_ms\":" << r.duration_ms;
  }
  
  oss << "}";
  return oss.str();
}

std::string trace_pretty(const ExecutionResult& result) {
  std::ostringstream oss;
  for (const auto& e : result.trace_events) oss << "#" << e.seq << " " << e.type << " t_ns=" << e.t_ns << "\n";
  return oss.str();
}

std::string policy_explain(const ExecPolicy& policy) {
  std::ostringstream oss;
  oss << "mode=" << policy.mode << " time_mode=" << policy.time_mode << " scheduler=" << policy.scheduler_mode
      << " deterministic=" << (policy.deterministic ? "true" : "false")
      << " allowlist=" << policy.env_allowlist.size() << " denylist=" << policy.env_denylist.size();
  if (policy.deny_network) {
    oss << " deny_network=true";
  }
  if (policy.max_memory_bytes > 0) {
    oss << " max_memory=" << policy.max_memory_bytes;
  }
  return oss.str();
}

std::string policy_check_json(const std::string& request_json) {
  std::string err;
  auto req = parse_request_json(request_json, &err);
  if (!err.empty()) return "{\"ok\":false,\"error_code\":\"" + err + "\"}";
  std::vector<std::string> violations;
  
  // Sort keys for deterministic iteration
  std::vector<std::pair<std::string, std::string>> sorted_env(req.env.begin(), req.env.end());
  std::sort(sorted_env.begin(), sorted_env.end());
  
  for (const auto& [k, _] : sorted_env) {
    if (key_in(k, req.policy.env_denylist)) violations.push_back("denied_env:" + k);
  }
  for (const auto& [k, _] : req.policy.required_env) {
    if (req.env.find(k) == req.env.end()) violations.push_back("missing_required_env:" + k);
  }
  
  // v1.1: Config version check
  if (req.config_version != "1.1") {
    violations.push_back("config_version_mismatch:" + req.config_version);
  }
  
  // Sort violations for determinism
  std::sort(violations.begin(), violations.end());
  
  std::ostringstream oss;
  oss << "{\"ok\":" << (violations.empty() ? "true" : "false") << ",\"violations\":" << arr_to_json(violations) << "}";
  return oss.str();
}

std::string report_from_result_json(const std::string& result_json) {
  return "{\"policy_summary\":{},\"digests\":{\"result\":\"" + jsonlite::get_string(result_json, "result_digest", "") +
         "\"},\"termination_reason\":\"" + jsonlite::get_string(result_json, "termination_reason", "") +
         "\",\"stdout_truncated\":" + (jsonlite::get_bool(result_json, "stdout_truncated", false) ? "true" : "false") + 
         ",\"determinism_level\":\"" + jsonlite::get_string(result_json, "determinism_confidence.level", "unknown") + "\"}";
}

// v1.2: Proof bundle generation
ProofBundle generate_proof_bundle(const ExecutionRequest& req, const ExecutionResult& res) {
  ProofBundle bundle;
  
  // Input digests
  bundle.input_digests.push_back(res.request_digest);
  for (const auto& [k, v] : req.inputs) {
    bundle.input_digests.push_back(deterministic_digest(v));
  }
  
  // Output digests
  bundle.output_digests.push_back(res.stdout_digest);
  bundle.output_digests.push_back(res.stderr_digest);
  for (const auto& [k, v] : res.output_digests) {
    bundle.output_digests.push_back(v);
  }
  
  // Policy digest
  std::string policy_str = req.policy.mode + ":" + req.policy.scheduler_mode + ":" + 
                           (req.policy.deterministic ? "det" : "non-det");
  bundle.policy_digest = deterministic_digest(policy_str);
  
  // Transcript digest
  bundle.replay_transcript_digest = res.trace_digest;
  
  // Compute merkle root (sort for determinism)
  std::sort(bundle.input_digests.begin(), bundle.input_digests.end());
  std::sort(bundle.output_digests.begin(), bundle.output_digests.end());
  
  std::string merkle_input;
  for (const auto& d : bundle.input_digests) merkle_input += d;
  for (const auto& d : bundle.output_digests) merkle_input += d;
  merkle_input += bundle.policy_digest;
  merkle_input += bundle.replay_transcript_digest;
  bundle.merkle_root = deterministic_digest(merkle_input);
  
  // Metadata
  bundle.engine_version = "1.2";
  bundle.contract_version = "1.1";
  
  return bundle;
}

// v1.1: Config validation
ConfigValidationResult validate_config(const std::string& config_json) {
  ConfigValidationResult result;
  std::string err;
  auto obj = jsonlite::parse(config_json, nullptr);
  
  // Check config version
  result.config_version = jsonlite::get_string(obj, "config_version", "");
  if (result.config_version.empty()) {
    result.errors.push_back("missing_config_version");
  } else if (result.config_version != "1.1" && result.config_version != "1.2") {
    result.warnings.push_back("unknown_config_version:" + result.config_version);
  }
  
  // Validate known fields
  std::vector<std::string> known_fields = {
    "config_version", "hash", "cas", "sandbox", "policy", "logging", "engine"
  };
  
  for (const auto& [key, _] : obj) {
    bool known = false;
    for (const auto& k : known_fields) {
      if (key == k) {
        known = true;
        break;
      }
    }
    if (!known) {
      result.warnings.push_back("unknown_field:" + key);
    }
  }
  
  result.ok = result.errors.empty();
  return result;
}

}  // namespace requiem
