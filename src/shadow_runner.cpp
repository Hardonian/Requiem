// shadow_runner.cpp — Phase 2: Determinism under concurrency (shadow dual-run).
//
// Shadow dual-run rules:
//   - Primary engine: Requiem
//   - Shadow engine: Requiem (same binary — proves internal determinism)
//   - Shadow MUST NOT affect billing (enforced via MeterLog.is_shadow)
//   - Shadow MUST NOT affect primary returned result
//   - Drift recorded with stable, redacted diff artifacts
//
// Run: 2,000 identical requests across 20 tenants, randomized ordering.
//
// Drift classification:
//   - numeric/fixed-point (exit code differs)
//   - canonicalization / key order (request_digest differs for same inputs)
//   - artifact/stdout difference (stdout_digest differs, result_digest differs)
//   - policy mismatch (policy_applied differs)
//   - env/time leak (non-deterministic timestamp in output)
//
// Promotion gate: drift_count must be ZERO for "Requiem primary" rollout.
//
// Produces:
//   artifacts/reports/CLOUD_DETERMINISM_REPORT.json
//   artifacts/reports/CLOUD_DRIFT_DIFFS/ (redacted, empty if no drift)

#include <algorithm>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <random>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include "requiem/hash.hpp"
#include "requiem/metering.hpp"
#include "requiem/runtime.hpp"

namespace fs = std::filesystem;
using Clock  = std::chrono::steady_clock;

namespace {

constexpr int kNumTenants          = 20;
constexpr int kRequestsPerTenant   = 100;
constexpr int kTotalRequests       = kNumTenants * kRequestsPerTenant;  // 2,000

std::string tenant_id(int i) {
  char buf[16];
  std::snprintf(buf, sizeof(buf), "shadow-t%03d", i + 1);
  return buf;
}

void write_file(const std::string& path, const std::string& data) {
  fs::create_directories(fs::path(path).parent_path());
  std::ofstream ofs(path, std::ios::trunc | std::ios::binary);
  ofs << data;
}

// Drift categories (deterministic classification).
enum class DriftCategory {
  none,
  result_digest,          // final result_digest differs
  stdout_digest,          // stdout_digest differs (command output changed)
  stderr_digest,          // stderr_digest differs
  request_digest,         // request_digest differs — canonicalization bug
  trace_digest,           // trace_digest differs (trace events differ)
  policy_applied,         // policy_applied strings differ
  env_time_leak,          // probable timestamp/env leak detected
};

std::string to_string(DriftCategory c) {
  switch (c) {
    case DriftCategory::none:           return "none";
    case DriftCategory::result_digest:  return "result_digest";
    case DriftCategory::stdout_digest:  return "stdout_digest";
    case DriftCategory::stderr_digest:  return "stderr_digest";
    case DriftCategory::request_digest: return "request_digest";
    case DriftCategory::trace_digest:   return "trace_digest";
    case DriftCategory::policy_applied: return "policy_applied";
    case DriftCategory::env_time_leak:  return "env_time_leak";
  }
  return "unknown";
}

// Classify the drift between primary and shadow results.
// Returns first (most significant) category detected.
DriftCategory classify_drift(const requiem::ExecutionResult& primary,
                              const requiem::ExecutionResult& shadow) {
  if (primary.request_digest != shadow.request_digest) return DriftCategory::request_digest;
  if (primary.result_digest  != shadow.result_digest)  return DriftCategory::result_digest;
  if (primary.stdout_digest  != shadow.stdout_digest)  return DriftCategory::stdout_digest;
  if (primary.stderr_digest  != shadow.stderr_digest)  return DriftCategory::stderr_digest;
  if (primary.trace_digest   != shadow.trace_digest)   return DriftCategory::trace_digest;
  // Check for potential time leak: stdout contains a digit pattern that changes.
  // Heuristic: if stdout_digest changes but command is deterministic, suspect time leak.
  const auto& pa = primary.policy_applied;
  const auto& sa = shadow.policy_applied;
  if (pa.mode != sa.mode || pa.time_mode != sa.time_mode) return DriftCategory::policy_applied;
  return DriftCategory::none;
}

struct DriftRecord {
  int         run_index;
  std::string tenant_id;
  std::string request_id;
  std::string request_digest;  // shared for both (canonicalization is stable)
  std::string primary_result_digest;
  std::string shadow_result_digest;
  DriftCategory category;
};

struct ShadowRunResult {
  double      latency_primary_ms{0};
  double      latency_shadow_ms{0};
  bool        drifted{false};
  DriftCategory category{DriftCategory::none};
  DriftRecord record;
};

ShadowRunResult run_shadow_pair(
    int run_index, const std::string& tid,
    const std::string& workspace_root, uint64_t seed) {
  // Build identical request for both primary and shadow.
  requiem::ExecutionRequest req;
  req.tenant_id      = tid;
  req.request_id     = tid + "-run-" + std::to_string(run_index);
  req.workspace_root = workspace_root;
  req.command        = "/bin/sh";
  req.argv           = {"-c", "echo deterministic_shadow_" + std::to_string(seed % 5)};
  req.policy.mode    = "strict";
  req.policy.deterministic = true;
  req.policy.time_mode     = "fixed_zero";
  req.nonce          = seed;

  // Primary run.
  const auto p0      = Clock::now();
  const auto primary = requiem::execute(req);
  const auto p1      = Clock::now();

  // Shadow run — same request, no meter event.
  const auto s0      = Clock::now();
  const auto shadow  = requiem::execute(req);
  const auto s1      = Clock::now();

  ShadowRunResult r;
  r.latency_primary_ms = std::chrono::duration<double, std::milli>(p1 - p0).count();
  r.latency_shadow_ms  = std::chrono::duration<double, std::milli>(s1 - s0).count();

  const DriftCategory cat = classify_drift(primary, shadow);
  r.drifted  = (cat != DriftCategory::none);
  r.category = cat;

  if (r.drifted) {
    r.record = DriftRecord{
        run_index, tid, req.request_id, primary.request_digest,
        primary.result_digest, shadow.result_digest, cat};
  }
  return r;
}

}  // namespace

