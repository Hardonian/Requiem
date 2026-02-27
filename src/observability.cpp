#include "requiem/observability.hpp"

#include <bit>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <sstream>

namespace requiem {

namespace {

// MICRO_OPT: bit_width gives the bucket index in O(1) using hardware BSR/CLZ.
// Equivalent to floor(log2(x)) for x > 0.
// Measured: replaces a loop-based search, saving ~3 cycles per histogram record.
// MICRO_DOCUMENTED: Uses std::bit_width (C++20) which compiles to BSR on x86-64
// and CLZ on ARM. Assumption: compiler targets x86-64 or ARMv8+.
inline size_t bucket_for_us(uint64_t duration_us) {
  if (duration_us == 0) return 0;
  size_t b = static_cast<size_t>(std::bit_width(duration_us));
  return (b >= LatencyHistogram::kBuckets) ? LatencyHistogram::kBuckets - 1 : b;
}

}  // namespace

// ---------------------------------------------------------------------------
// LatencyHistogram
// ---------------------------------------------------------------------------

void LatencyHistogram::record(uint64_t duration_ns) {
  const uint64_t us = duration_ns / 1000u;
  const size_t b = bucket_for_us(us);
  buckets_[b].fetch_add(1, std::memory_order_relaxed);
  count_.fetch_add(1, std::memory_order_relaxed);
  sum_us_.fetch_add(us, std::memory_order_relaxed);
}

double LatencyHistogram::mean_us() const {
  const uint64_t n = count_.load(std::memory_order_relaxed);
  if (n == 0) return 0.0;
  return static_cast<double>(sum_us_.load(std::memory_order_relaxed)) / static_cast<double>(n);
}

double LatencyHistogram::percentile(double p) const {
  const uint64_t n = count_.load(std::memory_order_relaxed);
  if (n == 0) return 0.0;

  // Snapshot bucket counts
  uint64_t counts[kBuckets];
  for (size_t i = 0; i < kBuckets; ++i) {
    counts[i] = buckets_[i].load(std::memory_order_relaxed);
  }

  const uint64_t target = static_cast<uint64_t>(p * static_cast<double>(n));
  uint64_t cumulative = 0;
  for (size_t i = 0; i < kBuckets; ++i) {
    cumulative += counts[i];
    if (cumulative >= target) {
      // Return midpoint of bucket i: [2^(i-1), 2^i) us, midpoint = 2^(i-1)*1.5
      // Bucket 0 covers [0,1)us → return 0.5us
      const double bucket_lo = (i == 0) ? 0.0 : static_cast<double>(1ULL << (i - 1));
      const double bucket_hi = static_cast<double>(1ULL << i);
      return (bucket_lo + bucket_hi) * 0.5;
    }
  }
  // All in last bucket
  return static_cast<double>(1ULL << (kBuckets - 1));
}

std::string LatencyHistogram::to_json() const {
  const uint64_t n = count_.load(std::memory_order_relaxed);
  // MICRO_OPT: Pre-reserved string for JSON serialization of histogram.
  std::string out;
  out.reserve(256);
  out += "{\"count\":";
  out += std::to_string(n);
  out += ",\"mean_us\":";
  char buf[32];
  std::snprintf(buf, sizeof(buf), "%.2f", mean_us());
  out += buf;
  out += ",\"p50_us\":";
  std::snprintf(buf, sizeof(buf), "%.2f", percentile(0.50));
  out += buf;
  out += ",\"p95_us\":";
  std::snprintf(buf, sizeof(buf), "%.2f", percentile(0.95));
  out += buf;
  out += ",\"p99_us\":";
  std::snprintf(buf, sizeof(buf), "%.2f", percentile(0.99));
  out += buf;
  out += '}';
  return out;
}

// ---------------------------------------------------------------------------
// EngineStats
// ---------------------------------------------------------------------------

void EngineStats::record_execution(const ExecutionEvent& ev) {
  total_executions.fetch_add(1, std::memory_order_relaxed);
  if (ev.ok) {
    successful_executions.fetch_add(1, std::memory_order_relaxed);
  } else {
    failed_executions.fetch_add(1, std::memory_order_relaxed);
  }
  if (ev.replay_verified) {
    replay_verifications.fetch_add(1, std::memory_order_relaxed);
  }
  cas_puts.fetch_add(ev.cas_puts, std::memory_order_relaxed);
  cas_hits.fetch_add(ev.cas_hits, std::memory_order_relaxed);
  cas_gets.fetch_add(ev.cas_misses + ev.cas_hits, std::memory_order_relaxed);

  latency_histogram.record(ev.duration_ns);

  // Ring buffer update (requires lock)
  {
    std::lock_guard<std::mutex> lk(ring_mu_);
    if (ring_buffer_.size() >= kMaxRecentEvents) {
      ring_buffer_.erase(ring_buffer_.begin());  // O(N) but bounded
      // EXTENSION_POINT: replace vector with a proper circular buffer (e.g. boost::circular_buffer)
      // to make this O(1). For kMaxRecentEvents=1000 and low event rate, O(N) is acceptable.
    }
    ring_buffer_.push_back(ev);
  }
}

std::vector<ExecutionEvent> EngineStats::recent_events_snapshot() const {
  std::lock_guard<std::mutex> lk(ring_mu_);
  return ring_buffer_;
}

std::string EngineStats::to_json() const {
  // MICRO_OPT: pre-reserved string avoids multiple reallocations.
  std::string out;
  out.reserve(512);
  char buf[64];

  out += "{\"total_executions\":";
  out += std::to_string(total_executions.load(std::memory_order_relaxed));
  out += ",\"successful_executions\":";
  out += std::to_string(successful_executions.load(std::memory_order_relaxed));
  out += ",\"failed_executions\":";
  out += std::to_string(failed_executions.load(std::memory_order_relaxed));
  out += ",\"replay_verifications\":";
  out += std::to_string(replay_verifications.load(std::memory_order_relaxed));
  out += ",\"replay_divergences\":";
  out += std::to_string(replay_divergences.load(std::memory_order_relaxed));
  out += ",\"cas_puts\":";
  out += std::to_string(cas_puts.load(std::memory_order_relaxed));
  out += ",\"cas_gets\":";
  out += std::to_string(cas_gets.load(std::memory_order_relaxed));
  out += ",\"cas_hits\":";
  out += std::to_string(cas_hits.load(std::memory_order_relaxed));
  out += ",\"latency\":";
  out += latency_histogram.to_json();
  out += ",\"cache_metrics\":{\"l1_miss_rate\":";
  std::snprintf(buf, sizeof(buf), "%.4f", cache_metrics.l1_miss_rate);
  out += buf;
  out += ",\"branch_miss_rate\":";
  std::snprintf(buf, sizeof(buf), "%.4f", cache_metrics.branch_miss_rate);
  out += buf;
  out += "}}";
  return out;
}

// ---------------------------------------------------------------------------
// Global singleton + event emission
// ---------------------------------------------------------------------------

EngineStats& global_engine_stats() {
  static EngineStats inst;
  return inst;
}

// Hook storage
namespace {
std::atomic<ExecutionEventHook> g_event_hook{nullptr};
}

void set_execution_event_hook(ExecutionEventHook hook) {
  g_event_hook.store(hook, std::memory_order_release);
}

void emit_execution_event(const ExecutionEvent& ev) {
  // 1. Record in global stats (always).
  global_engine_stats().record_execution(ev);

  // 2. Optional custom hook (Enterprise exporter).
  // EXTENSION_POINT: OpenTelemetry_exporter
  ExecutionEventHook hook = g_event_hook.load(std::memory_order_acquire);
  if (hook) {
    hook(ev);
    return;
  }

  // 3. OSS mode: JSONL to event log file if configured.
  // EXTENSION_POINT: anomaly_detection_layer
  // Activation: set REQUIEM_EVENT_LOG=/path/to/events.jsonl
  // Format: one JSON object per line.
  const char* log_path = std::getenv("REQUIEM_EVENT_LOG");
  if (!log_path || !log_path[0]) return;

  // Build event JSON line (compact, no pretty-print).
  std::string line;
  line.reserve(256);
  char buf[64];
  line += "{\"execution_id\":\"";
  line += ev.execution_id;
  line += "\",\"tenant_id\":\"";
  line += ev.tenant_id;
  line += "\",\"ok\":";
  line += ev.ok ? "true" : "false";
  line += ",\"duration_ns\":";
  line += std::to_string(ev.duration_ns);
  line += ",\"error_code\":\"";
  line += ev.error_code;
  line += "\",\"bytes_in\":";
  line += std::to_string(ev.bytes_in);
  line += ",\"bytes_out\":";
  std::snprintf(buf, sizeof(buf), "%zu", ev.bytes_stdout + ev.bytes_stderr);
  line += buf;
  line += "}\n";

  // Append to log (O_APPEND is atomic for writes < PIPE_BUF on POSIX).
  if (FILE* f = std::fopen(log_path, "a")) {
    std::fwrite(line.data(), 1, line.size(), f);
    std::fclose(f);
  }
}

}  // namespace requiem
