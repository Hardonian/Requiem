#pragma once

// requiem/autotune.hpp — Performance auto-tuning feedback loop.
//
// DESIGN:
//   The auto-tuning module observes real workload telemetry and proposes
//   parameter adjustments to improve engine throughput and resource efficiency.
//
//   CRITICALLY: auto-tuning MUST NOT:
//     - Change hash semantics.
//     - Alter any observable output (stdout, stderr, digests).
//     - Modify CAS content or replay traces.
//     - Operate silently — every adjustment is logged to engine.autotune.events.
//     - Be irreversible — all adjustments can be reverted to default.
//
// PARAMETERS SUBJECT TO TUNING:
//   worker_thread_count  — number of worker threads (based on queue depth)
//   arena_size_bytes     — per-execution arena allocation size (based on peak memory)
//   cas_batch_size       — CAS batch write count (based on CAS latency percentiles)
//   scheduler_mode       — "repro" vs "turbo" (based on throughput delta)
//
// TELEMETRY INPUTS:
//   p50/p95/p99 latency (ms)
//   peak_memory_bytes
//   CAS hit rate
//   contention_count
//   queue_depth (avg)
//   cache_miss_rate (if PMU available)
//   branch_miss_rate (if PMU available)
//   GPU utilization (if applicable — stub for now)
//
// FEEDBACK LOOP:
//   1. Observe: collect telemetry snapshot from EngineStats.
//   2. Evaluate: compare against policy thresholds.
//   3. Propose: compute adjusted parameters.
//   4. Apply: update engine config (guarded by guardrails).
//   5. Log: emit AutotuneEvent to structured event stream.
//   6. Revert: if performance degrades after adjustment, revert automatically.
//
// GUARDRAILS:
//   - Adjustments are bounded (min/max per parameter).
//   - Rate-limited: at most one adjustment per tuning_interval_s.
//   - Hash-sensitive parameters are immutable (hash_version, algorithm).
//   - GPU kernel selection: only safe variants permitted (no UB kernels).
//
// EXTENSION_POINT: ml_tuning_policy
//   Current: rule-based thresholds (heuristic policy).
//   Upgrade: replace evaluate() with a lightweight ML model trained on
//   historical workloads. Policy interface is stable.

#include <atomic>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace requiem {

// Forward declaration.
struct ExecutionMetrics;
class EngineStats;

namespace autotune {

// ---------------------------------------------------------------------------
// TelemetrySnapshot — point-in-time workload metrics for policy evaluation
// ---------------------------------------------------------------------------
struct TelemetrySnapshot {
  // Latency percentiles (microseconds)
  double p50_us{0.0};
  double p95_us{0.0};
  double p99_us{0.0};

  // Memory
  uint64_t peak_memory_bytes_max{0};
  uint64_t rss_bytes_last{0};

  // CAS
  uint64_t cas_hits{0};
  uint64_t cas_puts{0};
  double   cas_hit_rate{0.0};   // hits / (hits + puts)

  // Concurrency
  uint64_t contention_count{0};
  double   avg_queue_depth{0.0};

  // Hardware PMU (optional, -1.0 = not measured)
  double l1_miss_rate{-1.0};
  double branch_miss_rate{-1.0};

  // GPU (stub, -1.0 = not applicable)
  double gpu_utilization_pct{-1.0};

  // Execution volume
  uint64_t total_executions{0};
  uint64_t replay_divergences{0};
};

// Capture a snapshot from the global EngineStats.
TelemetrySnapshot capture_snapshot();

// ---------------------------------------------------------------------------
// TuningParameters — current and proposed parameter set
// ---------------------------------------------------------------------------
struct TuningParameters {
  // Worker threads: target concurrent execution slots.
  // Guardrails: [1, 256]. Default: 4.
  uint32_t worker_thread_count{4};
  static constexpr uint32_t kMinWorkerThreads = 1;
  static constexpr uint32_t kMaxWorkerThreads = 256;

  // Arena size: per-execution memory arena pre-allocation (bytes).
  // Guardrails: [64KB, 256MB]. Default: 1MB.
  uint64_t arena_size_bytes{1u << 20};
  static constexpr uint64_t kMinArenaBytes = 64u * 1024u;
  static constexpr uint64_t kMaxArenaBytes = 256u * 1024u * 1024u;

  // CAS batch size: number of CAS puts per batch write.
  // Guardrails: [1, 1024]. Default: 16.
  uint32_t cas_batch_size{16};
  static constexpr uint32_t kMinCasBatch = 1;
  static constexpr uint32_t kMaxCasBatch = 1024;

  // Scheduler mode: "repro" (single-FIFO) or "turbo" (worker pool).
  // INVARIANT: changing scheduler_mode changes request_digest — NOT DONE silently.
  // Auto-tuning does NOT change scheduler_mode; this field is read-only for the tuner.
  std::string scheduler_mode{"turbo"};

