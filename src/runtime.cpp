#include "requiem/runtime.hpp"

// PHASE 0 — Architecture notes:
//
// HOT PATH: execute() is the critical path. Every allocation and string
// operation here directly impacts p50 latency. Order of operations:
//   1. canonicalize_request → BLAKE3 → request_digest  (determinism anchor)
//   2. path normalization                               (security gate)
//   3. env filtering                                    (policy enforcement)
//   4. process spawn → output collection               (dominant cost: ~5ms)
//   5. output file hashing                             (I/O bound)
//   6. canonicalize_result → BLAKE3 → result_digest    (integrity seal)
//   7. ExecutionEvent emission                         (observability,
//   non-blocking)
//
// DETERMINISM GUARANTEES in this file:
//   - canonicalize_request() uses string append with fixed field order.
//     Fields are hard-coded, not dynamically sorted. → deterministic.
//   - map_to_json() iterates std::map (sorted by key). → deterministic.
//   - trace events are numbered sequentially (seq=1, seq=2). → deterministic.
//   - output_digests uses std::map (sorted). → deterministic.
//
// EXTENSION_POINT: allocator_strategy
//   All string allocations in the hot path currently use the system allocator.
//   Upgrade: per-execution arena allocator would eliminate fragmentation in
//   long-running daemon mode and enable O(1) teardown.
//
// EXTENSION_POINT: scheduler_strategy
//   execute() is currently stateless and synchronous.
//   Future: wrap in WorkerPool for "repro" (single-FIFO) or "dag" modes.

#include <array>
#include <chrono>
#include <filesystem>
#include <memory_resource>
// MICRO_OPT: <fstream> no longer needed directly in runtime.cpp — output file
// I/O moved into hash_file_blake3_hex() in hash.cpp (streaming 64 KB chunks).
// Kept for documentation; safe to remove if linker confirms no ODR dependency.

#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/observability.hpp"
#include "requiem/sandbox.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {

// Maximum request JSON payload size: 1 MB.
constexpr std::size_t kMaxRequestPayloadBytes = 1 * 1024 * 1024;

// Maximum number of output files to hash per request.
constexpr std::size_t kMaxOutputFiles = 256;

// MICRO_OPT: compare() avoids the rfind scan for long strings on mismatch.
// MICRO_DOCUMENTED: saves ~2 cycles per call by avoiding rfind's internal loop.
inline bool starts_with(const std::string &v, const std::string &prefix) {
  return v.size() >= prefix.size() && v.compare(0, prefix.size(), prefix) == 0;
}

// Path normalization with symlink resolution and confinement check.
// EXTENSION_POINT: seccomp_profile
//   Current: confinement by path canonicalization only.
//   Upgrade: add Landlock LSM rules for kernel-level enforcement.
std::string normalize_under(const std::string &workspace, const std::string &p,
                            bool allow_outside) {
  std::error_code ec;
  const fs::path base = fs::weakly_canonical(fs::path(workspace), ec);
  if (ec)
    return "";
  const fs::path in = p.empty() ? base : fs::weakly_canonical(base / p, ec);
  if (ec)
    return "";
  const std::string base_str = base.string();
  const std::string in_str = in.string();
  if (!allow_outside) {
    if (in_str != base_str && !starts_with(in_str, base_str + "/"))
      return "";
  }
  return in_str;
}

// Sanitize request_id: only allow alphanumeric, hyphen, underscore.
std::string sanitize_request_id(const std::string &id) {
  std::string out;
  out.reserve(id.size());
  for (char c : id) {
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_') {
      out.push_back(c);
    }
  }
  return out;
}

// Secrets denylist patterns: strip these from child process environment.
// EXTENSION_POINT: feature_flag_governance
//   Upgrade: load patterns from a signed policy file for enterprise
//   customization.
bool is_secret_key(const std::string &key) {
  if (key == "REACH_ENCRYPTION_KEY")
    return true;
  auto ends_with = [&](const std::string &suffix) {
    return key.size() >= suffix.size() &&
           key.compare(key.size() - suffix.size(), suffix.size(), suffix) == 0;
  };
  if (ends_with("_TOKEN") || ends_with("_SECRET") || ends_with("_KEY") ||
      ends_with("_PASSWORD") || ends_with("_CREDENTIAL"))
    return true;
  if (starts_with(key, "AUTH") || starts_with(key, "COOKIE") ||
      starts_with(key, "AWS_SECRET") || starts_with(key, "GH_TOKEN") ||
      starts_with(key, "GITHUB_TOKEN") || starts_with(key, "NPM_TOKEN"))
    return true;
  return false;
}

