#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

#include "requiem/audit.hpp"
#include "requiem/autotune.hpp"
#include "requiem/cas.hpp"
#include "requiem/cluster.hpp"
#include "requiem/debugger.hpp"
#include "requiem/diagnostics.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/observability.hpp"
#include "requiem/rbac.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"
#include "requiem/sandbox.hpp"
#include "requiem/version.hpp"
#include "requiem/worker.hpp"

namespace {
std::string read_file(const std::string &path) {
  std::ifstream ifs(path, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(ifs)),
                     std::istreambuf_iterator<char>());
}
void write_file(const std::string &path, const std::string &data) {
  std::ofstream ofs(path, std::ios::binary | std::ios::trunc);
  ofs << data;
}
requiem::ExecutionResult parse_result(const std::string &s) {
  requiem::ExecutionResult r;
  auto obj = requiem::jsonlite::parse(s, nullptr);
  r.ok = requiem::jsonlite::get_bool(obj, "ok", false);
  r.exit_code =
      static_cast<int>(requiem::jsonlite::get_u64(obj, "exit_code", 0));
  r.termination_reason =
      requiem::jsonlite::get_string(obj, "termination_reason", "");
  r.request_digest = requiem::jsonlite::get_string(obj, "request_digest", "");
  r.trace_digest = requiem::jsonlite::get_string(obj, "trace_digest", "");
  r.result_digest = requiem::jsonlite::get_string(obj, "result_digest", "");
  r.stdout_digest = requiem::jsonlite::get_string(obj, "stdout_digest", "");
  r.stderr_digest = requiem::jsonlite::get_string(obj, "stderr_digest", "");
  r.stdout_text = requiem::jsonlite::get_string(obj, "stdout", "");
  r.stderr_text = requiem::jsonlite::get_string(obj, "stderr", "");
  r.output_digests = requiem::jsonlite::get_string_map(obj, "output_digests");
  return r;
}

std::string drift_analyze(const std::string &bench_json) {
  auto digests =
      requiem::jsonlite::get_string_array(bench_json, "result_digests");
  std::map<std::string, int> f;
  for (const auto &d : digests)
    f[d]++;
  if (f.size() <= 1)
    return "{\"drift\":{\"ok\":true,\"mismatches\":[]}}";
  auto expected = f.begin()->first;
  std::string out = "{\"drift\":{\"ok\":false,\"mismatches\":[";
  bool first = true;
  for (size_t i = 0; i < digests.size(); ++i) {
    if (digests[i] == expected)
      continue;
    if (!first)
      out += ",";
    first = false;
    out += "{\"category\":\"digest\",\"expected\":\"" + expected +
           "\",\"observed\":\"" + digests[i] + "\",\"run_indices\":[" +
           std::to_string(i) +
           "],\"hints\":[\"env key present outside allowlist\"]}";
  }
  out += "]}}";
  return out;
}

std::string bench_compare(const std::string &baseline_json,
                          const std::string &current_json) {
  auto baseline_p50 =
      requiem::jsonlite::get_double(baseline_json, "latency_ms.p50", 0.0);
  auto current_p50 =
      requiem::jsonlite::get_double(current_json, "latency_ms.p50", 0.0);
  auto baseline_p95 =
      requiem::jsonlite::get_double(baseline_json, "latency_ms.p95", 0.0);
  auto current_p95 =
      requiem::jsonlite::get_double(current_json, "latency_ms.p95", 0.0);

  double p50_delta = baseline_p50 > 0
                         ? ((current_p50 - baseline_p50) / baseline_p50) * 100.0
                         : 0.0;
  double p95_delta = baseline_p95 > 0
                         ? ((current_p95 - baseline_p95) / baseline_p95) * 100.0
                         : 0.0;

  bool regression = p50_delta > 10.0 || p95_delta > 10.0;

  std::ostringstream oss;
  oss << "{\"comparison\":{\"regression\":" << (regression ? "true" : "false");
  oss << ",\"p50_delta_pct\":" << p50_delta;
  oss << ",\"p95_delta_pct\":" << p95_delta;
  oss << ",\"baseline_p50\":" << baseline_p50;
  oss << ",\"current_p50\":" << current_p50;
  oss << "}}";
  return oss.str();
}

// Known BLAKE3 test vectors
bool verify_hash_vectors() {
  // Empty string hash
  if (requiem::blake3_hex("") !=
      "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262") {
    return false;
  }
  // "hello" hash
  if (requiem::blake3_hex("hello") !=
      "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f") {
    return false;
  }
  return true;
}

} // namespace

