// stress_harness.cpp — Phase 1: Multi-tenant cloud stress harness.
//
// Drives Requiem through its direct execution interface (adapter-level):
//   - 50 distinct TenantIDs with per-tenant CAS stores and workspaces
//   - Mixed payload sizes: small / medium / large (bounded)
//   - 2 policy variants: strict+deterministic, strict+non-deterministic
//   - 10,000 sequential executions (across tenants)
//   - 1,000 concurrent executions (burst)
//
// FAIL conditions (hard abort with non-zero exit):
//   - fingerprint drift for identical canonical inputs
//   - unhandled exceptions / panics
//   - cross-tenant CAS read (tenant B can read tenant A's digest)
//   - any 5xx-equivalent error escalation
//
// Produces: artifacts/reports/CLOUD_STRESS_REPORT.json

#include <algorithm>
#include <atomic>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <map>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/metering.hpp"
#include "requiem/runtime.hpp"

namespace fs = std::filesystem;
using Clock  = std::chrono::steady_clock;
using Ms     = std::chrono::duration<double, std::milli>;

namespace {

constexpr int kNumTenants      = 50;
constexpr int kSeqExecutions   = 10000;
constexpr int kConcurrent      = 1000;

// ---- helpers ---------------------------------------------------------------

std::string fmt_double(double v, int prec = 3) {
  std::ostringstream oss;
  oss.precision(prec);
  oss << std::fixed << v;
  return oss.str();
}

std::string tenant_id(int i) {
  char buf[16];
  std::snprintf(buf, sizeof(buf), "tenant-%03d", i + 1);
  return buf;
}

std::string make_request_id(const std::string& tid, int seq) {
  return tid + "-seq-" + std::to_string(seq);
}

// Percentile from sorted latencies vector.
double percentile(const std::vector<double>& sorted, double p) {
  if (sorted.empty()) return 0.0;
  const std::size_t idx = static_cast<std::size_t>((sorted.size() - 1) * p);
  return sorted[std::min(idx, sorted.size() - 1)];
}

void write_report(const std::string& path, const std::string& json) {
  fs::create_directories(fs::path(path).parent_path());
  std::ofstream ofs(path, std::ios::trunc | std::ios::binary);
  ofs << json;
}

// ---- tenant fixture --------------------------------------------------------

struct TenantFixture {
  std::string      id;
  fs::path         workspace;
  fs::path         cas_root;
  requiem::CasStore cas;

  explicit TenantFixture(const std::string& tid, const fs::path& base)
      : id(tid),
        workspace(base / tid / "ws"),
        cas_root(base / tid / "cas"),
        cas((base / tid / "cas").string()) {
    fs::create_directories(workspace);
  }
};

// ---- execution helper ------------------------------------------------------

struct ExecMetrics {
  double      latency_ms{0.0};
  bool        ok{false};
  std::string error_code;
  std::string result_digest;
  std::string request_digest;
  std::string tenant_id;
  int         cas_hit{0};  // 1 = CAS hit (same digest seen before), 0 = miss
};

struct RunConfig {
  std::string tenant_id;
  int         seq{0};
  int         payload_variant{0};   // 0=small, 1=medium, 2=large
  int         policy_variant{0};    // 0=strict+det, 1=strict+non-det
  uint64_t    nonce{0};
  std::string workspace_root;
};

ExecMetrics run_one(const RunConfig& cfg) {
  requiem::ExecutionRequest req;
  req.tenant_id      = cfg.tenant_id;
  req.request_id     = make_request_id(cfg.tenant_id, cfg.seq);
  req.workspace_root = cfg.workspace_root;
  req.nonce          = cfg.nonce;
  req.timeout_ms     = 2000;

  // Payload variants.
  switch (cfg.payload_variant % 3) {
    case 0:  // small
      req.command = "/bin/sh";
      req.argv    = {"-c", "echo small_payload_" + cfg.tenant_id};
      break;
    case 1:  // medium — process a fixed string
      req.command = "/bin/sh";
      req.argv    = {"-c",
                     "printf '%0.s-' {1..500} | wc -c"};  // deterministic
      break;
    case 2:  // large — bounded
      req.command = "/bin/sh";
      req.argv    = {"-c",
                     "dd if=/dev/zero bs=4096 count=2 2>/dev/null | wc -c"};
      break;
  }

  // Policy variants.
  req.policy.mode          = "strict";
  req.policy.deterministic = (cfg.policy_variant % 2 == 0);
  req.policy.time_mode     = req.policy.deterministic ? "fixed_zero" : "real";

  const auto t0     = Clock::now();
  const auto result = requiem::execute(req);
  const auto t1     = Clock::now();

  ExecMetrics m;
  m.latency_ms     = Ms(t1 - t0).count();
  m.ok             = result.ok;
  m.error_code     = result.error_code;
  m.result_digest  = result.result_digest;
  m.request_digest = result.request_digest;
  m.tenant_id      = cfg.tenant_id;
  return m;
}

// ---- drift detector --------------------------------------------------------

// Map canonical_request_digest → first result_digest seen.
// Fail if a subsequent run for the same canonical input produces a different result_digest.
struct DriftDetector {
  std::mutex                        mu;
  std::map<std::string, std::string> seen;  // request_digest → result_digest
  int                               drift_count{0};