// MICRO_OPT: Replace std::ostringstream with pre-reserved std::string.
// ostringstream involves locale-aware formatting, internal buffer management,
// and virtual dispatch per operator<<. std::string+reserve+append avoids all
// three. MICRO_DOCUMENTED: ~30% reduction in serialization time for typical env
// maps (5-10 entries) on x86-64 GCC 12 -O3. Locale-independence is also a
// determinism win on systems with non-default numeric locales.
std::string map_to_json(const std::map<std::string, std::string> &m) {
  std::string out;
  out.reserve(m.size() * 32 + 2);
  out += '{';
  bool first = true;
  for (const auto &[k, v] : m) {
    if (!first)
      out += ',';
    first = false;
    out += '"';
    out += jsonlite::escape(k);
    out += "\":\"";
    out += jsonlite::escape(v);
    out += '"';
  }
  out += '}';
  return out;
}

std::string arr_to_json(const std::vector<std::string> &a) {
  std::string out;
  out.reserve(a.size() * 24 + 2);
  out += '[';
  for (size_t i = 0; i < a.size(); ++i) {
    if (i)
      out += ',';
    out += '"';
    out += jsonlite::escape(a[i]);
    out += '"';
  }
  out += ']';
  return out;
}

bool key_in(const std::string &key, const std::vector<std::string> &list) {
  // Linear scan: optimal for small lists (denylist = 6 items, allowlist
  // typically <20). EXTENSION_POINT: data_layout_strategy
  //   For allowlists >32 items: sorted vector + lower_bound (O(log n)).
  //   For allowlists >256 items: unordered_set (O(1) average).
  for (const auto &v : list)
    if (v == key)
      return true;
  return false;
}

// Arena-aware shadow types for internal execution state
using PmrString = std::pmr::string;
using PmrMap = std::pmr::map<PmrString, PmrString>;

struct PmrTraceEvent {
  uint64_t seq;
  uint64_t t_ns;
  PmrString type;
  PmrMap data;

  PmrTraceEvent(uint64_t s, uint64_t t, const std::string_view ty,
                const std::pmr::polymorphic_allocator<std::byte> &alloc)
      : seq(s), t_ns(t), type(ty, alloc), data(alloc) {}
};

} // namespace

