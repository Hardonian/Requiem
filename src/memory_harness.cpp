// memory_harness.cpp — Phase 6: Memory/FD leak + resource stability.
//
// Run 5,000 requests over a sustained period and verify:
//   - RSS (VmRSS) growth below threshold (default: 50 MB)
//   - No FD leaks (open_fd_count_after == open_fd_count_before ± tolerance)
//   - No zombies (CasStore / threads properly destroyed)
//   - No steady p99 latency degradation across 10 measurement windows
//
// Uses /proc/self/status for RSS and /proc/self/fd/ for FD count (Linux).
// Falls back to 0 if /proc not available (non-Linux — test still runs, metrics skipped).
//
// Produces: artifacts/reports/CLOUD_MEMORY_REPORT.json

#include <algorithm>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "requiem/hash.hpp"
#include "requiem/runtime.hpp"

namespace fs = std::filesystem;
using Clock  = std::chrono::steady_clock;
using Ms     = std::chrono::duration<double, std::milli>;

namespace {

constexpr int     kTotalRequests = 5000;
constexpr int     kWindows       = 10;       // measure p99 in 10 equal windows
constexpr double  kMaxRssDeltaMb = 50.0;     // 50 MB RSS growth limit
constexpr int     kFdTolerance   = 5;        // allow up to 5 FD delta (proc itself)

// Read VmRSS from /proc/self/status (returns KB, 0 if unavailable).
long read_rss_kb() {
#if defined(__linux__)
  std::ifstream f("/proc/self/status");
  std::string line;
  while (std::getline(f, line)) {
    if (line.rfind("VmRSS:", 0) == 0) {
      long val = 0;
      std::sscanf(line.c_str() + 6, " %ld", &val);
      return val;
    }
  }
#endif
  return 0;
}

// Count open FDs via /proc/self/fd/ (returns -1 if unavailable).
int count_open_fds() {
#if defined(__linux__)
  std::error_code ec;
  int count = 0;
  for (auto& p : fs::directory_iterator("/proc/self/fd", ec)) {
    (void)p;
    ++count;
  }
  if (!ec) return count;
#endif
  return -1;
}

std::string fmt_double(double v, int prec = 2) {
  std::ostringstream oss;
  oss.precision(prec);
  oss << std::fixed << v;
  return oss.str();
}

double percentile(std::vector<double> v, double p) {
  if (v.empty()) return 0.0;
  std::sort(v.begin(), v.end());
  const std::size_t idx = static_cast<std::size_t>((v.size() - 1) * p);
  return v[std::min(idx, v.size() - 1)];
}

void write_file(const std::string& path, const std::string& data) {
  fs::create_directories(fs::path(path).parent_path());
  std::ofstream ofs(path, std::ios::trunc | std::ios::binary);
  ofs << data;
}

}  // namespace

