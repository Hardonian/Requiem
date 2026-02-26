#include <algorithm>
#include <chrono>
#include <fstream>
#include <iostream>
#include <map>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"

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
  r.ok = requiem::jsonlite::get_bool(s, "ok", false);
  r.exit_code = static_cast<int>(requiem::jsonlite::get_u64(s, "exit_code", 0));
  r.termination_reason = requiem::jsonlite::get_string(s, "termination_reason", "");
  r.request_digest = requiem::jsonlite::get_string(s, "request_digest", "");
  r.trace_digest = requiem::jsonlite::get_string(s, "trace_digest", "");
  r.result_digest = requiem::jsonlite::get_string(s, "result_digest", "");
  r.stdout_digest = requiem::jsonlite::get_string(s, "stdout_digest", "");
  r.stderr_digest = requiem::jsonlite::get_string(s, "stderr_digest", "");
  r.stdout_text = requiem::jsonlite::get_string(s, "stdout", "");
  r.stderr_text = requiem::jsonlite::get_string(s, "stderr", "");
  r.output_digests = requiem::jsonlite::get_string_map(s, "output_digests");
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
}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) return 1;
  std::string cmd = argv[1];
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
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    std::size_t total = 0;
    for (const auto& o : objects) total += o.stored_size;
    std::cout << "{\"dry_run\":true,\"count\":" << objects.size() << ",\"stored_bytes\":" << total << "}\n";
    return 0;
  }
  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string result_file;
    for (int i = 3; i < argc; ++i) if (std::string(argv[i]) == "--result" && i + 1 < argc) result_file = argv[++i];
    auto r = parse_result(read_file(result_file));
    if (requiem::deterministic_digest(requiem::canonicalize_result(r)) != r.result_digest) return 2;
    std::cout << "ok\n";
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
    std::ostringstream oss;
    oss << "{\"runs\":" << runs << ",\"result_digests\":[";
    for (size_t i = 0; i < digests.size(); ++i) {
      if (i) oss << ",";
      oss << "\"" << digests[i] << "\"";
    }
    oss << "],\"latency_ms\":{\"p50\":" << q(0.5) << ",\"p95\":" << q(0.95) << ",\"p99\":" << q(0.99)
        << "},\"throughput_ops_sec\":" << (runs / (total_s > 0 ? total_s : 1.0)) << "}";
    write_file(out_file, oss.str());
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
  if (cmd == "report") {
    std::string in, out;
    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc) in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc) out = argv[++i];
    }
    write_file(out, requiem::report_from_result_json(read_file(in)));
    return 0;
  }
  return 1;
}