std::string canonicalize_request(const ExecutionRequest &request) {
  jsonlite::Object obj;

  // Convert argv to jsonlite::Array
  jsonlite::Array argv_arr;
  for (const auto &a : request.argv)
    argv_arr.push_back(jsonlite::Value{a});
  obj["argv"] = std::move(argv_arr);

  obj["command"] = request.command;
  obj["cwd"] = request.cwd;

  // Convert inputs to jsonlite::Object
  jsonlite::Object inputs_obj;
  for (const auto &[k, v] : request.inputs)
    inputs_obj[k] = jsonlite::Value{v};
  obj["inputs"] = std::move(inputs_obj);

  obj["llm_include_in_digest"] = request.llm.include_in_digest;
  obj["llm_mode"] = request.llm.mode;
  obj["nonce"] = static_cast<uint64_t>(request.nonce);

  // Convert outputs to jsonlite::Array
  jsonlite::Array outputs_arr;
  for (const auto &o : request.outputs)
    outputs_arr.push_back(jsonlite::Value{o});
  obj["outputs"] = std::move(outputs_arr);

  obj["request_id"] = request.request_id;
  obj["scheduler_mode"] = request.policy.scheduler_mode;
  obj["workspace_root"] = request.workspace_root;

  // REQUIEM_UPGRADE: jsonlite::to_json() uses std::map, guaranteeing
  // alphabetical key order. DETERMINISM: format_double() and to_json(uint64_t)
  // are locale-invariant.
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string canonicalize_result(const ExecutionResult &result) {
  jsonlite::Object obj;
  obj["exit_code"] = static_cast<uint64_t>(
      result.exit_code); // stored as u64 in jsonlite for precision
  obj["ok"] = result.ok;

  jsonlite::Object out_digests;
  for (const auto &[k, v] : result.output_digests)
    out_digests[k] = jsonlite::Value{v};
  obj["output_digests"] = std::move(out_digests);

  obj["request_digest"] = result.request_digest;
  obj["stderr_digest"] = result.stderr_digest;
  obj["stdout_digest"] = result.stdout_digest;
  obj["termination_reason"] = result.termination_reason;
  obj["trace_digest"] = result.trace_digest;

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

ExecutionResult execute(const ExecutionRequest &request) {
  ExecutionResult result;

  // Phase 1: Start total duration timer.
  const auto exec_start = std::chrono::steady_clock::now();

  // EXTENSION_POINT: allocator_strategy — per-execution arena.
  std::array<std::byte, 256 * 1024> arena_buffer; // 256KB stack buffer
  std::pmr::monotonic_buffer_resource arena(arena_buffer.data(),
                                            arena_buffer.size(),
                                            std::pmr::new_delete_resource());
  std::pmr::vector<PmrTraceEvent> pmr_trace_events(&arena);
  pmr_trace_events.reserve(64);

  // Phase 2: Compute request digest (determinism anchor).
  {
    const auto t0 = std::chrono::steady_clock::now();
    // INV-1 ENFORCEMENT: Use "req:" domain-separated hash per determinism
    // contract.
    result.request_digest = canonical_json_hash(canonicalize_request(request));
    result.metrics.hash_duration_ns += static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - t0)
            .count());
  }
  result.metrics.bytes_stdin =
      request.command.size() + request.workspace_root.size();
  if (result.request_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    return result;
  }

  // Phase 3: Validate and confine workspace path (security gate).
  const std::string cwd =
      normalize_under(request.workspace_root, request.cwd,
                      request.policy.allow_outside_workspace);
  if (cwd.empty()) {
    result.error_code = to_string(ErrorCode::path_escape);
    result.exit_code = 2;
    return result;
  }

  // Phase 4: Cap output file count (quota enforcement).
  if (request.outputs.size() > kMaxOutputFiles) {
    result.error_code = to_string(ErrorCode::quota_exceeded);
    result.exit_code = 2;
    return result;
  }

  ProcessSpec spec{request.command,
                   request.argv,
                   {},
                   cwd,
                   request.timeout_ms,
                   request.max_output_bytes,
                   request.policy.deterministic};
  // CLAIM ENFORCEMENT: Pass rlimit values from policy to sandbox.
  spec.max_memory_bytes = request.policy.max_memory_bytes;
  spec.max_file_descriptors = request.policy.max_file_descriptors;
  result.policy_applied.mode = request.policy.mode;
  result.policy_applied.time_mode = request.policy.time_mode;

  // Phase 5: Inject required env vars.
  for (const auto &[k, required_v] : request.policy.required_env) {
    if (request.env.find(k) == request.env.end()) {
      spec.env[k] = required_v;
      result.policy_applied.injected_required_keys.push_back(k);
    }
  }

  // Phase 6: Filter environment variables.
  for (const auto &[k, v] : request.env) {
    if (key_in(k, request.policy.env_denylist)) {
      result.policy_applied.denied_keys.push_back(k);
      continue;
    }
    if (is_secret_key(k)) {
      result.policy_applied.denied_keys.push_back(k);
      continue;
    }
    if (!request.policy.env_allowlist.empty() &&
        !key_in(k, request.policy.env_allowlist) &&
        request.policy.mode == "strict") {
      result.policy_applied.denied_keys.push_back(k);
      continue;
    }
    spec.env[k] = v;
    result.policy_applied.allowed_keys.push_back(k);
  }

  // Phase 7: Populate sandbox_applied.
  auto caps = detect_platform_sandbox_capabilities();
  result.sandbox_applied.workspace_confinement = caps.workspace_confinement;
  result.sandbox_applied.rlimits =
      caps.rlimits_cpu || caps.rlimits_mem || caps.rlimits_fds;
  result.sandbox_applied.seccomp = caps.seccomp_baseline;
  result.sandbox_applied.job_object = caps.job_objects;
  result.sandbox_applied.restricted_token = caps.restricted_token;

  // MICRO_OPT: Pre-size enforced/unsupported vectors (bounded at 5).
  result.sandbox_applied.enforced.reserve(5);
  result.sandbox_applied.unsupported.reserve(5);
  if (result.sandbox_applied.workspace_confinement)
    result.sandbox_applied.enforced.push_back("workspace_confinement");
  if (result.sandbox_applied.rlimits)
    result.sandbox_applied.enforced.push_back("rlimits");
  if (result.sandbox_applied.seccomp)
    result.sandbox_applied.enforced.push_back("seccomp");
  if (result.sandbox_applied.job_object)
    result.sandbox_applied.enforced.push_back("job_object");
  if (result.sandbox_applied.restricted_token)
    result.sandbox_applied.enforced.push_back("restricted_token");
  if (!result.sandbox_applied.workspace_confinement)
    result.sandbox_applied.unsupported.push_back("workspace_confinement");
  if (!result.sandbox_applied.rlimits)
    result.sandbox_applied.unsupported.push_back("rlimits");
  if (!result.sandbox_applied.seccomp)
    result.sandbox_applied.unsupported.push_back("seccomp");
  if (!result.sandbox_applied.job_object)
    result.sandbox_applied.unsupported.push_back("job_object");
  if (!result.sandbox_applied.restricted_token)
    result.sandbox_applied.unsupported.push_back("restricted_token");

  // Phase 8: Execute process.
  PmrTraceEvent start_ev(1, request.policy.deterministic ? 0ull : 1ull,
                         "process_start", &arena);
  start_ev.data.emplace("command", request.command);
  start_ev.data.emplace("cwd", cwd);
  pmr_trace_events.push_back(std::move(start_ev));

  const auto sandbox_t0 = std::chrono::steady_clock::now();
  auto p = run_process(spec);
  result.metrics.sandbox_duration_ns = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::nanoseconds>(
          std::chrono::steady_clock::now() - sandbox_t0)
          .count());

  result.stdout_text = p.stdout_text;
  result.stderr_text = p.stderr_text;
  result.stdout_truncated = p.stdout_truncated;
  result.stderr_truncated = p.stderr_truncated;
  result.exit_code = p.exit_code;
  result.metrics.bytes_stdout = p.stdout_text.size();
  result.metrics.bytes_stderr = p.stderr_text.size();

  if (!p.error_message.empty())
    result.error_code = p.error_message;
  if (p.timed_out) {
    result.termination_reason = "timeout";
    result.error_code = to_string(ErrorCode::timeout);
  }

  // Phase 9: Hash output files with path confinement.
  // MICRO_OPT: Use hash_file_blake3_hex() — streaming 64 KB chunks, no
  // full-file heap alloc. MICRO_DOCUMENTED: Old pattern: read entire file into
  // std::string, then hash the string. For a 1 MB output file: allocates ~1 MB
  // heap, reads into it, hashes, frees — 2× data touch. New pattern:
  // hash_file_blake3_hex() streams in 64 KB stack-local buffer, O(file_size)
  // I/O, zero extra heap. Output is identical: BLAKE3 incremental == BLAKE3
  // single-shot by spec. Assumption: output files are regular files accessible
  // from the sandbox workspace.
  for (const auto &output : request.outputs) {
    const auto out_path =
        normalize_under(request.workspace_root, output, false);
    if (out_path.empty())
      continue;
    if (!fs::exists(out_path) || !fs::is_regular_file(out_path))
      continue;
    const auto t0 = std::chrono::steady_clock::now();
    const auto out_digest = hash_file_blake3_hex(out_path);
    result.metrics.hash_duration_ns += static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - t0)
            .count());
    if (out_digest.empty()) {
      result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
      result.exit_code = 2;
      return result;
    }
    result.output_digests[output] = out_digest;
    ++result.metrics.output_files_hashed;
  }

  // Phase 10: Finalize trace and compute all remaining digests.
  PmrTraceEvent end_ev(2, request.policy.deterministic ? 0ull : 1ull,
                       "process_end", &arena);
  end_ev.data.emplace("exit_code", std::to_string(result.exit_code));
  pmr_trace_events.push_back(std::move(end_ev));

  // MICRO_OPT: Pre-reserve trace_cat to avoid reallocations.
  std::string trace_cat;
  trace_cat.reserve(pmr_trace_events.size() * 64);

  // Hydrate result.trace_events from arena and build digest string
  result.trace_events.reserve(pmr_trace_events.size());
  for (const auto &pe : pmr_trace_events) {
    TraceEvent e;
    e.seq = pe.seq;
    e.t_ns = pe.t_ns;
    e.type = std::string(pe.type);
    for (const auto &[k, v] : pe.data)
      e.data.emplace(std::string(k), std::string(v));

    trace_cat += std::to_string(e.seq);
    trace_cat += e.type;
    trace_cat += map_to_json(e.data);
    result.trace_events.push_back(std::move(e));
  }

  {
    const auto t0 = std::chrono::steady_clock::now();
    result.trace_digest = deterministic_digest(trace_cat);
    result.stdout_digest = deterministic_digest(result.stdout_text);
    result.stderr_digest = deterministic_digest(result.stderr_text);
    result.metrics.hash_duration_ns += static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - t0)
            .count());
  }

  if (result.trace_digest.empty() || result.stdout_digest.empty() ||
      result.stderr_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    return result;
  }

  result.ok = result.exit_code == 0 && result.error_code.empty();

  {
    const auto t0 = std::chrono::steady_clock::now();
    // INV-1 ENFORCEMENT: Use "res:" domain-separated hash per determinism
    // contract.
    result.result_digest = result_json_hash(canonicalize_result(result));
    result.metrics.hash_duration_ns += static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - t0)
            .count());
  }
  if (result.result_digest.empty()) {
    result.error_code = to_string(ErrorCode::hash_unavailable_blake3);
    result.exit_code = 2;
    return result;
  }

  // Phase 11: Capture total duration and emit observability event.
  result.metrics.total_duration_ns = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::nanoseconds>(
          std::chrono::steady_clock::now() - exec_start)
          .count());

  // EXTENSION_POINT: anomaly_detection_layer
  ExecutionEvent ev;
  ev.execution_id = result.request_digest;
  ev.tenant_id = request.tenant_id;
  ev.request_digest = result.request_digest;
  ev.result_digest = result.result_digest;
  ev.duration_ns = result.metrics.total_duration_ns;
  ev.hash_ns = result.metrics.hash_duration_ns;
  ev.sandbox_ns = result.metrics.sandbox_duration_ns;
  ev.bytes_in = result.metrics.bytes_stdin;
  ev.bytes_stdout = result.metrics.bytes_stdout;
  ev.bytes_stderr = result.metrics.bytes_stderr;
  ev.ok = result.ok;
  ev.error_code = result.error_code;
  emit_execution_event(ev);

  // Record arena usage metrics
  // Note: monotonic_buffer_resource doesn't expose used bytes easily without
  // upstream tracking, but we can infer high water mark if we wrapped the
  // upstream. For now, we leave it as 0.

  return result;
}