  // GPU kernel selection: stub. "default" is the only safe value.
  std::string gpu_kernel_mode{"default"};

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// AutotuneAction — proposed adjustment with rationale
// ---------------------------------------------------------------------------
enum class ActionKind {
  no_op,                // No change warranted
  increase_workers,     // queue_depth > threshold → add worker threads
  decrease_workers,     // queue_depth low + latency low → reduce workers
  increase_arena,       // peak_memory close to arena limit → grow arena
  decrease_arena,       // peak_memory consistently < 50% arena → shrink arena
  increase_cas_batch,   // CAS latency high + hit_rate low → larger batches
  decrease_cas_batch,   // CAS latency good → smaller batches (memory pressure)
  revert_all,           // Performance degraded post-tune → full revert
};

std::string to_string(ActionKind k);

struct AutotuneAction {
  ActionKind       kind{ActionKind::no_op};
  std::string      rationale;      // human-readable explanation
  TuningParameters before;         // parameters before change
  TuningParameters after;          // proposed parameters
  double           confidence{0.0}; // [0.0, 1.0] — how certain the tuner is
};

// ---------------------------------------------------------------------------
// AutotuneEvent — structured event for engine.autotune.events stream
// ---------------------------------------------------------------------------
struct AutotuneEvent {
  uint64_t    timestamp_unix_ms{0};
  ActionKind  action{ActionKind::no_op};
  std::string rationale;
  TelemetrySnapshot snapshot_before;
  TuningParameters  params_before;
  TuningParameters  params_after;
  bool        applied{false};    // false if guardrail blocked the adjustment
  std::string block_reason;      // non-empty if !applied

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// AutotunePolicy — rule-based threshold configuration
// ---------------------------------------------------------------------------
struct AutotunePolicy {
  // Queue depth: add workers when avg queue depth exceeds this value.
  double queue_depth_scale_up_threshold{2.0};
  // Queue depth: remove workers when avg queue depth below this value.
  double queue_depth_scale_down_threshold{0.5};

  // Memory: grow arena when peak_memory_bytes_max > arena * this ratio.
  double memory_grow_ratio{0.8};
  // Memory: shrink arena when peak_memory_bytes_max < arena * this ratio.
  double memory_shrink_ratio{0.3};

  // CAS: increase batch size when p99 latency exceeds this threshold (us).
  double cas_latency_scale_up_us{10000.0};   // 10ms
  // CAS: decrease batch size when p99 latency below this threshold (us).
  double cas_latency_scale_down_us{1000.0};  // 1ms

  // Rate limiting: minimum seconds between adjustments.
  double tuning_interval_s{30.0};

  // Revert: if p99 latency increases by > this factor after tuning, revert.
  double revert_if_p99_ratio{1.5};

  static AutotunePolicy default_policy();
};

// ---------------------------------------------------------------------------
// AutotuneEngine — core feedback loop controller
// ---------------------------------------------------------------------------
// Thread-safe. Singleton via global_autotune_engine().
//
// Usage:
//   global_autotune_engine().tick();  // called periodically (e.g., every 30s)
//   global_autotune_engine().current_params();  // read current settings
//   global_autotune_engine().recent_events();   // read event log
class AutotuneEngine {
 public:
  explicit AutotuneEngine(AutotunePolicy policy = AutotunePolicy::default_policy());

  // Evaluate telemetry and potentially apply one adjustment.
  // Returns the event produced (no_op if no adjustment warranted).
  // Thread-safe.
  AutotuneEvent tick();

  // Read current tuning parameters. Thread-safe.
  TuningParameters current_params() const;

  // Forcibly revert to baseline parameters (emergency revert).
  // Logs a revert_all event.
  AutotuneEvent revert_to_baseline();

  // Recent autotune events (last kMaxEvents). Thread-safe.
  static constexpr size_t kMaxEvents = 256;
  std::vector<AutotuneEvent> recent_events() const;

  // Event count since startup.
  uint64_t event_count() const;

  // Serialize current state to JSON (for /api/engine/autotune endpoint).
  std::string to_json() const;

 private:
  // Evaluate current telemetry against policy and return an action proposal.
  AutotuneAction evaluate(const TelemetrySnapshot& snap) const;

  // Apply proposed parameters (with guardrails). Returns false if blocked.
  bool apply(const TuningParameters& proposed, std::string& block_reason);

  mutable std::mutex mu_;
  AutotunePolicy     policy_;
  TuningParameters   current_;
  TuningParameters   baseline_;

  // Circular event buffer.
  std::vector<AutotuneEvent> events_;
  size_t event_head_{0};
  std::atomic<uint64_t> event_count_{0};

  uint64_t last_tick_unix_ms_{0};
  double   last_p99_us_{0.0};  // for revert detection
};

// Global singleton.
AutotuneEngine& global_autotune_engine();

// Emit an autotune event to the structured event stream.
// In OSS mode: appends to REQUIEM_AUTOTUNE_LOG if set.
// In Enterprise mode: forwards to configured exporter.
void emit_autotune_event(const AutotuneEvent& ev);

}  // namespace autotune
}  // namespace requiem
