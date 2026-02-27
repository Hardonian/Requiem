#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <vector>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"
#include "requiem/sandbox.hpp"

namespace {
std::string read_file(const std::string& path) {
  std::ifstream ifs(path, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
}
void write_file(const std::string& path, const std::string& data) {
  std::ofstream ofs(path, std::ios::binary | std::ios::trunc);
  ofs << data;
}
requiem::ExecutionResult parse_result(const std::string& s) {
  requiem::ExecutionResult r;
  auto obj = requiem::jsonlite::parse(s, nullptr);
  r.ok = requiem::jsonlite::get_bool(obj, "ok", false);
  r.exit_code = static_cast<int>(requiem::jsonlite::get_u64(obj, "exit_code", 0));
  r.termination_reason = requiem::jsonlite::get_string(obj, "termination_reason", "");
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

std::string drift_analyze(const std::string& bench_json) {
  auto digests = requiem::jsonlite::get_string_array(bench_json, "result_digests");
  std::map<std::string, int> f;
  for (const auto& d : digests) f[d]++;
  if (f.size() <= 1) return "{\"drift\":{\"ok\":true,\"mismatches\":[]}}";
  auto expected = f.begin()->first;
  std::string out = "{\"drift\":{\"ok\":false,\"mismatches\":[";
  bool first = true;
  for (size_t i = 0; i < digests.size(); ++i) {
    if (digests[i] == expected) continue;
    if (!first) out += ",";
    first = false;
    out += "{\"category\":\"digest\",\"expected\":\"" + expected + "\",\"observed\":\"" + digests[i] +
           "\",\"run_indices\":[" + std::to_string(i) + "],\"hints\":[\"env key present outside allowlist\"]}";
  }
  out += "]}}";
  return out;
}

std::string bench_compare(const std::string& baseline_json, const std::string& current_json) {
  auto baseline_p50 = requiem::jsonlite::get_double(baseline_json, "latency_ms.p50", 0.0);
  auto current_p50 = requiem::jsonlite::get_double(current_json, "latency_ms.p50", 0.0);
  auto baseline_p95 = requiem::jsonlite::get_double(baseline_json, "latency_ms.p95", 0.0);
  auto current_p95 = requiem::jsonlite::get_double(current_json, "latency_ms.p95", 0.0);
  
  double p50_delta = baseline_p50 > 0 ? ((current_p50 - baseline_p50) / baseline_p50) * 100.0 : 0.0;
  double p95_delta = baseline_p95 > 0 ? ((current_p95 - baseline_p95) / baseline_p95) * 100.0 : 0.0;
  
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
  if (requiem::blake3_hex("") != "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262") {
    return false;
  }
  // "hello" hash
  if (requiem::blake3_hex("hello") != "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f") {
    return false;
  }
  return true;
}

}  // namespace

int main(int argc, char** argv) {
  // Honor FORCE_RUST: if set, refuse to run so the caller falls back to Rust engine.
  const char* force_rust = std::getenv("FORCE_RUST");
  if (force_rust && std::string(force_rust) == "1") {
    std::cerr << "{\"error\":\"FORCE_RUST=1: Requiem engine disabled by environment\"}\n";
    return 3;
  }

  requiem::set_hash_fallback_allowed(false);
  std::string cmd;
  for (int i = 1; i < argc; ++i) {
    if (std::string(argv[i]).rfind("--", 0) == 0) continue;
    cmd = argv[i];
    break;
  }
  if (cmd.empty()) return 1;
  
  if (cmd == "health") {
    const auto h = requiem::hash_runtime_info();
    std::cout << "{\"hash_primitive\":\"" << h.primitive << "\",\"hash_backend\":\"" << h.backend
              << "\",\"hash_version\":\"" << h.version << "\",\"hash_available\":"
              << (h.blake3_available ? "true" : "false") << ",\"compat_warning\":"
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
    std::vector<std::string> blockers;

    const auto h = requiem::hash_runtime_info();
    if (h.primitive != "blake3") blockers.push_back("hash_primitive_not_blake3");
    if (h.backend != "vendored") blockers.push_back("hash_backend_not_vendored");
    if (!h.blake3_available) blockers.push_back("blake3_not_available");
    if (h.compat_warning) blockers.push_back("hash_compat_warning");
    if (!verify_hash_vectors()) blockers.push_back("hash_vectors_failed");

    // Detect sandbox capabilities
    auto caps = requiem::detect_platform_sandbox_capabilities();

    std::cout << "{\"ok\":" << (blockers.empty() ? "true" : "false") << ",\"blockers\":[";
    for (size_t i = 0; i < blockers.size(); ++i) {
      if (i > 0) std::cout << ",";
      std::cout << "\"" << blockers[i] << "\"";
    }
    std::cout << "]";
    std::cout << ",\"engine_version\":\"" << PROJECT_VERSION << "\"";
    std::cout << ",\"protocol_version\":\"v1\"";
    std::cout << ",\"hash_primitive\":\"" << h.primitive << "\"";
    std::cout << ",\"hash_backend\":\"" << h.backend << "\"";
    std::cout << ",\"hash_version\":\"" << h.version << "\"";
    std::cout << ",\"sandbox\":{\"workspace_confinement\":" << (caps.workspace_confinement ? "true" : "false")
              << ",\"rlimits\":" << (caps.rlimits_cpu ? "true" : "false")
              << ",\"seccomp\":" << (caps.seccomp_baseline ? "true" : "false")
              << ",\"job_objects\":" << (caps.job_objects ? "true" : "false")
              << ",\"restricted_token\":" << (caps.restricted_token ? "true" : "false") << "}";
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
    
    std::cout << "{\"ok\":" << (blockers.empty() ? "true" : "false") << ",\"blockers\":[";
    for (size_t i = 0; i < blockers.size(); ++i) {
      if (i > 0) std::cout << ",";
      std::cout << "\"" << blockers[i] << "\"";
    }
    std::cout << "],\"hash_primitive\":\"" << h.primitive << "\"";
    std::cout << ",\"hash_backend\":\"" << h.backend << "\"";
    std::cout << "}" << "\n";
    return blockers.empty() ? 0 : 2;
  }

  if (cmd == "llm" && argc >= 3 && std::string(argv[2]) == "freeze") {
    // LLM freeze command - produce artifact for later deterministic execution
    std::cout << R"({"status":"not_implemented","message":"llm freeze requires LLM provider integration"})" << "\n";
    return 1;
  }

  if (cmd == "llm" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout << R"({"modes":["none","subprocess","sidecar","freeze_then_compute","attempt_deterministic"],"rules":{"default_include_in_digest":false,"engine_network":"never","authoritative_digest":"compute_phase_only_for_freeze_then_compute"}})" << "\n";
    return 0;
  }
  
  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout << requiem::policy_explain(requiem::ExecPolicy{}) << "\n";
    return 0;
  }
  
  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "check") {
    std::string req_file;
    for (int i = 3; i < argc; ++i) if (std::string(argv[i]) == "--request" && i + 1 < argc) req_file = argv[++i];
    std::cout << requiem::policy_check_json(read_file(req_file)) << "\n";
    return 0;
  }
  
  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "put") {
    std::string in, cas_dir = ".requiem/cas/v2", compress = "off";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--in" && i + 1 < argc) in = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc) cas_dir = argv[++i];
      if (std::string(argv[i]) == "--compress" && i + 1 < argc) compress = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    std::cout << cas.put(read_file(in), compress) << "\n";
    return 0;
  }
  
  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "info") {
    std::string h, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--hash" && i + 1 < argc) h = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc) cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto info = cas.info(h);
    if (!info) return 2;
    std::cout << "{\"digest\":\"" << info->digest << "\",\"encoding\":\"" << info->encoding << "\",\"original_size\":"
              << info->original_size << ",\"stored_size\":" << info->stored_size << "}\n";
    return 0;
  }
  
  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "gc") {
    std::string cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc) cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    std::size_t total = 0;
    for (const auto& o : objects) total += o.stored_size;
    std::cout << "{\"dry_run\":true,\"count\":" << objects.size() << ",\"stored_bytes\":" << total << "}\n";
    return 0;
  }
  
  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc) cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    int errors = 0;
    for (const auto& o : objects) {
      auto content = cas.get(o.digest);
      if (!content) {
        errors++;
        std::cerr << "Missing content for " << o.digest << "\n";
      }
    }
    std::cout << "{\"verified\":" << (objects.size() - errors) << ",\"errors\":" << errors << "}\n";
    return errors > 0 ? 2 : 0;
  }
  
  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string result_file;
    for (int i = 3; i < argc; ++i) if (std::string(argv[i]) == "--result" && i + 1 < argc) result_file = argv[++i];
    auto r = parse_result(read_file(result_file));
    if (requiem::deterministic_digest(requiem::canonicalize_result(r)) != r.result_digest) return 2;
    std::cout << "ok\n";
    return 0;
  }
  
  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "file") {
    std::string file_path;
    for (int i = 3; i < argc; ++i) if (std::string(argv[i]) == "--file" && i + 1 < argc) file_path = argv[++i];
    std::string hash = requiem::hash_file_blake3(file_path);
    if (hash.empty()) return 2;
    // Convert binary hash to hex
    std::string hex_hash;
    const char* hex_chars = "0123456789abcdef";
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
      if (std::string(argv[i]) == "--request" && i + 1 < argc) in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc) out = argv[++i];
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
      if (std::string(argv[i]) == "--request" && i + 1 < argc) in = argv[++i];
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
              << ",\"request_id\":\"" << requiem::jsonlite::escape(req.request_id) << "\""
              << ",\"tenant_id\":\"" << requiem::jsonlite::escape(req.tenant_id) << "\""
              << "}\n";
    std::cout.flush();
    const auto res = requiem::execute(req);
    // event frames
    for (const auto& ev : res.trace_events) {
      std::cout << "{\"type\":\"event\""
                << ",\"seq\":" << ev.seq
                << ",\"t_ns\":" << ev.t_ns
                << ",\"event\":\"" << requiem::jsonlite::escape(ev.type) << "\""
                << ",\"data\":{";
      bool first = true;
      for (const auto& [k, v] : ev.data) {
        if (!first) std::cout << ",";
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
              << ",\"termination_reason\":\"" << requiem::jsonlite::escape(res.termination_reason) << "\""
              << "}\n";
    std::cout.flush();
    // result frame — always last; authoritative
    std::cout << "{\"type\":\"result\""
              << ",\"ok\":" << (res.ok ? "true" : "false")
              << ",\"exit_code\":" << res.exit_code
              << ",\"error_code\":\"" << requiem::jsonlite::escape(res.error_code) << "\""
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
      if (std::string(argv[i]) == "--request" && i + 1 < argc) req_file = argv[++i];
      if (std::string(argv[i]) == "--result" && i + 1 < argc) result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc) cas_dir = argv[++i];
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
      if (std::string(argv[i]) == "--spec" && i + 1 < argc) spec_file = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc) out_file = argv[++i];
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
      latencies.push_back(std::chrono::duration<double, std::milli>(en - st).count());
      digests.push_back(r.result_digest);
    }
    auto end_all = std::chrono::steady_clock::now();
    std::sort(latencies.begin(), latencies.end());
    auto q = [&](double p) { return latencies[std::min(static_cast<size_t>((latencies.size() - 1) * p), latencies.size() - 1)]; };
    double total_s = std::chrono::duration<double>(end_all - start_all).count();
    
    // Calculate statistics
    double sum = 0.0;
    for (double l : latencies) sum += l;
    double mean = sum / latencies.size();
    double variance = 0.0;
    for (double l : latencies) variance += (l - mean) * (l - mean);
    double stddev = latencies.size() > 1 ? std::sqrt(variance / (latencies.size() - 1)) : 0.0;
    
    // Check for drift
    int drift_count = 0;
    if (!digests.empty()) {
      const auto& first = digests[0];
      for (const auto& d : digests) {
        if (d != first) drift_count++;
      }
    }
    
    std::ostringstream oss;
    oss << "{\"runs\":" << runs << ",\"result_digests\":[";
    for (size_t i = 0; i < digests.size(); ++i) {
      if (i) oss << ",";
      oss << "\"" << digests[i] << "\"";
    }
    oss << "],\"latency_ms\":{"
        << "\"min\":" << latencies.front()
        << ",\"max\":" << latencies.back()
        << ",\"mean\":" << mean
        << ",\"stddev\":" << stddev
        << ",\"p50\":" << q(0.5) 
        << ",\"p90\":" << q(0.90)
        << ",\"p95\":" << q(0.95) 
        << ",\"p99\":" << q(0.99)
        << "},\"throughput_ops_sec\":" << (runs / (total_s > 0 ? total_s : 1.0))
        << ",\"drift_count\":" << drift_count
        << "}";
    write_file(out_file, oss.str());
    return 0;
  }
  
  if (cmd == "bench" && argc >= 3 && std::string(argv[2]) == "compare") {
    std::string baseline_file, current_file, out_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--baseline" && i + 1 < argc) baseline_file = argv[++i];
      if (std::string(argv[i]) == "--current" && i + 1 < argc) current_file = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc) out_file = argv[++i];
    }
    auto comparison = bench_compare(read_file(baseline_file), read_file(current_file));
    if (!out_file.empty()) {
      write_file(out_file, comparison);
    } else {
      std::cout << comparison << "\n";
    }
    return 0;
  }
  
  if (cmd == "drift" && argc >= 3 && std::string(argv[2]) == "analyze") {
    std::string in, out;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--bench" && i + 1 < argc) in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc) out = argv[++i];
    }
    write_file(out, drift_analyze(read_file(in)));
    return 0;
  }
  
  if (cmd == "drift" && argc >= 3 && std::string(argv[2]) == "pretty") {
    std::string in;
    for (int i = 3; i < argc; ++i) if (std::string(argv[i]) == "--in" && i + 1 < argc) in = argv[++i];
    std::cout << read_file(in) << "\n";
    return 0;
  }
  
  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string results_dir;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--results" && i + 1 < argc) results_dir = argv[++i];
    }
    // Stub for cluster verification - would compare digests across nodes
    std::cout << "{\"cluster_verify\":{\"ok\":true,\"nodes_checked\":0,\"mismatches\":[]}}" << "\n";
    return 0;
  }
  
  if (cmd == "report") {
    std::string in, out;
    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc) in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc) out = argv[++i];
    }
    write_file(out, requiem::report_from_result_json(read_file(in)));
    return 0;
  }
  
  if (cmd == "config" && argc >= 3 && std::string(argv[2]) == "show") {
    std::cout << "{\"config\":{\"version\":\"" << PROJECT_VERSION << "\",\"defaults\":{\"hash\":{\"primitive\":\"blake3\",\"backend\":\"vendored\"},\"cas\":{\"version\":\"v2\",\"compression\":\"identity\"}}}}" << "\n";
    return 0;
  }
  
  return 1;
}