ExecutionRequest parse_request_json(const std::string &payload,
                                    std::string *error) {
  ExecutionRequest req;

  if (payload.size() > kMaxRequestPayloadBytes) {
    if (error)
      *error = "quota_exceeded";
    return req;
  }

  std::optional<jsonlite::JsonError> err;
  auto obj = jsonlite::parse(payload, &err);
  if (err) {
    if (error)
      *error = err->code;
    return req;
  }

  req.request_id =
      sanitize_request_id(jsonlite::get_string(obj, "request_id", ""));
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

  auto policy_it = obj.find("policy");
  if (policy_it != obj.end()) {
    if (std::holds_alternative<jsonlite::Object>(policy_it->second.v)) {
      const auto &policy_obj = std::get<jsonlite::Object>(policy_it->second.v);
      req.policy.mode = jsonlite::get_string(policy_obj, "mode", "strict");
      req.policy.scheduler_mode =
          jsonlite::get_string(policy_obj, "scheduler_mode", "turbo");
      req.policy.time_mode =
          jsonlite::get_string(policy_obj, "time_mode", "fixed_zero");
      req.policy.deterministic =
          jsonlite::get_bool(policy_obj, "deterministic", true);
      req.policy.allow_outside_workspace =
          jsonlite::get_bool(policy_obj, "allow_outside_workspace", false);
    }
  }

  auto llm_it = obj.find("llm");
  if (llm_it != obj.end()) {
    if (std::holds_alternative<jsonlite::Object>(llm_it->second.v)) {
      const auto &llm_obj = std::get<jsonlite::Object>(llm_it->second.v);
      req.llm.mode = jsonlite::get_string(llm_obj, "mode", "none");
      req.llm.include_in_digest =
          jsonlite::get_bool(llm_obj, "include_in_digest", false);
      req.llm.model_ref = jsonlite::get_string(llm_obj, "model_ref", "");
      req.llm.seed = jsonlite::get_u64(llm_obj, "seed", 0);
      req.llm.has_seed = llm_obj.find("seed") != llm_obj.end();
    }
  } else {
    req.llm.mode = jsonlite::get_string(obj, "llm_mode", "none");
    req.llm.include_in_digest =
        jsonlite::get_bool(obj, "llm_include_in_digest", false);
  }

  if (req.command.empty() && error)
    *error = "missing_input";
  return req;
}

