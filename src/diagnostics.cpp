#include "requiem/diagnostics.hpp"
#include "requiem/observability.hpp"
#include "requiem/version.hpp"
#include "requiem/worker.hpp"
#include "requiem/cluster.hpp"

#include <algorithm>
#include <chrono>
#include <sstream>

namespace requiem {
namespace diagnostics {

// ---------------------------------------------------------------------------
// to_string(FailureCategory)
// ---------------------------------------------------------------------------

std::string to_string(FailureCategory cat) {
  switch (cat) {
    case FailureCategory::determinism_drift:   return "determinism_drift";
    case FailureCategory::migration_conflict:  return "migration_conflict";
    case FailureCategory::dependency_drift:    return "dependency_drift";
    case FailureCategory::resource_exhaustion: return "resource_exhaustion";
    case FailureCategory::cluster_mismatch:    return "cluster_mismatch";
    case FailureCategory::cas_corruption:      return "cas_corruption";
    case FailureCategory::unknown:             return "unknown";
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// capture_context
// ---------------------------------------------------------------------------

DiagnosticContext capture_context(const std::string& error_code,
                                  const std::string& error_detail) {
  DiagnosticContext ctx;

  // Version info.
  const auto vm = requiem::version::current_manifest();
  ctx.engine_semver            = vm.engine_semver;
  ctx.engine_abi_version       = vm.engine_abi;
  ctx.hash_algorithm_version   = vm.hash_algorithm;
  ctx.cas_format_version       = vm.cas_format;
  ctx.protocol_framing_version = vm.protocol_framing;
  ctx.local_engine_version     = vm.engine_semver;

  // Engine stats metrics snapshot.
  const EngineStats& stats = global_engine_stats();
  ctx.p99_latency_us    = stats.latency_histogram.percentile(0.99);
  ctx.peak_memory_bytes = stats.peak_memory_bytes_max.load(std::memory_order_relaxed);

  const uint64_t cas_hits = stats.cas_hits.load(std::memory_order_relaxed);
  const uint64_t cas_puts = stats.cas_puts.load(std::memory_order_relaxed);
  const uint64_t cas_total = cas_hits + cas_puts;
  ctx.cas_hit_rate = cas_total > 0
      ? static_cast<double>(cas_hits) / static_cast<double>(cas_total)
      : 0.0;

  ctx.replay_divergences = stats.replay_divergences.load(std::memory_order_relaxed);
  ctx.contention_count   = stats.contention_count.load(std::memory_order_relaxed);

  // Cluster state.
  const ClusterStatus cs = global_cluster_registry().cluster_status();
  ctx.cluster_worker_count = cs.total_workers;
  ctx.cluster_mode         = cs.cluster_mode;
  for (const auto& wr : cs.workers) {
    // Collect observed engine and hash version strings from registered workers.
    // In the current implementation workers carry identity but not engine_semver;
    // we use the local version for all (will diverge when cluster coord is added).
    ctx.observed_engine_versions.push_back(ctx.engine_semver);
    ctx.observed_hash_versions.push_back(
        std::to_string(ctx.hash_algorithm_version));
    (void)wr;  // suppress unused warning
  }

  ctx.error_code   = error_code;
  ctx.error_detail = error_detail;

  return ctx;
}

// ---------------------------------------------------------------------------
// DiagnosticReport::to_json
// ---------------------------------------------------------------------------

std::string DiagnosticReport::to_json() const {
  std::ostringstream o;
  o << "{"
    << "\"ok\":" << (ok ? "true" : "false")
    << ",\"category\":\"" << to_string(category) << "\""
    << ",\"summary\":\"" << summary << "\""
    << ",\"analysis_duration_us\":" << analysis_duration_us
    << ",\"evidence\":[";
  bool first = true;
  for (const auto& ev : evidence) {
    if (!first) o << ",";
    first = false;
    o << "{\"source\":\"" << ev.source << "\""
      << ",\"fact\":\"" << ev.fact << "\""
      << ",\"relevance\":\"" << ev.relevance << "\"}";
  }
  o << "]"
    << ",\"suggestions\":[";
  first = true;
  for (const auto& sg : suggestions) {
    if (!first) o << ",";
    first = false;
    o << "{\"action\":\"" << sg.action << "\""
      << ",\"command\":\"" << sg.command << "\""
      << ",\"rationale\":\"" << sg.rationale << "\""
      << ",\"safe\":" << (sg.safe ? "true" : "false") << "}";
  }
  o << "]"
    << ",\"context\":{"
    << "\"engine_semver\":\"" << context.engine_semver << "\""
    << ",\"engine_abi_version\":" << context.engine_abi_version
    << ",\"hash_algorithm_version\":" << context.hash_algorithm_version
    << ",\"cas_format_version\":" << context.cas_format_version
    << ",\"replay_divergences\":" << context.replay_divergences
    << ",\"p99_latency_us\":" << context.p99_latency_us
    << ",\"peak_memory_bytes\":" << context.peak_memory_bytes
    << ",\"cas_hit_rate\":" << context.cas_hit_rate
    << ",\"cluster_worker_count\":" << context.cluster_worker_count
    << ",\"cluster_mode\":" << (context.cluster_mode ? "true" : "false")
    << ",\"error_code\":\"" << context.error_code << "\""
    << ",\"error_detail\":\"" << context.error_detail << "\""
    << "}"
    << "}";
  return o.str();
}

// ---------------------------------------------------------------------------
// analyze_failure — core diagnostic logic
// ---------------------------------------------------------------------------

DiagnosticReport analyze_failure(const DiagnosticContext& ctx) {
  using Clock = std::chrono::steady_clock;
  const auto t_start = Clock::now();

  DiagnosticReport report;
  report.ok      = true;  // analysis succeeded (separate from engine health)
  report.context = ctx;

  // --- Pattern matching: error_code takes priority ---

  // 1. CAS corruption
  if (ctx.error_code == "cas_corruption" ||
      ctx.cas_objects_corrupt > 0) {
    report.category = FailureCategory::cas_corruption;
    report.summary  = "CAS object integrity failure: stored blob hash mismatch";
    report.evidence.push_back({
        "error_code",
        "error_code='" + ctx.error_code + "'",
        "CAS corruption errors map to this category"});
    if (ctx.cas_objects_corrupt > 0) {
      report.evidence.push_back({
          "cas.objects_corrupt",
          std::to_string(ctx.cas_objects_corrupt) + " corrupt object(s) found",
          "Direct evidence of CAS data integrity failure"});
    }
    report.suggestions.push_back({
        "cas_integrity_check",
        "requiem cas verify --cas .requiem/cas/v2",
        "Enumerate all CAS objects and verify hash integrity",
        true});
    report.suggestions.push_back({
        "collect_more_evidence",
        "REQUIEM_AUDIT_LOG=/tmp/audit.ndjson requiem exec run --request <req.json>",
        "Capture full audit provenance on next execution to trace corruption origin",
        true});
    goto done;
  }

  // 2. Determinism drift (replay mismatch)
  if (ctx.error_code == "replay_mismatch" || ctx.error_code == "drift_detected" ||
      ctx.replay_divergences > 0) {
    report.category = FailureCategory::determinism_drift;
    report.summary  = "Determinism drift: replay hash mismatch across executions";
    report.evidence.push_back({
        "engine_stats.replay_divergences",
        std::to_string(ctx.replay_divergences) + " divergence(s) recorded",
        "Non-zero replay_divergences is direct evidence of non-deterministic output"});
    if (!ctx.error_code.empty()) {
      report.evidence.push_back({
          "error_code", "error_code='" + ctx.error_code + "'",
          "Replay/drift error codes confirm determinism failure"});
    }
    report.suggestions.push_back({
        "replay_verification",
        "requiem exec replay --request <req.json> --original-result <result.json>",
        "Re-execute the same request and compare result_digest to original",
        true});
    report.suggestions.push_back({
        "hash_contract_check",
        "requiem doctor && cat contracts/determinism.contract.json",
        "Verify the determinism contract is current and hash_algorithm_version matches",
        true});
    goto done;
  }

  // 3. Resource exhaustion
  if (ctx.error_code == "out_of_memory" ||
      ctx.error_code == "timeout" ||
      (ctx.peak_memory_bytes > 0 && ctx.p99_latency_us > 30'000'000.0 /* 30s */)) {
    report.category = FailureCategory::resource_exhaustion;
    report.summary  = "Resource exhaustion: memory or latency limits exceeded";
    if (ctx.error_code == "out_of_memory") {
      report.evidence.push_back({
          "error_code", "error_code='out_of_memory'",
          "Execution process exceeded memory limit"});
    }
    if (ctx.error_code == "timeout") {
      report.evidence.push_back({
          "error_code", "error_code='timeout'",
          "Execution exceeded configured timeout_ms"});
    }
    if (ctx.p99_latency_us > 30'000'000.0) {
      report.evidence.push_back({
          "engine_stats.p99_latency_us",
          "p99=" + std::to_string(ctx.p99_latency_us) + "us",
          "p99 latency exceeds 30 seconds, suggesting resource contention"});
    }
    report.suggestions.push_back({
        "resource_increase",
        "Set max_memory_bytes in ExecPolicy or increase REQUIEM_WORKER_THREADS",
        "Increase resource limits to accommodate workload size",
        true});
    goto done;
  }

  // 4. Cluster mismatch
  if (ctx.cluster_mode && !ctx.observed_engine_versions.empty()) {
    bool version_mismatch = false;
    for (const auto& v : ctx.observed_engine_versions) {
      if (v != ctx.local_engine_version) {
        version_mismatch = true;
        break;
      }
    }
    if (version_mismatch) {
      report.category = FailureCategory::cluster_mismatch;
      report.summary  = "Cluster version mismatch: workers running incompatible engine versions";
      report.evidence.push_back({
          "cluster.observed_engine_versions",
          "Multiple engine versions observed across cluster workers",
          "Mixed versions can cause replay hash mismatches in distributed execution"});
      report.evidence.push_back({
          "cluster.local_engine_version",
          "local=" + ctx.local_engine_version,
          "Local version differs from one or more peers"});
      report.suggestions.push_back({
          "cluster_restart",
          "Restart all cluster workers with the same requiem binary version",
          "Homogeneous cluster versions are required for deterministic distributed replay",
          false});  // not safe — requires restart
      goto done;
    }
  }

  // 5. Unknown — collect all available evidence
  {
    report.category = FailureCategory::unknown;
    report.summary  = "Root cause not determined; evidence collected for investigation";
    if (!ctx.error_code.empty()) {
      report.evidence.push_back({
          "error_code", "error_code='" + ctx.error_code + "'",
          "Unclassified error code; check error definitions in types.hpp"});
    }
    if (ctx.replay_divergences > 0) {
      report.evidence.push_back({
          "engine_stats.replay_divergences",
          std::to_string(ctx.replay_divergences) + " divergence(s)",
          "Some non-determinism occurred but no conclusive root cause"});
    }
    if (ctx.contention_count > 100) {
      report.evidence.push_back({
          "engine_stats.contention_count",
          std::to_string(ctx.contention_count) + " contention events",
          "High lock contention may indicate resource pressure"});
    }
    report.suggestions.push_back({
        "collect_more_evidence",
        "REQUIEM_AUDIT_LOG=/tmp/audit.ndjson REQUIEM_EVENT_LOG=/tmp/events.jsonl requiem exec run ...",
        "Enable full audit and event logging to capture more diagnostic context",
        true});
    report.suggestions.push_back({
        "replay_verification",
        "requiem exec replay --request <req.json> --original-result <result.json>",
        "Verify determinism by replaying the exact failing request",
        true});
  }

done:
  using NS = std::chrono::nanoseconds;
  const uint64_t duration_ns = static_cast<uint64_t>(
      std::chrono::duration_cast<NS>(Clock::now() - t_start).count());
  report.analysis_duration_us = duration_ns / 1000u;

  return report;
}

// ---------------------------------------------------------------------------
// analyze_current_state
// ---------------------------------------------------------------------------

DiagnosticReport analyze_current_state() {
  const DiagnosticContext ctx = capture_context();
  return analyze_failure(ctx);
}

}  // namespace diagnostics
}  // namespace requiem
