#include "requiem/runtime.hpp"

#include <filesystem>
#include <fstream>
#include <sstream>

#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/sandbox.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {
bool starts_with(const std::string& v, const std::string& prefix) { return v.rfind(prefix, 0) == 0; }

std::string normalize_under(const std::string& workspace, const std::string& p, bool allow_outside) {
  const fs::path base = fs::weakly_canonical(fs::path(workspace));
  const fs::path in = p.empty() ? base : fs::weakly_canonical(base / p);
  if (!allow_outside && !starts_with(in.string(), base.string())) return "";
  return in.string();
}

std::string map_to_json(const std::map<std::string, std::string>& m) {
  std::ostringstream oss;
  oss << "{";
  bool first = true;
  for (const auto& [k, v] : m) {
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
  return oss.str();
}

ExecutionResult execute(const ExecutionRequest& request) {
  ExecutionResult result;
  result.request_digest = deterministic_digest(canonicalize_request(request));
  if (result.request_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    return result;
  }
  const std::string cwd = normalize_under(request.workspace_root, request.cwd, request.policy.allow_outside_workspace);
  if (cwd.empty()) {
    result.error_code = to_string(ErrorCode::path_escape);
    result.exit_code = 2;
    return result;
  }

  ProcessSpec spec{request.command, request.argv, {}, cwd, request.timeout_ms, request.max_output_bytes, request.policy.deterministic};
  result.policy_applied.mode = request.policy.mode;
  result.policy_applied.time_mode = request.policy.time_mode;
  for (const auto& [k, required_v] : request.policy.required_env) {
    if (request.env.find(k) == request.env.end()) {
      spec.env[k] = required_v;
      result.policy_applied.injected_required_keys.push_back(k);
    }
  }
  for (const auto& [k, v] : request.env) {
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
  
  // Build enforced/unsupported lists
  if (result.sandbox_applied.workspace_confinement) result.sandbox_applied.enforced.push_back("workspace_confinement");
  if (result.sandbox_applied.rlimits) result.sandbox_applied.enforced.push_back("rlimits");
  if (result.sandbox_applied.seccomp) result.sandbox_applied.enforced.push_back("seccomp");
  if (result.sandbox_applied.job_object) result.sandbox_applied.enforced.push_back("job_object");
  if (result.sandbox_applied.restricted_token) result.sandbox_applied.enforced.push_back("restricted_token");
  
  if (!result.sandbox_applied.workspace_confinement) result.sandbox_applied.unsupported.push_back("workspace_confinement");
  if (!result.sandbox_applied.rlimits) result.sandbox_applied.unsupported.push_back("rlimits");
  if (!result.sandbox_applied.seccomp) result.sandbox_applied.unsupported.push_back("seccomp");
  if (!result.sandbox_applied.job_object) result.sandbox_applied.unsupported.push_back("job_object");
  if (!result.sandbox_applied.restricted_token) result.sandbox_applied.unsupported.push_back("restricted_token");

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

  for (const auto& output : request.outputs) {
    const auto out_path = normalize_under(request.workspace_root, output, false);
    if (out_path.empty() || !fs::exists(out_path)) continue;
    std::ifstream ifs(out_path, std::ios::binary);
    std::string bytes((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
    const auto out_digest = deterministic_digest(bytes);
    if (out_digest.empty()) {
      result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
      result.exit_code = 2;
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
    return result;
  }
  result.ok = result.exit_code == 0 && result.error_code.empty();
  result.result_digest = deterministic_digest(canonicalize_result(result));
  if (result.result_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    return result;
  }
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
    }
  } else {
    // Fallback to top-level fields for backward compatibility
    req.llm.mode = jsonlite::get_string(obj, "llm_mode", "none");
    req.llm.include_in_digest = jsonlite::get_bool(obj, "llm_include_in_digest", false);
  }
  
  if (req.command.empty() && error) *error = "missing_input";
  return req;
}

std::string result_to_json(const ExecutionResult& r) {
  std::ostringstream te;
  te << "[";
  for (size_t i = 0; i < r.trace_events.size(); ++i) {
    const auto& e = r.trace_events[i];
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
      << ",\"enforced\":" << arr_to_json(r.sandbox_applied.enforced)
      << ",\"unsupported\":" << arr_to_json(r.sandbox_applied.unsupported) << "}";
  
  // Add enterprise fields if present
  if (!r.signature.empty()) {
    oss << ",\"signature\":\"" << jsonlite::escape(r.signature) << "\"";
  }
  if (!r.audit_log_id.empty()) {
    oss << ",\"audit_log_id\":\"" << jsonlite::escape(r.audit_log_id) << "\"";
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
  return oss.str();
}

std::string policy_check_json(const std::string& request_json) {
  std::string err;
  auto req = parse_request_json(request_json, &err);
  if (!err.empty()) return "{\"ok\":false,\"error_code\":\"" + err + "\"}";
  std::vector<std::string> violations;
  for (const auto& [k, _] : req.env) {
    if (key_in(k, req.policy.env_denylist)) violations.push_back("denied_env:" + k);
  }
  for (const auto& [k, _] : req.policy.required_env) {
    if (req.env.find(k) == req.env.end()) violations.push_back("missing_required_env:" + k);
  }
  std::ostringstream oss;
  oss << "{\"ok\":" << (violations.empty() ? "true" : "false") << ",\"violations\":" << arr_to_json(violations) << "}";
  return oss.str();
}

std::string report_from_result_json(const std::string& result_json) {
  return "{\"policy_summary\":{},\"digests\":{\"result\":\"" + jsonlite::get_string(result_json, "result_digest", "") +
         "\"},\"termination_reason\":\"" + jsonlite::get_string(result_json, "termination_reason", "") +
         "\",\"stdout_truncated\":" + (jsonlite::get_bool(result_json, "stdout_truncated", false) ? "true" : "false") + "}";
}

}  // namespace requiem