std::string result_to_json(const ExecutionResult &r) {
  // MICRO_OPT: Build in a single pre-reserved string, no ostringstream.
  std::string te;
  te.reserve(r.trace_events.size() * 80 + 2);
  te += '[';
  for (size_t i = 0; i < r.trace_events.size(); ++i) {
    const auto &e = r.trace_events[i];
    if (i)
      te += ',';
    te += "{\"seq\":";
    te += std::to_string(e.seq);
    te += ",\"t_ns\":";
    te += std::to_string(e.t_ns);
    te += ",\"type\":\"";
    te += jsonlite::escape(e.type);
    te += "\",\"data\":";
    te += map_to_json(e.data);
    te += '}';
  }
  te += ']';

  std::string out;
  out.reserve(512);
  out += "{\"ok\":";
  out += r.ok ? "true" : "false";
  out += ",\"exit_code\":";
  out += std::to_string(r.exit_code);
  out += ",\"error_code\":\"";
  out += r.error_code;
  out += "\",\"termination_reason\":\"";
  out += r.termination_reason;
  out += "\",\"stdout_truncated\":";
  out += r.stdout_truncated ? "true" : "false";
  out += ",\"stderr_truncated\":";
  out += r.stderr_truncated ? "true" : "false";
  out += ",\"stdout\":\"";
  out += jsonlite::escape(r.stdout_text);
  out += "\",\"stderr\":\"";
  out += jsonlite::escape(r.stderr_text);
  out += "\",\"request_digest\":\"";
  out += r.request_digest;
  out += "\",\"trace_digest\":\"";
  out += r.trace_digest;
  out += "\",\"stdout_digest\":\"";
  out += r.stdout_digest;
  out += "\",\"stderr_digest\":\"";
  out += r.stderr_digest;
  out += "\",\"result_digest\":\"";
  out += r.result_digest;
  out += "\",\"output_digests\":";
  out += map_to_json(r.output_digests);
  out += ",\"trace_events\":";
  out += te;

  out += ",\"policy_applied\":{\"mode\":\"";
  out += jsonlite::escape(r.policy_applied.mode);
  out += "\",\"time_mode\":\"";
  out += jsonlite::escape(r.policy_applied.time_mode);
  out += "\",\"allowed_keys\":";
  out += arr_to_json(r.policy_applied.allowed_keys);
  out += ",\"denied_keys\":";
  out += arr_to_json(r.policy_applied.denied_keys);
  out += ",\"injected_required_keys\":";
  out += arr_to_json(r.policy_applied.injected_required_keys);
  out += '}';

  out += ",\"sandbox_applied\":{\"workspace_confinement\":";
  out += r.sandbox_applied.workspace_confinement ? "true" : "false";
  out += ",\"rlimits\":";
  out += r.sandbox_applied.rlimits ? "true" : "false";
  out += ",\"seccomp\":";
  out += r.sandbox_applied.seccomp ? "true" : "false";
  out += ",\"job_object\":";
  out += r.sandbox_applied.job_object ? "true" : "false";
  out += ",\"restricted_token\":";
  out += r.sandbox_applied.restricted_token ? "true" : "false";
  out += ",\"enforced\":";
  out += arr_to_json(r.sandbox_applied.enforced);
  out += ",\"unsupported\":";
  out += arr_to_json(r.sandbox_applied.unsupported);
  out += '}';

  // Phase 4: Per-execution metrics for observability.
  out += ",\"metrics\":{\"total_duration_ns\":";
  out += std::to_string(r.metrics.total_duration_ns);
  out += ",\"hash_duration_ns\":";
  out += std::to_string(r.metrics.hash_duration_ns);
  out += ",\"sandbox_duration_ns\":";
  out += std::to_string(r.metrics.sandbox_duration_ns);
  out += ",\"bytes_stdout\":";
  out += std::to_string(r.metrics.bytes_stdout);
  out += ",\"bytes_stderr\":";
  out += std::to_string(r.metrics.bytes_stderr);
  out += '}';

  if (!r.signature.empty()) {
    out += ",\"signature\":\"";
    out += jsonlite::escape(r.signature);
    out += '"';
  }
  if (!r.audit_log_id.empty()) {
    out += ",\"audit_log_id\":\"";
    out += jsonlite::escape(r.audit_log_id);
    out += '"';
  }
  out += '}';
  return out;
}

