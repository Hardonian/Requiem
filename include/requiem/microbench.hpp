#pragma once

// requiem/microbench.hpp — Microbenchmark suite for kernel operations.
//
// PHASE 3: Performance Hardening
//
// Provides microbenchmarks for:
//   - Event append (event_log.hpp)
//   - CAS put/get (cas.hpp)
//   - Policy evaluation (policy_vm.hpp)
//   - Plan scheduling (plan.hpp)
//
// Output format: JSON with p50/p95/p99 latency histograms.
// Includes regression detection: fail if > X% slowdown from baseline.

#include <cstdint>
#include <string>
#include <vector>
#include <chrono>
#include <functional>

namespace requiem {
namespace microbench {

// ---------------------------------------------------------------------------
// Benchmark result
// ---------------------------------------------------------------------------

struct LatencyStats {
  double min_ns{0};
  double max_ns{0};
  double mean_ns{0};
  double stddev_ns{0};
  double p50_ns{0};
  double p95_ns{0};
  double p99_ns{0};
  double p999_ns{0};
};

struct BenchmarkResult {
  std::string name;
  uint64_t iterations{0};
  LatencyStats latency;
  double throughput_ops_sec{0};
  bool regression_detected{false};
  std::string regression_error;
};

// Microbenchmark: a function that can be timed
using BenchmarkFn = std::function<void()>;

// ---------------------------------------------------------------------------
// Latency histogram computation
// ---------------------------------------------------------------------------

// Compute percentile from sorted values
double percentile(const std::vector<double>& sorted, double p);

// Compute latency statistics from raw nanosecond measurements
LatencyStats compute_latency_stats(const std::vector<double>& samples_ns);

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

// Run a microbenchmark and return results
// iterations: number of times to run the benchmark
// warmup: number of warmup runs (not counted)
BenchmarkResult run_benchmark(
    const std::string& name,
    BenchmarkFn fn,
    uint64_t iterations = 1000,
    uint64_t warmup = 100);

// ---------------------------------------------------------------------------
// Regression detection
// ---------------------------------------------------------------------------

// Baseline result for regression comparison
struct Baseline {
  std::string name;
  double p50_ns{0};
  double p95_ns{0};
  double p99_ns{0};
  double throughput_ops_sec{0};
  std::string timestamp;
};

// Load baseline from JSON file
std::optional<Baseline> load_baseline(const std::string& path);

// Save baseline to JSON file
void save_baseline(const Baseline& baseline, const std::string& path);

// Check if current result exceeds regression threshold
// threshold: percentage (e.g., 0.10 = 10% slowdown = regression)
bool check_regression(
    const BenchmarkResult& result,
    const Baseline& baseline,
    double threshold = 0.10);

// ---------------------------------------------------------------------------
// Standard microbenchmarks
// ---------------------------------------------------------------------------

// Benchmark event log append
BenchmarkResult bench_event_append(
    const std::string& event_log_path,
    uint64_t iterations = 1000);

// Benchmark CAS put
BenchmarkResult bench_cas_put(
    const std::string& data,
    uint64_t iterations = 1000);

// Benchmark CAS get
BenchmarkResult bench_cas_get(
    const std::string& digest,
    uint64_t iterations = 1000);

// Benchmark policy evaluation
BenchmarkResult bench_policy_eval(
    const std::string& policy_json,
    const std::string& request_json,
    uint64_t iterations = 1000);

// Benchmark plan scheduling (topological sort)
BenchmarkResult bench_plan_scheduling(
    const std::string& plan_json,
    uint64_t iterations = 1000);

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

// Serialize benchmark result to JSON
std::string benchmark_result_to_json(const BenchmarkResult& result);

// Serialize multiple results to JSON
std::string benchmark_results_to_json(const std::vector<BenchmarkResult>& results);

}  // namespace microbench
}  // namespace requiem