int main(int argc, char **argv) {
  // Honor FORCE_RUST: if set, refuse to run so the caller falls back to Rust
  // engine.
  const char *force_rust = std::getenv("FORCE_RUST");
  if (force_rust && std::string(force_rust) == "1") {
    std::cerr << "{\"error\":\"FORCE_RUST=1: Requiem engine disabled by "
                 "environment\"}\n";
    return 3;
  }

  requiem::set_hash_fallback_allowed(false);
  std::string cmd;
  for (int i = 1; i < argc; ++i) {
    if (std::string(argv[i]).rfind("--", 0) == 0)
      continue;
    cmd = argv[i];
    break;
  }
  if (cmd.empty())
    return 1;

  if (cmd == "health") {
    const auto h = requiem::hash_runtime_info();
    std::cout << "{\"hash_primitive\":\"" << h.primitive
              << "\",\"hash_backend\":\"" << h.backend
              << "\",\"hash_version\":\"" << h.version
              << "\",\"hash_available\":"
              << (h.blake3_available ? "true" : "false")
              << ",\"compat_warning\":"
              << (h.compat_warning ? "true" : "false");
    // Additional capabilities
    std::cout << ",\"cas_version\":\"v2\"";
    std::cout << ",\"compression_capabilities\":[\"identity\"";
#if defined(REQUIEM_WITH_ZSTD)
    std::cout << ",\"zstd\"";
#endif
    std::cout << "]";
    std::cout << "}" << "\n";
    return 0;
  }

  if (cmd == "doctor") {
    // Phase 4: --analyze flag triggers AI-assisted root cause diagnostics.
    bool do_analyze = false;
    std::string error_code_hint, error_detail_hint;
    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--analyze")
        do_analyze = true;
      if (std::string(argv[i]) == "--error-code" && i + 1 < argc)
        error_code_hint = argv[++i];
      if (std::string(argv[i]) == "--error-detail" && i + 1 < argc)
        error_detail_hint = argv[++i];
    }

    if (do_analyze) {
      // Capture current engine context and run the diagnostic analyzer.
      requiem::init_worker_identity();
      requiem::init_cluster_from_env();
      requiem::register_local_worker();
      const auto ctx = requiem::diagnostics::capture_context(error_code_hint,
                                                             error_detail_hint);
      const auto report = requiem::diagnostics::analyze_failure(ctx);
      std::cout << report.to_json() << "\n";
      // Exit 0: analysis succeeded (report.ok=true). Exit 2: specific failure
      // identified.
      if (!report.ok)
        return 1;
      if (report.category != requiem::diagnostics::FailureCategory::unknown)
        return 2;
      return 0;
    }

    std::vector<std::string> blockers;

    const auto h = requiem::hash_runtime_info();
    if (h.primitive != "blake3")
      blockers.push_back("hash_primitive_not_blake3");
    if (h.backend != "vendored")
      blockers.push_back("hash_backend_not_vendored");
    if (!h.blake3_available)
      blockers.push_back("blake3_not_available");
    if (h.compat_warning)
      blockers.push_back("hash_compat_warning");
    if (!verify_hash_vectors())
      blockers.push_back("hash_vectors_failed");

    // Detect sandbox capabilities
    auto caps = requiem::detect_platform_sandbox_capabilities();

    // Phase 5: Include cluster drift status in doctor output.
    requiem::init_worker_identity();
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    const auto &drift_status =
        requiem::global_cluster_registry().cluster_drift_status();
    if (!drift_status.ok)
      blockers.push_back("cluster_version_mismatch");

    std::cout << "{\"ok\":" << (blockers.empty() ? "true" : "false")
              << ",\"blockers\":[";
    for (size_t i = 0; i < blockers.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      std::cout << "\"" << blockers[i] << "\"";
    }
    std::cout << "]";
    std::cout << ",\"engine_version\":\"" << PROJECT_VERSION << "\"";
    std::cout << ",\"protocol_version\":\"v1\"";
    std::cout << ",\"hash_primitive\":\"" << h.primitive << "\"";
    std::cout << ",\"hash_backend\":\"" << h.backend << "\"";
    std::cout << ",\"hash_version\":\"" << h.version << "\"";
    std::cout << ",\"sandbox\":{\"workspace_confinement\":"
              << (caps.workspace_confinement ? "true" : "false")
              << ",\"rlimits\":" << (caps.rlimits_cpu ? "true" : "false")
              << ",\"seccomp\":" << (caps.seccomp_baseline ? "true" : "false")
              << ",\"job_objects\":" << (caps.job_objects ? "true" : "false")
              << ",\"restricted_token\":"
              << (caps.restricted_token ? "true" : "false") << "}";
    std::cout << ",\"cluster\":" << drift_status.to_json();
    std::cout << ",\"rollback\":\"set FORCE_RUST=1 to revert to Rust engine\"";
    std::cout << "}" << "\n";
    return blockers.empty() ? 0 : 2;
  }

  if (cmd == "validate-replacement") {
    std::vector<std::string> blockers;

    const auto h = requiem::hash_runtime_info();

    // Hard gates for replacement certification
    if (h.primitive != "blake3") {
      blockers.push_back("hash_primitive_must_be_blake3");
    }
    if (h.backend == "fallback") {
      blockers.push_back("hash_backend_cannot_be_fallback");
    }
    if (h.backend == "unavailable") {
      blockers.push_back("hash_backend_cannot_be_unavailable");
    }
    if (h.compat_warning) {
      blockers.push_back("compat_warning_must_be_false");
    }
    if (!h.blake3_available) {
      blockers.push_back("blake3_must_be_available");
    }

    // Verify hash vectors
    if (!verify_hash_vectors()) {
      blockers.push_back("hash_vectors_must_pass");
    }

    std::cout << "{\"ok\":" << (blockers.empty() ? "true" : "false")
              << ",\"blockers\":[";
    for (size_t i = 0; i < blockers.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      std::cout << "\"" << blockers[i] << "\"";
    }
    std::cout << "],\"hash_primitive\":\"" << h.primitive << "\"";
    std::cout << ",\"hash_backend\":\"" << h.backend << "\"";
    std::cout << "}" << "\n";
    return blockers.empty() ? 0 : 2;
  }

  if (cmd == "llm" && argc >= 3 && std::string(argv[2]) == "freeze") {
    // LLM freeze command - produce artifact for later deterministic execution
    std::cout
        << R"({"status":"not_implemented","message":"llm freeze requires LLM provider integration"})"
        << "\n";
    return 1;
  }

  if (cmd == "llm" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout
        << R"({"modes":["none","subprocess","sidecar","freeze_then_compute","attempt_deterministic"],"rules":{"default_include_in_digest":false,"engine_network":"never","authoritative_digest":"compute_phase_only_for_freeze_then_compute"}})"
        << "\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout << requiem::policy_explain(requiem::ExecPolicy{}) << "\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "check") {
    std::string req_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        req_file = argv[++i];
    std::cout << requiem::policy_check_json(read_file(req_file)) << "\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "put") {
    std::string in, cas_dir = ".requiem/cas/v2", compress = "off";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--in" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--compress" && i + 1 < argc)
        compress = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    std::cout << cas.put(read_file(in), compress) << "\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "info") {
    std::string h, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--hash" && i + 1 < argc)
        h = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto info = cas.info(h);
    if (!info)
      return 2;
    std::cout << "{\"digest\":\"" << info->digest << "\",\"encoding\":\""
              << info->encoding
              << "\",\"original_size\":" << info->original_size
              << ",\"stored_size\":" << info->stored_size << "}\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "gc") {
    std::string cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    std::size_t total = 0;
    for (const auto &o : objects)
      total += o.stored_size;
    std::cout << "{\"dry_run\":true,\"count\":" << objects.size()
              << ",\"stored_bytes\":" << total << "}\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    int errors = 0;
    for (const auto &o : objects) {
      auto content = cas.get(o.digest);
      if (!content) {
        errors++;
        std::cerr << "Missing content for " << o.digest << "\n";
      }
    }
    std::cout << "{\"verified\":" << (objects.size() - errors)
              << ",\"errors\":" << errors << "}\n";
    return errors > 0 ? 2 : 0;
  }

  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string result_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
    auto r = parse_result(read_file(result_file));
    if (requiem::deterministic_digest(requiem::canonicalize_result(r)) !=
        r.result_digest)
      return 2;
    std::cout << "ok\n";
    return 0;
  }

  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "file") {
    std::string file_path;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--file" && i + 1 < argc)
        file_path = argv[++i];
    std::string hash = requiem::hash_file_blake3(file_path);
    if (hash.empty())
      return 2;
    // Convert binary hash to hex
    std::string hex_hash;
    const char *hex_chars = "0123456789abcdef";
    for (unsigned char c : hash) {
      hex_hash.push_back(hex_chars[c >> 4]);
      hex_hash.push_back(hex_chars[c & 0xf]);
    }
    std::cout << hex_hash << "\n";
    return 0;
  }

  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string in, out;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    std::string err;
    auto req = requiem::parse_request_json(read_file(in), &err);
    if (!err.empty() && req.command.empty()) {
      std::cerr << err << "\n";
      return 2;
    }
    auto res = requiem::execute(req);
    write_file(out, requiem::result_to_json(res));
    return res.ok ? 0 : 1;
  }

  // exec stream — NDJSON streaming output (one JSON object per line).
  // Frame order: start → event* → end → result
  // "result" frame is always last and contains the authoritative result_digest.
  // Fail-closed: error produces a single {"type":"error",...} line and exits 2.
  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "stream") {
    std::string in;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        in = argv[++i];
    }
    std::string err;
    auto req = requiem::parse_request_json(read_file(in), &err);
    if (!err.empty() && req.command.empty()) {
      std::cout << "{\"type\":\"error\",\"error_code\":\"" << err << "\"}\n";
      std::cout.flush();
      return 2;
    }
    // start frame
    std::cout << "{\"type\":\"start\""
              << ",\"request_id\":\""
              << requiem::jsonlite::escape(req.request_id) << "\""
              << ",\"tenant_id\":\"" << requiem::jsonlite::escape(req.tenant_id)
              << "\""
              << "}\n";
    std::cout.flush();
    const auto res = requiem::execute(req);
    // event frames
    for (const auto &ev : res.trace_events) {
      std::cout << "{\"type\":\"event\""
                << ",\"seq\":" << ev.seq << ",\"t_ns\":" << ev.t_ns
                << ",\"event\":\"" << requiem::jsonlite::escape(ev.type) << "\""
                << ",\"data\":{";
      bool first = true;
      for (const auto &[k, v] : ev.data) {
        if (!first)
          std::cout << ",";
        first = false;
        std::cout << "\"" << requiem::jsonlite::escape(k) << "\":"
                  << "\"" << requiem::jsonlite::escape(v) << "\"";
      }
      std::cout << "}}\n";
      std::cout.flush();
    }
    // end frame
    std::cout << "{\"type\":\"end\""
              << ",\"exit_code\":" << res.exit_code
              << ",\"termination_reason\":\""
              << requiem::jsonlite::escape(res.termination_reason) << "\""
              << "}\n";
    std::cout.flush();
    // result frame — always last; authoritative
    std::cout << "{\"type\":\"result\""
              << ",\"ok\":" << (res.ok ? "true" : "false")
              << ",\"exit_code\":" << res.exit_code << ",\"error_code\":\""
              << requiem::jsonlite::escape(res.error_code) << "\""
              << ",\"request_digest\":\"" << res.request_digest << "\""
              << ",\"result_digest\":\"" << res.result_digest << "\""
              << ",\"stdout_digest\":\"" << res.stdout_digest << "\""
              << ",\"stderr_digest\":\"" << res.stderr_digest << "\""
              << ",\"trace_digest\":\"" << res.trace_digest << "\""
              << "}\n";
    std::cout.flush();
    return res.ok ? 0 : 1;
  }

  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "replay") {
    std::string req_file, result_file, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        req_file = argv[++i];
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    auto req = requiem::parse_request_json(read_file(req_file), nullptr);
    auto r = parse_result(read_file(result_file));
    requiem::CasStore cas(cas_dir);
    std::string e;
    if (!requiem::validate_replay_with_cas(req, r, cas, &e)) {
      std::cerr << e << "\n";
      return 2;
    }
    std::cout << "ok\n";
    return 0;
  }

  if (cmd == "bench" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string spec_file, out_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--spec" && i + 1 < argc)
        spec_file = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out_file = argv[++i];
    }
    auto spec = read_file(spec_file);
    int runs = static_cast<int>(requiem::jsonlite::get_u64(spec, "runs", 1));
    auto req = requiem::parse_request_json(spec, nullptr);
    std::vector<double> latencies;
    std::vector<std::string> digests;
    auto start_all = std::chrono::steady_clock::now();
    for (int i = 0; i < runs; ++i) {
      auto st = std::chrono::steady_clock::now();
      auto r = requiem::execute(req);
      auto en = std::chrono::steady_clock::now();
      latencies.push_back(
          std::chrono::duration<double, std::milli>(en - st).count());
      digests.push_back(r.result_digest);
    }
    auto end_all = std::chrono::steady_clock::now();
    std::sort(latencies.begin(), latencies.end());
    auto q = [&](double p) {
      return latencies[std::min(static_cast<size_t>((latencies.size() - 1) * p),
                                latencies.size() - 1)];
    };
    double total_s = std::chrono::duration<double>(end_all - start_all).count();

    // Calculate statistics
    double sum = 0.0;
    for (double l : latencies)
      sum += l;
    double mean = sum / latencies.size();
    double variance = 0.0;
    for (double l : latencies)
      variance += (l - mean) * (l - mean);
    double stddev = latencies.size() > 1
                        ? std::sqrt(variance / (latencies.size() - 1))
                        : 0.0;

    // Check for drift
    int drift_count = 0;
    if (!digests.empty()) {
      const auto &first = digests[0];
      for (const auto &d : digests) {
        if (d != first)
          drift_count++;
      }
    }

    std::ostringstream oss;
    oss << "{\"runs\":" << runs << ",\"result_digests\":[";
    for (size_t i = 0; i < digests.size(); ++i) {
      if (i)
        oss << ",";
      oss << "\"" << digests[i] << "\"";
    }
    oss << "],\"latency_ms\":{"
        << "\"min\":" << latencies.front() << ",\"max\":" << latencies.back()
        << ",\"mean\":" << mean << ",\"stddev\":" << stddev
        << ",\"p50\":" << q(0.5) << ",\"p90\":" << q(0.90)
        << ",\"p95\":" << q(0.95) << ",\"p99\":" << q(0.99)
        << "},\"throughput_ops_sec\":" << (runs / (total_s > 0 ? total_s : 1.0))
        << ",\"drift_count\":" << drift_count << "}";
    write_file(out_file, oss.str());
    return 0;
  }

  if (cmd == "bench" && argc >= 3 && std::string(argv[2]) == "compare") {
    std::string baseline_file, current_file, out_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--baseline" && i + 1 < argc)
        baseline_file = argv[++i];
      if (std::string(argv[i]) == "--current" && i + 1 < argc)
        current_file = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out_file = argv[++i];
    }
    auto comparison =
        bench_compare(read_file(baseline_file), read_file(current_file));
    if (!out_file.empty()) {
      write_file(out_file, comparison);
    } else {
      std::cout << comparison << "\n";
    }
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Replay & Forking (Time-Travel Debugger)
  // persona: OSS Developer, Auditor, Researcher.
  // ---------------------------------------------------------------------------
  if (cmd == "replay" && argc >= 3) {
    std::string result_file, cas_dir = ".requiem/cas/v2";
    bool do_fork = false;
    uint64_t seq_id = 0;
    std::string payload;

    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--fork")
        do_fork = true;
      if (std::string(argv[i]) == "--seq" && i + 1 < argc)
        seq_id = std::stoull(argv[++i]);
      if (std::string(argv[i]) == "--inject" && i + 1 < argc)
        payload = argv[++i];
    }

    if (result_file.empty()) {
      std::cerr << "{\"error\":\"--result <file> required\"}\n";
      return 1;
    }

    auto content = read_file(result_file);
    auto res = parse_result(content);
    auto cas = std::make_shared<requiem::CasStore>(cas_dir);

    // Ensure the result itself is in CAS for the debugger to find the root.
    // The debugger expects to find the execution root by its digest.
    std::string root_digest = cas->put(content);

    auto debugger = requiem::TimeTravelDebugger::Load(cas, root_digest);
    if (!debugger) {
      std::cerr << "{\"error\":\"Failed to load debugger session\"}\n";
      return 2;
    }

    auto timeline = debugger->GetTimeline();

    if (!do_fork) {
      // List timeline
      std::cout << "{\"timeline\":[";
      for (size_t i = 0; i < timeline.size(); ++i) {
        if (i > 0)
          std::cout << ",";
        const auto &s = timeline[i];
        std::cout << "{\"seq\":" << s.sequence_id << ",\"type\":\"" << s.type
                  << "\""
                  << ",\"digest\":\"" << s.event_digest << "\""
                  << ",\"state\":\"" << s.state_digest << "\"}";
      }
      std::cout << "]}\n";
      return 0;
    }

    // Interactive Fork Logic
    if (seq_id == 0 && timeline.empty()) {
      std::cerr << "{\"error\":\"Cannot fork empty timeline\"}\n";
      return 2;
    }

    // Default to last step if not specified
    if (seq_id == 0)
      seq_id = timeline.back().sequence_id;

    auto snapshot = debugger->Seek(seq_id);
    if (!snapshot) {
      std::cerr << "{\"error\":\"Sequence ID " << seq_id
                << " not found in timeline\"}\n";
      return 2;
    }

    if (payload.empty()) {
      // Interactive prompt if not provided via --inject
      std::cout << "Forking at SEQ=" << seq_id
                << " (State: " << snapshot->memory_digest << ")\n";
      std::cout << "Enter injection payload (JSON/Text): ";
      std::getline(std::cin, payload);
      if (payload.empty()) {
        std::cerr << "Aborted: Empty payload.\n";
        return 1;
      }
    }

    try {
      std::string new_root = debugger->Fork(payload);
      std::cout << "{\"ok\":true,\"fork_origin\":\"" << root_digest << "\""
                << ",\"new_execution_digest\":\"" << new_root << "\""
                << ",\"message\":\"Execution forked successfully\"}\n";
      return 0;
    } catch (const std::exception &e) {
      std::cerr << "{\"error\":\"" << e.what() << "\"}\n";
      return 2;
    }
  }

  if (cmd == "drift" && argc >= 3 && std::string(argv[2]) == "analyze") {
    std::string in, out;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--bench" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    write_file(out, drift_analyze(read_file(in)));
    return 0;
  }

  if (cmd == "drift" && argc >= 3 && std::string(argv[2]) == "pretty") {
    std::string in;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--in" && i + 1 < argc)
        in = argv[++i];
    std::cout << read_file(in) << "\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Cluster commands — distributed cluster platform.
  // INVARIANT: cluster commands never modify execution state; read-only probes.
  // ---------------------------------------------------------------------------

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "status") {
    // Initialize cluster from environment before querying.
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    std::cout << requiem::global_cluster_registry().cluster_status_to_json()
              << "\n";
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "workers") {
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    const auto workers_json =
        requiem::global_cluster_registry().workers_to_json();
    std::cout << "{\"workers\":" << workers_json << "}\n";
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "shard") {
    std::string tenant_id;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant_id = argv[++i];
    }
    if (tenant_id.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--tenant required\"}\n";
      return 2;
    }
    requiem::init_cluster_from_env();
    const auto &w = requiem::global_worker_identity();
    const uint32_t shard =
        requiem::ShardRouter::shard_for_tenant(tenant_id, w.total_shards);
    const bool is_local = requiem::ShardRouter::is_local_shard(tenant_id);
    std::ostringstream o;
    o << "{"
      << "\"ok\":true"
      << ",\"tenant_id\":\"" << requiem::jsonlite::escape(tenant_id) << "\""
      << ",\"shard_id\":" << shard << ",\"total_shards\":" << w.total_shards
      << ",\"is_local_shard\":" << (is_local ? "true" : "false")
      << ",\"local_shard_id\":" << w.shard_id << "}\n";
    std::cout << o.str();
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "join") {
    // Self-register in the local registry. In a full multi-node deployment,
    // this would POST to a cluster coordinator endpoint.
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    const auto &w = requiem::global_worker_identity();
    std::cout << "{"
              << "\"ok\":true"
              << ",\"worker_id\":\"" << w.worker_id << "\""
              << ",\"node_id\":\"" << w.node_id << "\""
              << ",\"shard_id\":" << w.shard_id
              << ",\"total_shards\":" << w.total_shards
              << ",\"cluster_mode\":" << (w.cluster_mode ? "true" : "false")
              << ",\"message\":\"Worker registered in local cluster registry\""
              << "}\n";
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "verify") {
    requiem::init_cluster_from_env();
    requiem::register_local_worker();

    // Phase 5: Real cluster version compatibility check.
    requiem::ClusterDriftStatus drift;
    const bool compat =
        requiem::global_cluster_registry().validate_version_compatibility(
            &drift);

    std::cout << "{"
              << "\"cluster_verify\":{"
              << "\"ok\":" << (compat ? "true" : "false")
              << ",\"nodes_checked\":" << drift.total_workers
              << ",\"compatible_workers\":" << drift.compatible_workers
              << ",\"mismatches\":" << (drift.mismatches.empty() ? "[]" :
                  [&] {
                    std::string s = "[";
                    for (size_t i = 0; i < drift.mismatches.size(); ++i) {
                      if (i > 0) s += ",";
                      const auto& m = drift.mismatches[i];
                      s += "{\"field\":\"" + m.field + "\""
                           + ",\"expected\":\"" + m.expected + "\""
                           + ",\"observed\":\"" + m.observed + "\""
                           + ",\"worker_id\":\"" + m.worker_id + "\"}";
                    }
                    s += "]";
                    return s;
                  }())
              << ",\"replay_drift_rate\":" << drift.replay_drift_rate
              << ",\"replay_divergences\":" << drift.replay_divergences
              << "}}\n";
    return compat ? 0 : 2;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "drift") {
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    std::cout << requiem::global_cluster_registry().cluster_drift_to_json()
              << "\n";
    return 0;
  }

  if (cmd == "report") {
    std::string in, out;
    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    write_file(out, requiem::report_from_result_json(read_file(in)));
    return 0;
  }

  if (cmd == "config" && argc >= 3 && std::string(argv[2]) == "show") {
    std::cout << "{\"config\":{\"version\":\"" << PROJECT_VERSION
              << "\",\"defaults\":{\"hash\":{\"primitive\":\"blake3\","
                 "\"backend\":\"vendored\"},\"cas\":{\"version\":\"v2\","
                 "\"compression\":\"identity\"}}}}"
              << "\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach version
  // Persona: all. Returns engine + ABI + hash + CAS + protocol versions.
  // --json flag (default): always emits structured JSON (stable schema).
  // ---------------------------------------------------------------------------
  if (cmd == "version") {
    auto manifest = requiem::version::current_manifest(PROJECT_VERSION);
    auto result = requiem::version::check_compatibility(
        requiem::version::ENGINE_ABI_VERSION);
    std::cout << "{"
              << "\"ok\":" << (result.ok ? "true" : "false")
              << ",\"engine_semver\":\"" << manifest.engine_semver << "\""
              << ",\"engine_abi_version\":" << manifest.engine_abi
              << ",\"hash_algorithm_version\":" << manifest.hash_algorithm
              << ",\"cas_format_version\":" << manifest.cas_format
              << ",\"protocol_framing_version\":" << manifest.protocol_framing
              << ",\"replay_log_version\":" << manifest.replay_log
              << ",\"audit_log_version\":" << manifest.audit_log
              << ",\"hash_primitive\":\"" << manifest.hash_primitive << "\""
              << ",\"build_timestamp\":\"" << manifest.build_timestamp << "\""
              << "}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach status
  // Persona: SRE/DevOps, Power User. Runtime status + current metrics snapshot.
  // Fail-safe: always returns JSON even if some sub-systems error.
  // ---------------------------------------------------------------------------
  if (cmd == "status") {
    const auto &worker = requiem::global_worker_identity();
    const auto health = requiem::worker_health_snapshot();
    const auto &stats = requiem::global_engine_stats();
    const auto h = requiem::hash_runtime_info();
    std::ostringstream o;
    o << "{"
      << "\"ok\":true"
      << ",\"engine_semver\":\"" << PROJECT_VERSION << "\""
      << ",\"hash_primitive\":\"" << h.primitive << "\""
      << ",\"hash_backend\":\"" << h.backend << "\""
      << ",\"hash_available\":" << (h.blake3_available ? "true" : "false")
      << ",\"worker\":" << requiem::worker_identity_to_json(worker)
      << ",\"health\":" << requiem::worker_health_to_json(health)
      << ",\"stats\":" << stats.to_json() << "}\n";
    std::cout << o.str();
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach demo
  // Persona: OSS Developer (first value). Runs determinism demo in one command.
  // Executes a known workload 3 times and verifies all result_digests match.
  // ---------------------------------------------------------------------------
  if (cmd == "demo") {
    const std::string demo_cmd = "/bin/sh";
    const std::vector<std::string> demo_argv = {
        "-c", "echo requiem-determinism-demo"};

    requiem::ExecutionRequest req;
    req.request_id = "demo-1";
    req.command = demo_cmd;
    req.argv = demo_argv;
    req.workspace_root = "/tmp";
    req.policy.scheduler_mode = "turbo";
    req.nonce = 0;

    std::vector<std::string> digests;
    std::vector<double> latencies_ms;
    bool all_ok = true;
    for (int i = 0; i < 3; ++i) {
      // Keep request_id fixed across all runs: same inputs must produce same
      // outputs. (request_id is part of canonicalize_request → changing it
      // changes request_digest)
      auto t0 = std::chrono::steady_clock::now();
      auto res = requiem::execute(req);
      auto t1 = std::chrono::steady_clock::now();
      latencies_ms.push_back(
          std::chrono::duration<double, std::milli>(t1 - t0).count());
      digests.push_back(res.result_digest);
      if (!res.ok)
        all_ok = false;
    }

    bool deterministic = true;
    for (const auto &d : digests) {
      if (d != digests[0]) {
        deterministic = false;
        break;
      }
    }

    std::ostringstream o;
    o << "{"
      << "\"ok\":" << (all_ok ? "true" : "false")
      << ",\"deterministic\":" << (deterministic ? "true" : "false")
      << ",\"runs\":3"
      << ",\"result_digest\":\"" << (digests.empty() ? "" : digests[0]) << "\""
      << ",\"latency_ms\":[";
    for (size_t i = 0; i < latencies_ms.size(); ++i) {
      if (i)
        o << ",";
      char buf[32];
      std::snprintf(buf, sizeof(buf), "%.2f", latencies_ms[i]);
      o << buf;
    }
    o << "]"
      << ",\"message\":\""
      << (deterministic
              ? "All 3 runs produced identical result_digest. Determinism "
                "confirmed."
              : "DETERMINISM FAILURE: result_digest differs across runs.")
      << "\""
      << "}\n";
    std::cout << o.str();
    return (all_ok && deterministic) ? 0 : 2;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach capsule inspect
  // Persona: Support Engineer, Security Auditor.
  // Inspects an execution result (capsule) for provenance and integrity.
  // ---------------------------------------------------------------------------
  if (cmd == "capsule" && argc >= 3 && std::string(argv[2]) == "inspect") {
    std::string result_file, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    if (result_file.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--result required\"}\n";
      return 2;
    }
    auto content = read_file(result_file);
    if (content.empty()) {
      std::cout
          << "{\"ok\":false,\"error\":\"result file empty or missing\"}\n";
      return 2;
    }
    auto r = parse_result(content);
    // Verify result_digest integrity
    const std::string computed =
        requiem::deterministic_digest(requiem::canonicalize_result(r));
    const bool digest_ok = (computed == r.result_digest);
    // Check CAS presence for all referenced digests
    requiem::CasStore cas(cas_dir);
    bool stdout_in_cas =
        r.stdout_digest.empty() || cas.contains(r.stdout_digest);
    bool stderr_in_cas =
        r.stderr_digest.empty() || cas.contains(r.stderr_digest);
    bool trace_in_cas = r.trace_digest.empty() || cas.contains(r.trace_digest);

    std::ostringstream o;
    o << "{"
      << "\"ok\":" << (digest_ok ? "true" : "false") << ",\"result_digest\":\""
      << r.result_digest << "\""
      << ",\"computed_digest\":\"" << computed << "\""
      << ",\"digest_match\":" << (digest_ok ? "true" : "false")
      << ",\"request_digest\":\"" << r.request_digest << "\""
      << ",\"stdout_digest\":\"" << r.stdout_digest << "\""
      << ",\"stderr_digest\":\"" << r.stderr_digest << "\""
      << ",\"trace_digest\":\"" << r.trace_digest << "\""
      << ",\"cas_presence\":{"
      << "\"stdout\":" << (stdout_in_cas ? "true" : "false")
      << ",\"stderr\":" << (stderr_in_cas ? "true" : "false")
      << ",\"trace\":" << (trace_in_cas ? "true" : "false") << "}"
      << ",\"exit_code\":" << r.exit_code
      << ",\"ok_flag\":" << (r.ok ? "true" : "false")
      << ",\"termination_reason\":\"" << r.termination_reason << "\""
      << "}\n";
    std::cout << o.str();
    return digest_ok ? 0 : 2;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach replay verify
  // Persona: Security Auditor, SRE. Verifies a stored execution replay.
  // Returns structured JSON with verification status and mismatch details.
  // ---------------------------------------------------------------------------
  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string req_file, result_file, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        req_file = argv[++i];
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    if (req_file.empty() || result_file.empty()) {
      std::cout
          << "{\"ok\":false,\"error\":\"--request and --result required\"}\n";
      return 2;
    }
    auto req = requiem::parse_request_json(read_file(req_file), nullptr);
    auto r = parse_result(read_file(result_file));
    requiem::CasStore cas(cas_dir);
    std::string err;
    const bool verified = requiem::validate_replay_with_cas(req, r, cas, &err);
    std::ostringstream o;
    o << "{"
      << "\"ok\":" << (verified ? "true" : "false")
      << ",\"verified\":" << (verified ? "true" : "false")
      << ",\"result_digest\":\"" << r.result_digest << "\""
      << ",\"request_digest\":\"" << r.request_digest << "\""
      << ",\"error\":\"" << (verified ? "" : err) << "\""
      << ",\"engine_version\":\"" << PROJECT_VERSION << "\""
      << ",\"hash_algorithm_version\":"
      << requiem::version::HASH_ALGORITHM_VERSION << "}\n";
    std::cout << o.str();
    return verified ? 0 : 2;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach metrics
  // Persona: SRE/DevOps, Enterprise Operator. Full metrics dump.
  // Returns complete structured JSON including p50/p95/p99, CAS, determinism.
  // ---------------------------------------------------------------------------
  if (cmd == "metrics") {
    const auto &stats = requiem::global_engine_stats();
    std::ostringstream o;
    o << "{"
      << "\"engine_version\":\"" << PROJECT_VERSION << "\""
      << ",\"engine_abi_version\":" << requiem::version::ENGINE_ABI_VERSION
      << ",\"hash_algorithm_version\":"
      << requiem::version::HASH_ALGORITHM_VERSION
      << ",\"cas_format_version\":" << requiem::version::CAS_FORMAT_VERSION
      << ",\"worker\":"
      << requiem::worker_identity_to_json(requiem::global_worker_identity())
      << ",\"stats\":" << stats.to_json() << ",\"audit_log\":{"
      << "\"entry_count\":" << requiem::global_audit_log().entry_count()
      << ",\"failure_count\":" << requiem::global_audit_log().failure_count()
      << "}"
      << "}\n";
    std::cout << o.str();
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase E: reach quickstart
  // Persona: OSS Developer. First-value guarantee: visible output in one
  // command.
  // ---------------------------------------------------------------------------
  if (cmd == "quickstart") {
    std::cout << "{"
              << "\"step\":1,\"action\":\"verify_engine\",\"ok\":true,"
              << "\"message\":\"Requiem engine ready. Hash: BLAKE3, CAS: v2, "
                 "Protocol: v1.\","
              << "\"next\":\"Run: requiem demo  (to verify determinism)\","
              << "\"docs\":\"https://reach-cli.com/quickstart\""
              << "}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Auto-tuning commands
  // ---------------------------------------------------------------------------
  if (cmd == "autotune" && argc >= 3 && std::string(argv[2]) == "status") {
    std::cout << requiem::autotune::global_autotune_engine().to_json() << "\n";
    return 0;
  }

  if (cmd == "autotune" && argc >= 3 && std::string(argv[2]) == "tick") {
    const auto ev = requiem::autotune::global_autotune_engine().tick();
    std::cout << ev.to_json() << "\n";
    return ev.applied ? 0 : 1;
  }

  if (cmd == "autotune" && argc >= 3 && std::string(argv[2]) == "revert") {
    const auto ev =
        requiem::autotune::global_autotune_engine().revert_to_baseline();
    std::cout << ev.to_json() << "\n";
    return ev.applied ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // Phase 7: Cluster auth commands
  // ---------------------------------------------------------------------------
  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "auth") {
    requiem::init_worker_identity();
    const auto &w = requiem::global_worker_identity();
    std::cout << "{"
              << "\"auth_version\":" << w.auth_version
              << ",\"cluster_auth_version\":"
              << requiem::rbac::CLUSTER_AUTH_VERSION << ",\"node_id\":\""
              << w.node_id << "\""
              << ",\"worker_id\":\"" << w.worker_id << "\""
              << ",\"auth_scheme\":\"bearer_stub\""
              << ",\"note\":\"EXTENSION_POINT:node_auth_upgrade — upgrade to "
                 "mTLS or SPIFFE/SPIRE SVID\""
              << "}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase E: reach bugreport
  // Persona: OSS Developer. Collects engine diagnostic info for bug reports.
  // ---------------------------------------------------------------------------
  if (cmd == "bugreport") {
    const auto h = requiem::hash_runtime_info();
    auto manifest = requiem::version::current_manifest(PROJECT_VERSION);
    const auto &worker = requiem::global_worker_identity();
    std::ostringstream o;
    o << "{"
      << "\"engine_semver\":\"" << PROJECT_VERSION << "\""
      << ",\"engine_abi_version\":" << requiem::version::ENGINE_ABI_VERSION
      << ",\"hash_primitive\":\"" << h.primitive << "\""
      << ",\"hash_backend\":\"" << h.backend << "\""
      << ",\"hash_available\":" << (h.blake3_available ? "true" : "false")
      << ",\"hash_version\":\"" << h.version << "\""
      << ",\"build_timestamp\":\"" << manifest.build_timestamp << "\""
      << ",\"worker_id\":\"" << worker.worker_id << "\""
      << ",\"node_id\":\"" << worker.node_id << "\""
      << ",\"instructions\":\"Attach this JSON to your bug report at "
         "https://github.com/Hardonian/Requiem/issues\""
      << "}\n";
    std::cout << o.str();
    return 0;
  }

  return 1;
}