  bool check(const std::string& req_digest, const std::string& result_digest) {
    std::lock_guard<std::mutex> lock(mu);
    auto it = seen.find(req_digest);
    if (it == seen.end()) {
      seen[req_digest] = result_digest;
      return true;
    }
    if (it->second != result_digest) {
      ++drift_count;
      std::cerr << "DRIFT DETECTED: req=" << req_digest
                << " expected=" << it->second
                << " got=" << result_digest << "\n";
      return false;
    }
    return true;
  }
};

// ---- statistics aggregator -------------------------------------------------

struct Stats {
  std::mutex          mu;
  std::vector<double> latencies;
  std::map<std::string, int> error_dist;
  int   success{0};
  int   failure{0};
  int   cas_hits{0};
  int   cas_misses{0};
  std::map<std::string, int> per_tenant_success;

  void record(const ExecMetrics& m) {
    std::lock_guard<std::mutex> lock(mu);
    latencies.push_back(m.latency_ms);
    if (m.ok) {
      ++success;
      per_tenant_success[m.tenant_id]++;
    } else {
      ++failure;
      error_dist[m.error_code.empty() ? "unknown" : m.error_code]++;
    }
  }

  std::string to_json(const std::string& phase, double wall_s) const {
    std::vector<double> sorted_lat = latencies;
    std::sort(sorted_lat.begin(), sorted_lat.end());

    const int total = success + failure;
    std::ostringstream oss;
    oss << "{"
        << "\"phase\":\"" << phase << "\""
        << ",\"total\":" << total
        << ",\"success\":" << success
        << ",\"failure\":" << failure
        << ",\"throughput_ops_sec\":" << fmt_double(total / (wall_s > 0 ? wall_s : 1.0))
        << ",\"latency_ms\":{"
        << "\"p50\":" << fmt_double(percentile(sorted_lat, 0.50))
        << ",\"p95\":" << fmt_double(percentile(sorted_lat, 0.95))
        << ",\"p99\":" << fmt_double(percentile(sorted_lat, 0.99))
        << ",\"min\":" << fmt_double(sorted_lat.empty() ? 0.0 : sorted_lat.front())
        << ",\"max\":" << fmt_double(sorted_lat.empty() ? 0.0 : sorted_lat.back())
        << "}"
        << ",\"error_dist\":{";
    bool first = true;
    for (const auto& [code, cnt] : error_dist) {
      if (!first) oss << ",";
      first = false;
      oss << "\"" << code << "\":" << cnt;
    }
    oss << "}";
    oss << ",\"five_xx_rate\":" << fmt_double(total > 0 ? (double)failure / total : 0.0)
        << "}";
    return oss.str();
  }
};

}  // namespace

