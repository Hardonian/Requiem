#pragma once

// requiem/diagnostics.hpp — AI-assisted root cause diagnostics engine.
//
// DESIGN:
//   When something goes wrong, the diagnostics engine explains WHY by
//   analyzing the available evidence: engine state, metrics, version contracts,
//   dependency snapshots, and migration history.
//
// INVARIANTS (absolute, must not be broken):
//   - Diagnostics are READ-ONLY. analyze_failure() never modifies state.
//   - Diagnostics never GUESS without evidence. Every finding is annotated
//     with its evidence source.
//   - Diagnostics never AUTOCORRECT silently. Suggestions are explicit and
//     require human confirmation before acting.
//   - No LLM calls in this module. Analysis is deterministic and rule-based.
//
// FAILURE CATEGORIES (mutually exclusive, exhaustive):
//   determinism_drift    — result digests diverge across re-executions
//   migration_conflict   — schema/version incompatibility between components
//   dependency_drift     — dependency snapshot hash mismatch
//   resource_exhaustion  — OOM, CPU quota, FD limit hit
//   cluster_mismatch     — engine_version/hash_version/protocol_version mismatch
//   cas_corruption       — CAS object hash mismatch on read
//   unknown              — no pattern matched; list all collected evidence
//
// SURFACES:
//   CLI: reach doctor --analyze [--context <json>]
//   API: GET /api/engine/analyze
//
// EXTENSION_POINT: ml_classification
//   Current: rule-based pattern matching on DiagnosticContext fields.
//   Upgrade: train a lightweight classifier on historical diagnostic reports.
//   Interface: FailureCategory classify(const DiagnosticContext&) stays stable.

#include <cstdint>
#include <string>
#include <vector>

namespace requiem {
namespace diagnostics {

// ---------------------------------------------------------------------------
// FailureCategory — mutually exclusive root cause classification
// ---------------------------------------------------------------------------
enum class FailureCategory {
  determinism_drift,    // replay hash mismatch, non-deterministic output
  migration_conflict,   // schema version mismatch, migration not applied
  dependency_drift,     // dep snapshot hash changed unexpectedly
  resource_exhaustion,  // OOM, timeout, FD quota
  cluster_mismatch,     // engine_version/hash_version/protocol_version disagree
  cas_corruption,       // CAS read returned corrupt data
  unknown,              // no matching pattern; evidence listed
};

std::string to_string(FailureCategory cat);

// ---------------------------------------------------------------------------
// DiagnosticContext — evidence bundle captured at point of failure
// ---------------------------------------------------------------------------
// Populated by the engine on error. Passed to analyze_failure().
// ALL fields are optional — analyze() degrades gracefully with partial data.
struct DiagnosticContext {
  // Version identifiers (from version.hpp)
  std::string engine_semver;
  uint32_t    engine_abi_version{0};
  uint32_t    hash_algorithm_version{0};
  uint32_t    cas_format_version{0};
  uint32_t    protocol_framing_version{0};

  // Determinism contract
  std::string determinism_contract_hash;  // SHA-256 of determinism.contract.json
  std::string dep_snapshot_hash;          // SHA-256 of deps_snapshot.json
  std::string migration_head;             // last applied migration ID

  // Recent metrics window (captured at time of failure)
  double   p99_latency_us{0.0};
  uint64_t peak_memory_bytes{0};
  double   cas_hit_rate{0.0};
  uint64_t replay_divergences{0};
  uint64_t contention_count{0};

  // Cluster state at time of failure
  uint32_t    cluster_worker_count{0};
  bool        cluster_mode{false};
  std::string local_engine_version;
  std::vector<std::string> observed_engine_versions;  // across workers
  std::vector<std::string> observed_hash_versions;    // across workers

  // Error details
  std::string error_code;
  std::string error_detail;

  // CAS integrity
  uint64_t cas_objects_checked{0};
  uint64_t cas_objects_corrupt{0};

  // Execution provenance
  std::string request_digest;
  std::string result_digest;
  std::string execution_id;
  std::string tenant_id;

  // Build metadata (from build environment)
  std::string build_timestamp;
  std::string git_commit_hash;  // if available
};

// Build a DiagnosticContext from the current engine global state.
DiagnosticContext capture_context(const std::string& error_code = "",
                                  const std::string& error_detail = "");

// ---------------------------------------------------------------------------
// Evidence — a single piece of diagnostic evidence
// ---------------------------------------------------------------------------
struct Evidence {
  std::string source;    // e.g. "engine_stats.replay_divergences", "cluster.workers"
  std::string fact;      // what was observed
  std::string relevance; // why it matters to the diagnosis
};

// ---------------------------------------------------------------------------
// Suggestion — a concrete remediation action
// ---------------------------------------------------------------------------
struct Suggestion {
  std::string action;      // e.g. "replay_verification", "hash_contract_check"
  std::string command;     // e.g. "requiem doctor --verify-determinism"
  std::string rationale;   // why this action addresses the root cause
  bool        safe{true};  // false if action has side effects (e.g. rollback)
};

// Known suggestion actions:
//   replay_verification   — re-run execution and compare digests
//   hash_contract_check   — verify determinism.contract.json is up-to-date
//   dependency_diff       — diff current dep snapshot against baseline
//   migration_rollback    — roll back to last known-good migration state
//   cas_integrity_check   — run requiem cas verify
//   cluster_restart       — restart cluster workers with matching versions
//   resource_increase     — increase memory or FD limits
//   collect_more_evidence — insufficient data to diagnose; capture more logs

// ---------------------------------------------------------------------------
// DiagnosticReport — output of analyze_failure()
// ---------------------------------------------------------------------------
struct DiagnosticReport {
  bool               ok{false};           // true if analysis succeeded (not if engine is OK)
  FailureCategory    category{FailureCategory::unknown};
  std::string        summary;             // one-line human-readable summary
  std::vector<Evidence>   evidence;       // supporting evidence
  std::vector<Suggestion> suggestions;    // ordered by priority
  DiagnosticContext  context;             // input context (echo for auditability)
  uint64_t           analysis_duration_us{0};  // time taken to analyze

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// analyze_failure — core diagnostic entry point
// ---------------------------------------------------------------------------
// INVARIANT: never throws. On internal error, returns a report with
//   category=unknown and error details in summary.
// INVARIANT: never modifies any state. Purely analytical.
// INVARIANT: every finding cites at least one Evidence source.
DiagnosticReport analyze_failure(const DiagnosticContext& ctx);

// Convenience: capture current context and analyze immediately.
DiagnosticReport analyze_current_state();

}  // namespace diagnostics
}  // namespace requiem
