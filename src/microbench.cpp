#include "requiem/microbench.hpp"
#include "requiem/event_log.hpp"
#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <memory>
#include <sstream>
#include <vector>

namespace requiem {
namespace microbench {

// ---------------------------------------------------------------------------
// Latency histogram computation
// ---------------------------------------------------------------------------

double percentile(const std::vector<double>& sorted, double p) {
  if (sorted.empty()) return 0.0;
  if (p <= 0.0) return sorted.front();
  if (p >= 1.0) return sorted.back();
  
  double idx = p * (sorted.size() - 1);
  size_t lo = static_cast<size_t>(std::floor(idx));
  size_t hi = static_cast<size_t>(std::ceil(idx));
  
  if (lo == hi) return sorted[lo];
  
  double fraction = idx - lo;
  return sorted[lo] * (1.0 - fraction) + sorted[hi] * fraction;
}

LatencyStats compute_latency_stats(const std::vector<double>& samples_ns) {
  LatencyStats stats;
  
  if (samples_ns.empty()) return stats;
  
  // Sort for percentile computation
  std::vector<double> sorted = samples_ns;
  std::sort(sorted.begin(), sorted.end());
  
  // Compute basic stats
  double sum = 0.0;
  stats.min_ns = sorted.front();
  stats.max_ns = sorted.back();
  
  for (double v : sorted) {
    sum += v;
  }
  stats.mean_ns = sum / sorted.size();
  
  // Standard deviation
  double sq_diff_sum = 0.0;
  for (double v : sorted) {
    double diff = v - stats.mean_ns;
    sq_diff_sum += diff * diff;
  }
  stats.stddev_ns = std::sqrt(sq_diff_sum / sorted.size());
  
  // Percentiles
  stats.p50_ns = percentile(sorted, 0.50);
  stats.p95_ns = percentile(sorted, 0.95);
  stats.p99_ns = percentile(sorted, 0.99);
  stats.p999_ns = percentile(sorted, 0.999);
  
  return stats;
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

BenchmarkResult run_benchmark(
    const std::string& name,
    BenchmarkFn fn,
    uint64_t iterations,
    uint64_t warmup) {
  
  BenchmarkResult result;
  result.name = name;
  result.iterations = iterations;
  
  std::vector<double> samples;
  samples.reserve(iterations);
  
  // Warmup runs
  for (uint64_t i = 0; i < warmup; ++i) {
    fn();
  }
  
  // Timed runs
  for (uint64_t i = 0; i < iterations; ++i) {
    auto start = std::chrono::high_resolution_clock::now();
    fn();
    auto end = std::chrono::high_resolution_clock::now();
    
    double duration_ns = std::chrono::duration<double, std::nano>(end - start).count();
    samples.push_back(duration_ns);
  }
  
  // Compute statistics
  result.latency = compute_latency_stats(samples);
  
  // Throughput: ops/sec based on mean latency
  if (result.latency.mean_ns > 0) {
    result.throughput_ops_sec = 1e9 / result.latency.mean_ns;
  }
  
  return result;
}

// ---------------------------------------------------------------------------
// Regression detection
// ---------------------------------------------------------------------------

std::optional<Baseline> load_baseline(const std::string& path) {
  std::ifstream file(path);
  if (!file.good()) {
    return std::nullopt;
  }
  
  std::stringstream buffer;
  buffer << file.rdbuf();
  
  auto obj = jsonlite::parse(buffer.str(), nullptr);
  
  Baseline baseline;
  baseline.name = jsonlite::get_string(obj, "name", "");
  baseline.p50_ns = static_cast<double>(jsonlite::get_u64(obj, "p50_ns", 0));
  baseline.p95_ns = static_cast<double>(jsonlite::get_u64(obj, "p95_ns", 0));
  baseline.p99_ns = static_cast<double>(jsonlite::get_u64(obj, "p99_ns", 0));
  baseline.throughput_ops_sec = static_cast<double>(jsonlite::get_u64(obj, "throughput_ops_sec", 0));
  baseline.timestamp = jsonlite::get_string(obj, "timestamp", "");
  
  return baseline;
}

void save_baseline(const Baseline& baseline, const std::string& path) {
  jsonlite::Object obj;
  obj["name"] = baseline.name;
  obj["p50_ns"] = baseline.p50_ns;
  obj["p95_ns"] = baseline.p95_ns;
  obj["p99_ns"] = baseline.p99_ns;
  obj["throughput_ops_sec"] = baseline.throughput_ops_sec;
  obj["timestamp"] = baseline.timestamp;
  
  std::ofstream file(path);
  file << jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

bool check_regression(
    const BenchmarkResult& result,
    const Baseline& baseline,
    double threshold) {
  
  // Check p50 regression
  if (baseline.p50_ns > 0) {
    double p50_change = (result.latency.p50_ns - baseline.p50_ns) / baseline.p50_ns;
    if (p50_change > threshold) {
      return true;
    }
  }
  
  // Check p95 regression
  if (baseline.p95_ns > 0) {
    double p95_change = (result.latency.p95_ns - baseline.p95_ns) / baseline.p95_ns;
    if (p95_change > threshold) {
      return true;
    }
  }
  
  // Check throughput regression (negative = slower = regression)
  if (baseline.throughput_ops_sec > 0) {
    double throughput_change = 
        (result.throughput_ops_sec - baseline.throughput_ops_sec) / baseline.throughput_ops_sec;
    if (throughput_change < -threshold) {
      return true;
    }
  }
  
  return false;
}

// ---------------------------------------------------------------------------
// Standard microbenchmarks
// ---------------------------------------------------------------------------

BenchmarkResult bench_event_append(
    const std::string& event_log_path,
    uint64_t iterations) {
  
  // Create event log
  EventLog log(event_log_path);
  
  auto fn = [&log]() {
    EventRecord record;
    record.event_type = "bench.event";
    record.actor = "bench";
    record.data_hash = "bench_data_hash";
    record.tenant_id = "bench_tenant";
    record.ok = true;
    log.append(record);
  };
  
  return run_benchmark("event_append", fn, iterations, 100);
}

BenchmarkResult bench_cas_put(
    const std::string& data,
    uint64_t iterations) {
  
  // Create CAS store in memory for benchmark
  auto backend = std::make_shared<CasStore>(".requiem/bench_cas");
  
  auto fn = [&backend, &data]() {
    backend->put(data);
  };
  
  return run_benchmark("cas_put", fn, iterations, 100);
}

BenchmarkResult bench_cas_get(
    const std::string& digest,
    uint64_t iterations) {
  
  auto backend = std::make_shared<CasStore>(".requiem/bench_cas");
  
  // Ensure the data exists
  backend->put("benchmark_data_for_get");
  std::string actual_digest = backend->put("benchmark_data_for_get");
  
  auto fn = [&backend, &actual_digest]() {
    backend->get(actual_digest);
  };
  
  return run_benchmark("cas_get", fn, iterations, 100);
}

// Placeholder for policy evaluation benchmark
// Would require policy_vm.hpp integration
BenchmarkResult bench_policy_eval(
    const std::string& policy_json,
    const std::string& request_json,
    uint64_t iterations) {
  
  // Placeholder: would integrate with policy_vm
  auto fn = []() {
    // Do minimal work
    volatile int x = 0;
    x++;
  };
  
  return run_benchmark("policy_eval", fn, iterations, 100);
}

// Placeholder for plan scheduling benchmark
// Would require plan.hpp integration
BenchmarkResult bench_plan_scheduling(
    const std::string& plan_json,
    uint64_t iterations) {
  
  // Placeholder: would integrate with plan_topological_order
  auto fn = []() {
    // Do minimal work
    volatile int x = 0;
    x++;
  };
  
  return run_benchmark("plan_scheduling", fn, iterations, 100);
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

std::string benchmark_result_to_json(const BenchmarkResult& result) {
  jsonlite::Object obj;
  obj["name"] = result.name;
  obj["iterations"] = static_cast<uint64_t>(result.iterations);
  
  jsonlite::Object lat;
  obj["min_ns"] = static_cast<uint64_t>(result.latency.min_ns);
  obj["max_ns"] = static_cast<uint64_t>(result.latency.max_ns);
  obj["mean_ns"] = static_cast<uint64_t>(result.latency.mean_ns);
  obj["stddev_ns"] = static_cast<uint64_t>(result.latency.stddev_ns);
  obj["p50_ns"] = static_cast<uint64_t>(result.latency.p50_ns);
  obj["p95_ns"] = static_cast<uint64_t>(result.latency.p95_ns);
  obj["p99_ns"] = static_cast<uint64_t>(result.latency.p99_ns);
  obj["p999_ns"] = static_cast<uint64_t>(result.latency.p999_ns);
  obj["latency"] = std::move(lat);
  
  obj["throughput_ops_sec"] = result.throughput_ops_sec;
  obj["regression_detected"] = result.regression_detected;
  obj["regression_error"] = result.regression_error;
  
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string benchmark_results_to_json(const std::vector<BenchmarkResult>& results) {
  jsonlite::Array arr;
  for (const auto& r : results) {
    auto obj = jsonlite::parse(benchmark_result_to_json(r), nullptr);
    arr.push_back(std::move(obj));
  }
  return jsonlite::to_json(jsonlite::Value{std::move(arr)});
}

}  // namespace microbench
}  // namespace requiem