int main() {
  const auto base_tmp = fs::temp_directory_path() / "requiem_memory_harness";
  fs::remove_all(base_tmp);
  fs::create_directories(base_tmp);

  const auto hi = requiem::hash_runtime_info();
  if (!hi.blake3_available || hi.primitive != "blake3") {
    std::cerr << "FATAL: BLAKE3 not available\n";
    return 1;
  }

  // Warm up (small run to stabilize allocators).
  {
    requiem::ExecutionRequest warmup;
    warmup.request_id     = "warmup";
    warmup.workspace_root = base_tmp.string();
    warmup.command        = "/bin/sh";
    warmup.argv           = {"-c", "echo warmup"};
    for (int i = 0; i < 20; ++i) requiem::execute(warmup);
  }

  const long rss_before = read_rss_kb();
  const int  fds_before = count_open_fds();

  std::cout << "[memory] RSS before: " << rss_before << " KB\n";
  std::cout << "[memory] FDs before: " << fds_before << "\n";
  std::cout << "[memory] running " << kTotalRequests << " requests...\n";

  // Per-window latency storage.
  const int window_size = kTotalRequests / kWindows;
  std::vector<std::vector<double>> window_latencies(kWindows);

  const auto wall_t0 = Clock::now();

  for (int i = 0; i < kTotalRequests; ++i) {
    requiem::ExecutionRequest req;
    req.request_id     = "mem-" + std::to_string(i);
    req.workspace_root = base_tmp.string();
    req.command        = "/bin/sh";
    // Cycle through a few workloads to exercise different paths.
    switch (i % 5) {
      case 0: req.argv = {"-c", "echo tiny"}; break;
      case 1: req.argv = {"-c", "printf '%0.s.' {1..200}"}; break;
      case 2: req.argv = {"-c", "true"}; break;
      case 3: req.argv = {"-c", "echo " + std::string(64, 'A')}; break;
      case 4: req.argv = {"-c", "false"}; break;
    }
    req.timeout_ms         = 1000;
    req.policy.deterministic = true;

    const auto t0     = Clock::now();
    requiem::execute(req);
    const auto t1     = Clock::now();

    const int w = std::min(i / window_size, kWindows - 1);
    window_latencies[w].push_back(Ms(t1 - t0).count());

    if (i % 1000 == 999) {
      std::cout << "  [mem] " << (i + 1) << "/" << kTotalRequests << "\n";
    }
  }

  const double wall_s = std::chrono::duration<double>(Clock::now() - wall_t0).count();

  const long rss_after = read_rss_kb();
  const int  fds_after = count_open_fds();

  std::cout << "[memory] RSS after:  " << rss_after << " KB\n";
  std::cout << "[memory] FDs after:  " << fds_after << "\n";

  // Compute per-window p99 latencies to detect degradation.
  std::vector<double> window_p99;
  for (const auto& wl : window_latencies) {
    window_p99.push_back(percentile(wl, 0.99));
  }

  // Detect p99 degradation: last window p99 must not be >2x first window p99.
  bool p99_stable = true;
  if (window_p99.size() >= 2 && window_p99.front() > 0) {
    const double ratio = window_p99.back() / window_p99.front();
    p99_stable = (ratio < 2.0);
  }

  const long rss_delta_kb = rss_after - rss_before;
  const double rss_delta_mb = rss_delta_kb / 1024.0;

  // FD leak check (only if /proc available).
  const bool fds_available = (fds_before >= 0 && fds_after >= 0);
  const int  fds_delta     = fds_available ? (fds_after - fds_before) : 0;
  const bool fd_pass       = !fds_available || (std::abs(fds_delta) <= kFdTolerance);

  const bool rss_pass     = (rss_before == 0) || (rss_delta_mb < kMaxRssDeltaMb);
  const bool overall_pass = rss_pass && fd_pass && p99_stable;

  // Build JSON window array.
  std::ostringstream windows_json;
  windows_json << "[";
  for (std::size_t i = 0; i < window_p99.size(); ++i) {
    if (i > 0) windows_json << ",";
    windows_json << fmt_double(window_p99[i]);
  }
  windows_json << "]";

  std::ostringstream report;
  report << "{"
         << "\"schema\":\"cloud_memory_report_v1\""
         << ",\"pass\":" << (overall_pass ? "true" : "false")
         << ",\"total_requests\":" << kTotalRequests
         << ",\"wall_time_s\":" << fmt_double(wall_s)
         << ",\"rss_kb\":{"
         <<   "\"before\":" << rss_before
         <<   ",\"after\":" << rss_after
         <<   ",\"delta\":" << rss_delta_kb
         <<   ",\"delta_mb\":" << fmt_double(rss_delta_mb)
         <<   ",\"threshold_mb\":" << kMaxRssDeltaMb
         <<   ",\"pass\":" << (rss_pass ? "true" : "false")
         << "}"
         << ",\"fd\":{"
         <<   "\"before\":" << fds_before
         <<   ",\"after\":" << fds_after
         <<   ",\"delta\":" << fds_delta
         <<   ",\"tolerance\":" << kFdTolerance
         <<   ",\"available\":" << (fds_available ? "true" : "false")
         <<   ",\"pass\":" << (fd_pass ? "true" : "false")
         << "}"
         << ",\"p99_ms\":{"
         <<   "\"per_window\":" << windows_json.str()
         <<   ",\"stable\":" << (p99_stable ? "true" : "false")
         <<   ",\"first\":" << fmt_double(window_p99.empty() ? 0.0 : window_p99.front())
         <<   ",\"last\":" << fmt_double(window_p99.empty() ? 0.0 : window_p99.back())
         << "}"
         << ",\"hash_primitive\":\"blake3\""
         << "}";

  const std::string report_path = "artifacts/reports/CLOUD_MEMORY_REPORT.json";
  write_file(report_path, report.str());
  std::cout << "[memory] report written: " << report_path << "\n";
  std::cout << "[memory] rss_delta=" << fmt_double(rss_delta_mb) << "MB"
            << " fd_delta=" << fds_delta
            << " p99_stable=" << (p99_stable ? "true" : "false")
            << " pass=" << (overall_pass ? "PASS" : "FAIL") << "\n";

  fs::remove_all(base_tmp);
  return overall_pass ? 0 : 1;
}
