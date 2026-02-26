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
  std::ostringstream oss; oss << "{";
  bool first = true;
  for (const auto& [k, v] : m) { if (!first) oss << ","; first = false; oss << "\"" << jsonlite::escape(k) << "\":\"" << jsonlite::escape(v) << "\""; }
  oss << "}"; return oss.str();
}

std::string arr_to_json(const std::vector<std::string>& a) {
  std::ostringstream oss; oss << "[";
  for (size_t i=0;i<a.size();++i){ if(i)oss<<","; oss << "\"" << jsonlite::escape(a[i]) << "\""; }
  oss << "]"; return oss.str();
}
}  // namespace

std::string canonicalize_request(const ExecutionRequest& request) {
  std::ostringstream oss;
  oss << "{\"argv\":" << arr_to_json(request.argv)
      << ",\"command\":\"" << jsonlite::escape(request.command)
      << "\",\"cwd\":\"" << jsonlite::escape(request.cwd)
      << "\",\"inputs\":" << map_to_json(request.inputs)
      << ",\"nonce\":" << request.nonce
      << ",\"outputs\":" << arr_to_json(request.outputs)
      << ",\"request_id\":\"" << jsonlite::escape(request.request_id)
      << "\",\"workspace_root\":\"" << jsonlite::escape(request.workspace_root) << "\"}";
  return oss.str();
}

std::string canonicalize_result(const ExecutionResult& result) {
  std::ostringstream oss;
  oss << "{\"exit_code\":" << result.exit_code
      << ",\"ok\":" << (result.ok ? "true" : "false")
      << ",\"output_digests\":" << map_to_json(result.output_digests)
      << ",\"request_digest\":\"" << result.request_digest
      << "\",\"stderr_digest\":\"" << deterministic_digest(result.stderr_text)
      << "\",\"stdout_digest\":\"" << deterministic_digest(result.stdout_text)
      << "\",\"termination_reason\":\"" << result.termination_reason
      << "\",\"trace_digest\":\"" << result.trace_digest << "\"}";
  return oss.str();
}

ExecutionResult execute(const ExecutionRequest& request) {
  ExecutionResult result;
  result.request_digest = deterministic_digest(canonicalize_request(request));
  const std::string cwd = normalize_under(request.workspace_root, request.cwd, request.policy.allow_outside_workspace);
  if (cwd.empty()) { result.error_code = "path_escape"; result.exit_code = 2; return result; }

  ProcessSpec spec{request.command, request.argv, {}, cwd, request.timeout_ms, request.max_output_bytes, request.policy.deterministic};
  if (request.policy.deterministic && request.env.find("PYTHONHASHSEED") == request.env.end()) spec.env["PYTHONHASHSEED"] = "0";
  for (const auto& [k,v] : request.env) {
    bool denied=false; for (const auto& d: request.policy.env_denylist) if (k==d) denied=true;
    if (!denied || !request.policy.deterministic) spec.env[k]=v;
  }

  result.trace_events.push_back({1, request.policy.deterministic ? 0 : 1, "process_start", {{"command", request.command}, {"cwd", cwd}}});
  auto p = run_process(spec);
  result.stdout_text = p.stdout_text; result.stderr_text = p.stderr_text;
  result.stdout_truncated = p.stdout_truncated; result.stderr_truncated = p.stderr_truncated;
  result.exit_code = p.exit_code; if (!p.error_message.empty()) result.error_code = p.error_message;
  if (p.timed_out) result.termination_reason = "timeout";

  for (const auto& output : request.outputs) {
    const auto out_path = normalize_under(request.workspace_root, output, false);
    if (out_path.empty() || !fs::exists(out_path)) continue;
    std::ifstream ifs(out_path, std::ios::binary);
    std::string bytes((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
    result.output_digests[output] = deterministic_digest(bytes);
  }
  result.trace_events.push_back({2, request.policy.deterministic ? 0 : 1, "process_end", {{"exit_code", std::to_string(result.exit_code)}}});
  std::string trace_cat;
  for (const auto& e : result.trace_events) trace_cat += std::to_string(e.seq) + e.type;
  result.trace_digest = deterministic_digest(trace_cat);
  result.ok = result.exit_code == 0 && result.error_code.empty();
  result.result_digest = deterministic_digest(canonicalize_result(result));
  return result;
}

ExecutionRequest parse_request_json(const std::string& payload, std::string* error) {
  ExecutionRequest req;
  req.request_id = jsonlite::get_string(payload, "request_id", "");
  req.command = jsonlite::get_string(payload, "command", "");
  req.argv = jsonlite::get_string_array(payload, "argv");
  req.cwd = jsonlite::get_string(payload, "cwd", "");
  req.workspace_root = jsonlite::get_string(payload, "workspace_root", ".");
  req.inputs = jsonlite::get_string_map(payload, "inputs");
  req.outputs = jsonlite::get_string_array(payload, "outputs");
  req.env = jsonlite::get_string_map(payload, "env");
  req.timeout_ms = jsonlite::get_u64(payload, "timeout_ms", 5000);
  req.max_output_bytes = jsonlite::get_u64(payload, "max_output_bytes", 4096);
  req.policy.deterministic = jsonlite::get_bool(payload, "deterministic", true);
  if (req.command.empty() && error) *error = "command is required";
  return req;
}

std::string result_to_json(const ExecutionResult& r) {
  std::ostringstream te;
  te << "[";
  for (size_t i=0;i<r.trace_events.size();++i) {
    const auto& e = r.trace_events[i];
    if (i) te << ",";
    te << "{\"seq\":" << e.seq << ",\"t_ns\":" << e.t_ns << ",\"type\":\"" << jsonlite::escape(e.type)
       << "\",\"data\":" << map_to_json(e.data) << "}";
  }
  te << "]";

  std::ostringstream oss;
  oss << "{\n"
      << "  \"ok\": " << (r.ok?"true":"false") << ",\n"
      << "  \"exit_code\": " << r.exit_code << ",\n"
      << "  \"error_code\": \"" << jsonlite::escape(r.error_code) << "\",\n"
      << "  \"termination_reason\": \"" << jsonlite::escape(r.termination_reason) << "\",\n"
      << "  \"stdout\": \"" << jsonlite::escape(r.stdout_text) << "\",\n"
      << "  \"stderr\": \"" << jsonlite::escape(r.stderr_text) << "\",\n"
      << "  \"stdout_truncated\": " << (r.stdout_truncated?"true":"false") << ",\n"
      << "  \"stderr_truncated\": " << (r.stderr_truncated?"true":"false") << ",\n"
      << "  \"request_digest\": \"" << r.request_digest << "\",\n"
      << "  \"trace_digest\": \"" << r.trace_digest << "\",\n"
      << "  \"result_digest\": \"" << r.result_digest << "\",\n"
      << "  \"output_digests\": " << map_to_json(r.output_digests) << ",\n"
      << "  \"trace\": {\"events\": " << te.str() << "}\n"
      << "}\n";
  return oss.str();
}

std::string trace_pretty(const ExecutionResult& result) {
  std::ostringstream oss;
  for (const auto& e : result.trace_events) { oss << "#" << e.seq << " [" << e.type << "]\n"; }
  return oss.str();
}

std::string policy_explain(const ExecPolicy& p) {
  std::ostringstream oss;
  oss << "deterministic=" << (p.deterministic?"true":"false") << "\n";
  oss << "allow_outside_workspace=" << (p.allow_outside_workspace?"true":"false") << "\n";
  oss << "inherit_env=" << (p.inherit_env?"true":"false") << "\n";
  return oss.str();
}

}  // namespace requiem