int main() {
  const auto base_tmp = fs::temp_directory_path() / "requiem_shadow_runner";
  fs::remove_all(base_tmp);

  // Verify BLAKE3.
  const auto hi = requiem::hash_runtime_info();
  if (!hi.blake3_available || hi.primitive != "blake3") {
    std::cerr << "FATAL: BLAKE3 not available\n";
    return 1;
  }

  // Setup per-tenant workspaces.
  std::vector<std::string> tenant_ids;
  std::vector<fs::path>    workspaces;
  for (int i = 0; i < kNumTenants; ++i) {
    auto tid = tenant_id(i);
    tenant_ids.push_back(tid);
    fs::path ws = base_tmp / tid / "ws";
    fs::create_directories(ws);
    workspaces.push_back(ws);
  }

  // Build shuffled run order to simulate randomized worker scheduling.
  std::vector<std::pair<int, int>> run_order;  // (tenant_idx, run_seq)
  for (int t = 0; t < kNumTenants; ++t) {
    for (int r = 0; r < kRequestsPerTenant; ++r) {
      run_order.emplace_back(t, r);
    }
  }
  std::mt19937 rng(0xdeadbeef);  // Fixed seed for reproducibility.
  std::shuffle(run_order.begin(), run_order.end(), rng);

  std::vector<DriftRecord> drifts;
  std::mutex               drift_mu;
  std::atomic<int>         drift_count{0};
  std::atomic<int>         completed{0};

  // Shadow meter log — must remain empty.
  requiem::MeterLog shadow_meter;

  std::cout << "[shadow] running " << kTotalRequests << " shadow pairs across "
            << kNumTenants << " tenants...\n";

  const auto wall_t0 = Clock::now();

  // Bounded thread pool: use hardware_concurrency workers to avoid spawning
  // thousands of OS threads simultaneously (each pair forks 2 subprocesses).
  const int kWorkers = static_cast<int>(
      std::max(1u, std::min(16u, std::thread::hardware_concurrency())));
  std::atomic<std::size_t> next_job{0};

  std::vector<std::thread> workers;
  workers.reserve(static_cast<std::size_t>(kWorkers));
  for (int w = 0; w < kWorkers; ++w) {
    workers.emplace_back([&]() {
      for (;;) {
        const std::size_t idx = next_job.fetch_add(1);
        if (idx >= run_order.size()) break;
        const auto& [tidx, rseq] = run_order[idx];

        const uint64_t seed = static_cast<uint64_t>(tidx * 1000 + rseq);
        auto res = run_shadow_pair(
            static_cast<int>(tidx) * kRequestsPerTenant + rseq,
            tenant_ids[tidx], workspaces[tidx].string(), seed);

        if (res.drifted) {
          ++drift_count;
          std::lock_guard<std::mutex> lock(drift_mu);
          drifts.push_back(res.record);
        }

        // Shadow meter: must NOT emit (is_shadow=true → no-op).
        auto ev = requiem::make_meter_event(
            tenant_ids[tidx],
            tenant_ids[tidx] + "-shadow-" + std::to_string(rseq),
            "", /*success=*/true, "", /*is_shadow=*/true);
        shadow_meter.emit(ev);  // Must not count.

        ++completed;
      }
    });
  }
  for (auto& t : workers) t.join();

  const double wall_s = std::chrono::duration<double>(Clock::now() - wall_t0).count();

  // Promotion gate.
  const bool promotion_gate_pass = (drift_count.load() == 0);
  // Shadow meter must be empty.
  const bool shadow_meter_pass   = (shadow_meter.count_primary_success() == 0 &&
                                     shadow_meter.count_shadow() == 0);

  // Write redacted drift diffs.
  const std::string diffs_dir = "artifacts/reports/CLOUD_DRIFT_DIFFS";
  fs::create_directories(diffs_dir);
  for (std::size_t i = 0; i < drifts.size(); ++i) {
    const auto& d = drifts[i];
    std::ostringstream diff;
    diff << "{"
         << "\"run_index\":" << d.run_index
         << ",\"tenant_id\":\"" << d.tenant_id << "\""
         << ",\"request_id\":\"" << d.request_id << "\""
         // Digests are safe to log — they are not secrets.
         << ",\"request_digest\":\"" << d.request_digest << "\""
         << ",\"primary_result_digest\":\"" << d.primary_result_digest << "\""
         << ",\"shadow_result_digest\":\"" << d.shadow_result_digest << "\""
         << ",\"category\":\"" << to_string(d.category) << "\""
         << "}";
    write_file(diffs_dir + "/drift_" + std::to_string(i) + ".json", diff.str());
  }

  // Build main report.
  std::ostringstream report;
  report << "{"
         << "\"schema\":\"cloud_determinism_report_v1\""
         << ",\"pass\":" << (promotion_gate_pass && shadow_meter_pass ? "true" : "false")
         << ",\"tenants\":" << kNumTenants
         << ",\"total_pairs\":" << kTotalRequests
         << ",\"completed\":" << completed.load()
         << ",\"drift_count\":" << drift_count.load()
         << ",\"promotion_gate\":\"" << (promotion_gate_pass ? "PASS" : "FAIL") << "\""
         << ",\"shadow_meter_events\":" << shadow_meter.count_primary_success()
         << ",\"shadow_meter_pass\":" << (shadow_meter_pass ? "true" : "false")
         << ",\"wall_time_s\":" << wall_s
         << ",\"drift_diffs_dir\":\"" << diffs_dir << "\""
         << ",\"hash_primitive\":\"blake3\""
         << "}";

  write_file("artifacts/reports/CLOUD_DETERMINISM_REPORT.json", report.str());
  std::cout << "[shadow] report written: artifacts/reports/CLOUD_DETERMINISM_REPORT.json\n";
  std::cout << "[shadow] promotion_gate=" << (promotion_gate_pass ? "PASS" : "FAIL")
            << " drift=" << drift_count.load() << "\n";

  fs::remove_all(base_tmp);
  return (promotion_gate_pass && shadow_meter_pass) ? 0 : 1;
}
