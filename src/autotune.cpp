#include "requiem/autotune.hpp"
#include "requiem/observability.hpp"

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>

namespace requiem {
namespace autotune {

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static uint64_t now_unix_ms() {
  using namespace std::chrono;
  return static_cast<uint64_t>(
      duration_cast<milliseconds>(
          system_clock::now().time_since_epoch()).count());
}

// ---------------------------------------------------------------------------
// TuningParameters::to_json
// ---------------------------------------------------------------------------

std::string TuningParameters::to_json() const {
  std::ostringstream o;
  o << "{"
    << "\"worker_thread_count\":" << worker_thread_count
    << ",\"arena_size_bytes\":" << arena_size_bytes
    << ",\"cas_batch_size\":" << cas_batch_size
    << ",\"scheduler_mode\":\"" << scheduler_mode << "\""
    << ",\"gpu_kernel_mode\":\"" << gpu_kernel_mode << "\""
    << "}";
  return o.str();
}

// ---------------------------------------------------------------------------
// to_string(ActionKind)
// ---------------------------------------------------------------------------

std::string to_string(ActionKind k) {
  switch (k) {
    case ActionKind::no_op:              return "no_op";
    case ActionKind::increase_workers:   return "increase_workers";
    case ActionKind::decrease_workers:   return "decrease_workers";
    case ActionKind::increase_arena:     return "increase_arena";
    case ActionKind::decrease_arena:     return "decrease_arena";
    case ActionKind::increase_cas_batch: return "increase_cas_batch";
    case ActionKind::decrease_cas_batch: return "decrease_cas_batch";
    case ActionKind::revert_all:         return "revert_all";
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// TelemetrySnapshot serialization helpers (inline for AutotuneEvent)
// ---------------------------------------------------------------------------

static std::string snapshot_to_json(const TelemetrySnapshot& s) {
  char buf[512];
  std::snprintf(buf, sizeof(buf),
    "{\"p50_us\":%.2f,\"p95_us\":%.2f,\"p99_us\":%.2f"
    ",\"peak_memory_bytes\":%llu,\"cas_hit_rate\":%.4f"
    ",\"contention_count\":%llu,\"avg_queue_depth\":%.2f"
    ",\"total_executions\":%llu,\"replay_divergences\":%llu}",
    s.p50_us, s.p95_us, s.p99_us,
    static_cast<unsigned long long>(s.peak_memory_bytes_max),
    s.cas_hit_rate,
    static_cast<unsigned long long>(s.contention_count),
    s.avg_queue_depth,
    static_cast<unsigned long long>(s.total_executions),
    static_cast<unsigned long long>(s.replay_divergences));
  return buf;
}

// ---------------------------------------------------------------------------
// AutotuneEvent::to_json
// ---------------------------------------------------------------------------

std::string AutotuneEvent::to_json() const {
  std::ostringstream o;
  o << "{"
    << "\"timestamp_unix_ms\":" << timestamp_unix_ms
    << ",\"action\":\"" << to_string(action) << "\""
    << ",\"rationale\":\"" << rationale << "\""
    << ",\"snapshot_before\":" << snapshot_to_json(snapshot_before)
    << ",\"params_before\":" << params_before.to_json()
    << ",\"params_after\":" << params_after.to_json()
    << ",\"applied\":" << (applied ? "true" : "false");
  if (!block_reason.empty()) {
    o << ",\"block_reason\":\"" << block_reason << "\"";
  }
  o << "}";
  return o.str();
}

// ---------------------------------------------------------------------------
// AutotunePolicy
// ---------------------------------------------------------------------------

AutotunePolicy AutotunePolicy::default_policy() {
  AutotunePolicy p;
  // Environment overrides for testing.
  if (const char* e = std::getenv("REQUIEM_AUTOTUNE_INTERVAL_S")) {
    p.tuning_interval_s = std::atof(e);
  }
  return p;
}

// ---------------------------------------------------------------------------
// TelemetrySnapshot::capture
// ---------------------------------------------------------------------------

TelemetrySnapshot capture_snapshot() {
  const EngineStats& stats = global_engine_stats();
  TelemetrySnapshot s;

  s.p50_us = stats.latency_histogram.percentile(0.50);
  s.p95_us = stats.latency_histogram.percentile(0.95);
  s.p99_us = stats.latency_histogram.percentile(0.99);

  s.peak_memory_bytes_max = stats.peak_memory_bytes_max.load(std::memory_order_relaxed);
  s.rss_bytes_last        = stats.rss_bytes_last.load(std::memory_order_relaxed);

  s.cas_hits = stats.cas_hits.load(std::memory_order_relaxed);
  s.cas_puts = stats.cas_puts.load(std::memory_order_relaxed);
  const uint64_t cas_total = s.cas_hits + s.cas_puts;
  s.cas_hit_rate = cas_total > 0
      ? static_cast<double>(s.cas_hits) / static_cast<double>(cas_total)
      : 0.0;

  s.contention_count = stats.contention_count.load(std::memory_order_relaxed);

  const uint64_t qd_count = stats.queue_depth_count.load(std::memory_order_relaxed);
  const uint64_t qd_sum   = stats.queue_depth_samples.load(std::memory_order_relaxed);
  s.avg_queue_depth = (qd_count > 0)
      ? static_cast<double>(qd_sum) / static_cast<double>(qd_count)
      : 0.0;

  s.l1_miss_rate     = stats.cache_metrics.l1_miss_rate;
  s.branch_miss_rate = stats.cache_metrics.branch_miss_rate;
  s.gpu_utilization_pct = -1.0;  // not yet wired

  s.total_executions   = stats.total_executions.load(std::memory_order_relaxed);
  s.replay_divergences = stats.replay_divergences.load(std::memory_order_relaxed);

  return s;
}

// ---------------------------------------------------------------------------
// AutotuneEngine implementation
// ---------------------------------------------------------------------------

AutotuneEngine::AutotuneEngine(AutotunePolicy policy)
    : policy_(std::move(policy)), events_(kMaxEvents) {}

AutotuneAction AutotuneEngine::evaluate(const TelemetrySnapshot& snap) const {
  AutotuneAction action;
  action.before = current_;
  action.after  = current_;

  // --- Worker thread scaling based on queue depth ---
  if (snap.avg_queue_depth > policy_.queue_depth_scale_up_threshold &&
      current_.worker_thread_count < TuningParameters::kMaxWorkerThreads) {
    uint32_t new_count = std::min(
        current_.worker_thread_count * 2,
        TuningParameters::kMaxWorkerThreads);
    action.kind = ActionKind::increase_workers;
    action.rationale = "avg_queue_depth=" + std::to_string(snap.avg_queue_depth) +
                       " > threshold=" + std::to_string(policy_.queue_depth_scale_up_threshold) +
                       "; doubling worker_thread_count from " +
                       std::to_string(current_.worker_thread_count) + " to " +
                       std::to_string(new_count);
    action.after.worker_thread_count = new_count;
    action.confidence = std::min(1.0, snap.avg_queue_depth / policy_.queue_depth_scale_up_threshold - 0.5);
    return action;
  }

  if (snap.avg_queue_depth < policy_.queue_depth_scale_down_threshold &&
      snap.p99_us < policy_.cas_latency_scale_down_us &&
      current_.worker_thread_count > TuningParameters::kMinWorkerThreads) {
    uint32_t new_count = std::max(
        current_.worker_thread_count / 2,
        TuningParameters::kMinWorkerThreads);
    action.kind = ActionKind::decrease_workers;
    action.rationale = "avg_queue_depth=" + std::to_string(snap.avg_queue_depth) +
                       " < threshold=" + std::to_string(policy_.queue_depth_scale_down_threshold) +
                       "; halving worker_thread_count to " + std::to_string(new_count);
    action.after.worker_thread_count = new_count;
    action.confidence = 0.6;
    return action;
  }

  // --- Arena size adjustment based on peak memory ---
  if (snap.peak_memory_bytes_max > 0) {
    const double ratio = static_cast<double>(snap.peak_memory_bytes_max) /
                         static_cast<double>(current_.arena_size_bytes);
    if (ratio > policy_.memory_grow_ratio &&
        current_.arena_size_bytes < TuningParameters::kMaxArenaBytes) {
      const uint64_t new_size = std::min(
          current_.arena_size_bytes * 2,
          TuningParameters::kMaxArenaBytes);
      action.kind = ActionKind::increase_arena;
      action.rationale = "peak_memory ratio=" + std::to_string(ratio) +
                         " > threshold=" + std::to_string(policy_.memory_grow_ratio) +
                         "; doubling arena_size_bytes to " + std::to_string(new_size);
      action.after.arena_size_bytes = new_size;
      action.confidence = std::min(1.0, ratio - policy_.memory_grow_ratio + 0.5);
      return action;
    }
    if (ratio < policy_.memory_shrink_ratio &&
        current_.arena_size_bytes > TuningParameters::kMinArenaBytes) {
      const uint64_t new_size = std::max(
          current_.arena_size_bytes / 2,
          TuningParameters::kMinArenaBytes);
      action.kind = ActionKind::decrease_arena;
      action.rationale = "peak_memory ratio=" + std::to_string(ratio) +
                         " < threshold=" + std::to_string(policy_.memory_shrink_ratio) +
                         "; halving arena_size_bytes to " + std::to_string(new_size);
      action.after.arena_size_bytes = new_size;
      action.confidence = 0.5;
      return action;
    }
  }

  // --- CAS batch size based on latency ---
  if (snap.p99_us > policy_.cas_latency_scale_up_us &&
      current_.cas_batch_size < TuningParameters::kMaxCasBatch) {
    const uint32_t new_batch = std::min(
        current_.cas_batch_size * 2,
        TuningParameters::kMaxCasBatch);
    action.kind = ActionKind::increase_cas_batch;
    action.rationale = "p99_us=" + std::to_string(snap.p99_us) +
                       " > threshold=" + std::to_string(policy_.cas_latency_scale_up_us) +
                       "; doubling cas_batch_size to " + std::to_string(new_batch);
    action.after.cas_batch_size = new_batch;
    action.confidence = 0.7;
    return action;
  }

  if (snap.p99_us < policy_.cas_latency_scale_down_us &&
      current_.cas_batch_size > TuningParameters::kMinCasBatch) {
    const uint32_t new_batch = std::max(
        current_.cas_batch_size / 2,
        TuningParameters::kMinCasBatch);
    action.kind = ActionKind::decrease_cas_batch;
    action.rationale = "p99_us=" + std::to_string(snap.p99_us) +
                       " < threshold=" + std::to_string(policy_.cas_latency_scale_down_us) +
                       "; halving cas_batch_size to " + std::to_string(new_batch);
    action.after.cas_batch_size = new_batch;
    action.confidence = 0.4;
    return action;
  }

  // No adjustment warranted.
  action.kind = ActionKind::no_op;
  action.rationale = "all metrics within thresholds";
  action.confidence = 1.0;
  return action;
}

bool AutotuneEngine::apply(const TuningParameters& proposed,
                           std::string& block_reason) {
  // GUARDRAIL: hash semantics are immutable.
  // scheduler_mode is never changed by auto-tuning (changes request_digest).
  if (proposed.scheduler_mode != current_.scheduler_mode) {
    block_reason = "GUARDRAIL: scheduler_mode is immutable by auto-tuner";
    return false;
  }

  // GUARDRAIL: worker threads must stay in bounds.
  if (proposed.worker_thread_count < TuningParameters::kMinWorkerThreads ||
      proposed.worker_thread_count > TuningParameters::kMaxWorkerThreads) {
    block_reason = "GUARDRAIL: worker_thread_count out of bounds";
    return false;
  }

  // GUARDRAIL: arena bounds.
  if (proposed.arena_size_bytes < TuningParameters::kMinArenaBytes ||
      proposed.arena_size_bytes > TuningParameters::kMaxArenaBytes) {
    block_reason = "GUARDRAIL: arena_size_bytes out of bounds";
    return false;
  }

  // GUARDRAIL: CAS batch bounds.
  if (proposed.cas_batch_size < TuningParameters::kMinCasBatch ||
      proposed.cas_batch_size > TuningParameters::kMaxCasBatch) {
    block_reason = "GUARDRAIL: cas_batch_size out of bounds";
    return false;
  }

  current_ = proposed;
  return true;
}

AutotuneEvent AutotuneEngine::tick() {
  std::lock_guard<std::mutex> lk(mu_);

  const uint64_t now_ms = now_unix_ms();
  const double interval_ms = policy_.tuning_interval_s * 1000.0;

  AutotuneEvent ev;
  ev.timestamp_unix_ms = now_ms;
  ev.params_before     = current_;

  // Rate limiting: skip if too soon since last tick.
  if (last_tick_unix_ms_ > 0 &&
      static_cast<double>(now_ms - last_tick_unix_ms_) < interval_ms) {
    ev.action  = ActionKind::no_op;
    ev.rationale = "rate_limited: interval not elapsed";
    ev.applied = false;
    ev.params_after = current_;
    return ev;
  }

  // Capture telemetry (outside lock on EngineStats — those are atomics).
  const TelemetrySnapshot snap = capture_snapshot();
  ev.snapshot_before = snap;

  // Detect performance regression after last tune and revert if needed.
  if (last_tick_unix_ms_ > 0 && last_p99_us_ > 0.0 && snap.p99_us > 0.0) {
    if (snap.p99_us > last_p99_us_ * policy_.revert_if_p99_ratio) {
      ev.action    = ActionKind::revert_all;
      ev.rationale = "p99 latency increased by " +
                     std::to_string(snap.p99_us / last_p99_us_) +
                     "x since last tune; reverting to baseline";
      ev.params_after = baseline_;
      std::string block;
      ev.applied = apply(baseline_, block);
      ev.block_reason = block;
      last_tick_unix_ms_ = now_ms;
      last_p99_us_       = snap.p99_us;
      // Store event.
      events_[event_head_ % kMaxEvents] = ev;
      ++event_head_;
      event_count_.fetch_add(1, std::memory_order_relaxed);
      emit_autotune_event(ev);
      return ev;
    }
  }

  // Evaluate policy.
  const AutotuneAction proposal = evaluate(snap);
  ev.action   = proposal.kind;
  ev.rationale = proposal.rationale;
  ev.params_after = proposal.after;

  if (proposal.kind != ActionKind::no_op) {
    std::string block;
    ev.applied = apply(proposal.after, block);
    ev.block_reason = block;
  } else {
    ev.applied = true;  // no_op is always "applied"
  }

  last_tick_unix_ms_ = now_ms;
  last_p99_us_       = snap.p99_us;

  // Store in ring buffer.
  events_[event_head_ % kMaxEvents] = ev;
  ++event_head_;
  event_count_.fetch_add(1, std::memory_order_relaxed);

  // Emit to event stream.
  emit_autotune_event(ev);

  return ev;
}

TuningParameters AutotuneEngine::current_params() const {
  std::lock_guard<std::mutex> lk(mu_);
  return current_;
}

AutotuneEvent AutotuneEngine::revert_to_baseline() {
  std::lock_guard<std::mutex> lk(mu_);

  AutotuneEvent ev;
  ev.timestamp_unix_ms = now_unix_ms();
  ev.action            = ActionKind::revert_all;
  ev.rationale         = "manual revert to baseline parameters";
  ev.params_before     = current_;
  ev.params_after      = baseline_;
  ev.snapshot_before   = capture_snapshot();

  std::string block;
  ev.applied      = apply(baseline_, block);
  ev.block_reason = block;

  events_[event_head_ % kMaxEvents] = ev;
  ++event_head_;
  event_count_.fetch_add(1, std::memory_order_relaxed);

  emit_autotune_event(ev);
  return ev;
}

std::vector<AutotuneEvent> AutotuneEngine::recent_events() const {
  std::lock_guard<std::mutex> lk(mu_);
  const size_t total = event_count_.load(std::memory_order_relaxed);
  const size_t n = std::min(total, kMaxEvents);
  std::vector<AutotuneEvent> result;
  result.reserve(n);
  // Events stored in ring: oldest to newest.
  const size_t start = (event_head_ >= kMaxEvents) ? event_head_ - kMaxEvents : 0;
  for (size_t i = start; i < event_head_; ++i) {
    result.push_back(events_[i % kMaxEvents]);
  }
  return result;
}

uint64_t AutotuneEngine::event_count() const {
  return event_count_.load(std::memory_order_relaxed);
}

std::string AutotuneEngine::to_json() const {
  std::lock_guard<std::mutex> lk(mu_);
  std::ostringstream o;
  o << "{"
    << "\"current\":" << current_.to_json()
    << ",\"baseline\":" << baseline_.to_json()
    << ",\"event_count\":" << event_count_.load(std::memory_order_relaxed)
    << ",\"policy\":{"
    << "\"tuning_interval_s\":" << policy_.tuning_interval_s
    << ",\"queue_depth_scale_up_threshold\":" << policy_.queue_depth_scale_up_threshold
    << ",\"memory_grow_ratio\":" << policy_.memory_grow_ratio
    << ",\"cas_latency_scale_up_us\":" << policy_.cas_latency_scale_up_us
    << ",\"revert_if_p99_ratio\":" << policy_.revert_if_p99_ratio
    << "}"
    << "}";
  return o.str();
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

AutotuneEngine& global_autotune_engine() {
  static AutotuneEngine instance;
  return instance;
}

// ---------------------------------------------------------------------------
// emit_autotune_event
// ---------------------------------------------------------------------------

void emit_autotune_event(const AutotuneEvent& ev) {
  // Emit to REQUIEM_AUTOTUNE_LOG if configured.
  const char* log_path = std::getenv("REQUIEM_AUTOTUNE_LOG");
  if (!log_path || !log_path[0]) return;

  std::ofstream ofs(log_path, std::ios::app);
  if (!ofs) return;
  ofs << ev.to_json() << "\n";
}

}  // namespace autotune
}  // namespace requiem