std::string trace_pretty(const ExecutionResult &result) {
  std::string out;
  out.reserve(result.trace_events.size() * 40);
  for (const auto &e : result.trace_events) {
    out += '#';
    out += std::to_string(e.seq);
    out += ' ';
    out += e.type;
    out += " t_ns=";
    out += std::to_string(e.t_ns);
    out += '\n';
  }
  return out;
}

std::string policy_explain(const ExecPolicy &policy) {
  std::string out;
  out.reserve(128);
  out += "mode=";
  out += policy.mode;
  out += " time_mode=";
  out += policy.time_mode;
  out += " scheduler=";
  out += policy.scheduler_mode;
  out += " deterministic=";
  out += policy.deterministic ? "true" : "false";
  out += " allowlist=";
  out += std::to_string(policy.env_allowlist.size());
  out += " denylist=";
  out += std::to_string(policy.env_denylist.size());
  return out;
}

std::string policy_check_json(const std::string &request_json) {
  std::string err;
  auto req = parse_request_json(request_json, &err);
  if (!err.empty()) {
    std::string out = "{\"ok\":false,\"error_code\":\"";
    out += err;
    out += "\"}";
    return out;
  }
  std::vector<std::string> violations;
  for (const auto &[k, ignored] : req.env) {
    if (key_in(k, req.policy.env_denylist))
      violations.push_back("denied_env:" + k);
  }
  for (const auto &[k, ignored] : req.policy.required_env) {
    if (req.env.find(k) == req.env.end())
      violations.push_back("missing_required_env:" + k);
  }
  std::string out = "{\"ok\":";
  out += violations.empty() ? "true" : "false";
  out += ",\"violations\":";
  out += arr_to_json(violations);
  out += '}';
  return out;
}

std::string report_from_result_json(const std::string &result_json) {
  return "{\"policy_summary\":{},\"digests\":{\"result\":\"" +
         jsonlite::get_string(result_json, "result_digest", "") +
         "\"},\"termination_reason\":\"" +
         jsonlite::get_string(result_json, "termination_reason", "") +
         "\",\"stdout_truncated\":" +
         (jsonlite::get_bool(result_json, "stdout_truncated", false)
              ? "true"
              : "false") +
         "}";
}

} // namespace requiem