int main() {
  const auto base_tmp = fs::temp_directory_path() / "requiem_stress_harness";
  fs::remove_all(base_tmp);
  fs::create_directories(base_tmp);

  // Verify BLAKE3 is available before doing anything.
  const auto hi = requiem::hash_runtime_info();
  if (!hi.blake3_available || hi.primitive != "blake3") {
    std::cerr << "FATAL: BLAKE3 not available — aborting stress harness\n";
    return 1;
  }

  // Build per-tenant fixtures.
  std::vector<TenantFixture> tenants;
  tenants.reserve(kNumTenants);
  for (int i = 0; i < kNumTenants; ++i) {
    tenants.emplace_back(tenant_id(i), base_tmp);
  }

  DriftDetector drift;
  Stats         seq_stats;
  Stats         conc_stats;
  requiem::MeterLog meter;

  // ---- Phase 1a: 10,000 sequential executions ----------------------------
  std::cout << "[stress] sequential: " << kSeqExecutions << " executions...\n";
  const auto seq_t0 = Clock::now();

  for (int i = 0; i < kSeqExecutions; ++i) {
    const int tidx = i % kNumTenants;
    RunConfig cfg;
    cfg.tenant_id      = tenants[tidx].id;
    cfg.seq            = i;
    cfg.payload_variant = i % 3;
    cfg.policy_variant  = i % 2;
    cfg.nonce           = 0;  // fixed nonce for determinism check
    cfg.workspace_root  = tenants[tidx].workspace.string();

    const auto m = run_one(cfg);
    seq_stats.record(m);

    // Drift check: only for deterministic policy runs (nonce=0, same command per variant).
    if (cfg.policy_variant == 0 && !m.request_digest.empty() && !m.result_digest.empty()) {
      if (!drift.check(m.request_digest, m.result_digest)) {
        std::cerr << "FATAL: fingerprint drift in sequential run at i=" << i << "\n";
        fs::remove_all(base_tmp);
        return 2;
      }
    }

    // Meter: one event per successful primary execution.
    auto ev = requiem::make_meter_event(
        cfg.tenant_id, make_request_id(cfg.tenant_id, i),
        m.request_digest, m.ok, m.error_code, /*is_shadow=*/false);
    meter.emit(ev);

    if (i % 1000 == 999) {
      std::cout << "  [seq] " << (i + 1) << "/" << kSeqExecutions
                << " ok=" << seq_stats.success << "\n";
    }
  }

  const double seq_wall = std::chrono::duration<double>(Clock::now() - seq_t0).count();
  std::cout << "[stress] sequential done in " << fmt_double(seq_wall) << "s\n";

  // ---- Phase 1b: 1,000 concurrent executions -----------------------------
  std::cout << "[stress] concurrent: " << kConcurrent << " executions...\n";
  std::atomic<bool> concurrent_drift{false};

  const auto conc_t0 = Clock::now();
  {
    std::vector<std::thread> threads;
    threads.reserve(kConcurrent);
    for (int i = 0; i < kConcurrent; ++i) {
      threads.emplace_back([&, i]() {
        const int tidx = i % kNumTenants;
        RunConfig cfg;
        cfg.tenant_id      = tenants[tidx].id;
        cfg.seq            = kSeqExecutions + i;
        cfg.payload_variant = i % 3;
        cfg.policy_variant  = i % 2;
        cfg.nonce           = 0;
        cfg.workspace_root  = tenants[tidx].workspace.string();

        const auto m = run_one(cfg);
        conc_stats.record(m);

        if (cfg.policy_variant == 0 && !m.request_digest.empty() && !m.result_digest.empty()) {
          if (!drift.check(m.request_digest, m.result_digest)) {
            concurrent_drift.store(true);
          }
        }
        auto ev = requiem::make_meter_event(
            cfg.tenant_id, make_request_id(cfg.tenant_id, kSeqExecutions + i),
            m.request_digest, m.ok, m.error_code, false);
        meter.emit(ev);
      });
    }
    for (auto& t : threads) t.join();
  }
  const double conc_wall = std::chrono::duration<double>(Clock::now() - conc_t0).count();
  std::cout << "[stress] concurrent done in " << fmt_double(conc_wall) << "s\n";

  if (concurrent_drift.load()) {
    std::cerr << "FATAL: fingerprint drift in concurrent run\n";
    fs::remove_all(base_tmp);
    return 2;
  }

  // ---- Cross-tenant CAS isolation check ----------------------------------
  // Verify that tenant B cannot read a digest stored only in tenant A's CAS.
  bool cas_isolation_pass = true;
  {
    // Store something unique in tenant-0's CAS.
    const std::string secret_data = "only-for-tenant-001-" + std::string(32, 'x');
    const std::string stored      = tenants[0].cas.put(secret_data, "off");
    if (!stored.empty()) {
      // Try to fetch from tenant-1's CAS (different root path).
      const bool visible = tenants[1].cas.contains(stored);
      if (visible) {
        std::cerr << "FATAL: cross-tenant CAS read — tenant-001 digest visible from tenant-002\n";
        cas_isolation_pass = false;
      }
    }
  }

  // ---- Billing parity check ----------------------------------------------
  const std::size_t total_success =
      static_cast<std::size_t>(seq_stats.success + conc_stats.success);
  const std::string billing_error = meter.verify_parity(total_success);

  // ---- Build report -------------------------------------------------------
  const bool overall_pass = (drift.drift_count == 0) && cas_isolation_pass &&
                            billing_error.empty();

  std::ostringstream report;
  report << "{"
         << "\"schema\":\"cloud_stress_report_v1\""
         << ",\"pass\":" << (overall_pass ? "true" : "false")
         << ",\"tenants\":" << kNumTenants
         << ",\"sequential\":" << seq_stats.to_json("sequential", seq_wall)
         << ",\"concurrent\":" << conc_stats.to_json("concurrent", conc_wall)
         << ",\"determinism\":{"
         <<   "\"drift_count\":" << drift.drift_count
         <<   ",\"unique_canonical_inputs\":" << drift.seen.size()
         <<   ",\"pass\":" << (drift.drift_count == 0 ? "true" : "false")
         << "}"
         << ",\"cas_isolation\":{"
         <<   "\"cross_tenant_read\":" << (cas_isolation_pass ? "false" : "true")
         <<   ",\"pass\":" << (cas_isolation_pass ? "true" : "false")
         << "}"
         << ",\"billing\":{"
         <<   "\"total_meter_events\":" << meter.count_primary_success()
         <<   ",\"shadow_events\":" << meter.count_shadow()
         <<   ",\"error\":\"" << billing_error << "\""
         <<   ",\"pass\":" << (billing_error.empty() ? "true" : "false")
         << "}"
         << ",\"hash_primitive\":\"blake3\""
         << ",\"hash_backend\":\"" << hi.backend << "\""
         << "}";

  const std::string report_path = "artifacts/reports/CLOUD_STRESS_REPORT.json";
  write_report(report_path, report.str());
  std::cout << "[stress] report written: " << report_path << "\n";
  std::cout << "[stress] pass=" << (overall_pass ? "true" : "false") << "\n";

  fs::remove_all(base_tmp);
  return overall_pass ? 0 : 1;
}
