#pragma once

// requiem/provenance_bundle.hpp — Execution provenance and signed replay bundles.
//
// DESIGN:
//   Every execution carries a ProvenanceRecord that captures the complete
//   platform state at the time of execution. This record is the basis for:
//     - Replay bundle export (reach bugreport --bundle)
//     - CI attestation artifacts
//     - Determinism proof embedding
//     - Incident forensic analysis
//
// BUNDLE CONTENTS (reach bugreport --bundle / /api/executions/{id}/bundle):
//   engine_version          — engine_semver from VersionManifest
//   hash_version            — HASH_ALGORITHM_VERSION
//   protocol_version        — PROTOCOL_FRAMING_VERSION
//   cas_version             — CAS_FORMAT_VERSION
//   prompt_lock_hash        — BLAKE3 of prompts/system.lock.md
//   dependency_snapshot_hash— BLAKE3 of artifacts/reports/deps_snapshot.json
//   migration_head          — last migration entry from migration.policy.json
//   node_id                 — WorkerIdentity.node_id
//   worker_id               — WorkerIdentity.worker_id
//   result_digest           — the execution's result_digest (determinism proof key)
//   request_digest          — the canonical request digest (input fingerprint)
//   replay_log_digest       — BLAKE3 of the stored replay log
//   bundle_checksum         — BLAKE3 of all above fields (canonical JSON, sorted keys)
//   signature               — STUB: always empty string. See SECURITY.md §signing-roadmap
//
// INVARIANTS:
//   1. bundle_checksum covers all provenance fields except itself and signature.
//   2. result_digest is immutable: the bundle never recomputes it.
//   3. Bundles are export-only: generating a bundle never modifies CAS or audit log.
//   4. prompt_lock_hash must match the current prompts/system.lock.md.
//   5. dependency_snapshot_hash must match the current deps_snapshot.json.

#include <cstdint>
#include <string>
#include <vector>

namespace requiem {
namespace provenance {

// ---------------------------------------------------------------------------
// ExecutionProvenance — full platform state at execution time
// ---------------------------------------------------------------------------
struct ExecutionProvenance {
  // Version fields
  std::string engine_version;         // e.g. "0.8.0"
  uint32_t    hash_version{0};        // HASH_ALGORITHM_VERSION
  uint32_t    protocol_version{0};    // PROTOCOL_FRAMING_VERSION
  uint32_t    cas_version{0};         // CAS_FORMAT_VERSION
  uint32_t    replay_log_version{0};  // REPLAY_LOG_VERSION
  uint32_t    audit_log_version{0};   // AUDIT_LOG_VERSION
  uint32_t    engine_abi_version{0};  // ENGINE_ABI_VERSION

  // Snapshot hashes
  std::string prompt_lock_hash;           // BLAKE3("req:" + content of system.lock.md)
  std::string dependency_snapshot_hash;   // BLAKE3("req:" + content of deps_snapshot.json)
  std::string migration_head;             // last migration entry id from migration.policy.json
  std::string policy_hash;               // BLAKE3("req:" + content of default.policy.json)

  // Node identity
  std::string node_id;
  std::string worker_id;
  std::string region_id;   // empty for single-region deployments

  // Execution identity
  std::string request_id;
  std::string request_digest;
  std::string result_digest;
  std::string replay_log_digest;

  // Timestamp (ISO-8601)
  std::string executed_at_iso;

  // Derived fields (computed at bundle creation time)
  std::string bundle_checksum;   // BLAKE3 of canonical JSON of all above fields
  std::string signature;         // empty unless enable_signed_replay_bundles flag is on

  // Serialize to compact canonical JSON (keys sorted, no whitespace).
  std::string to_json() const;

  // Compute bundle_checksum over all provenance fields.
  // Must be called after all fields are populated.
  // Returns the 64-char hex BLAKE3 checksum.
  std::string compute_checksum() const;
};

// ---------------------------------------------------------------------------
// ReplayBundle — exportable replay package
// ---------------------------------------------------------------------------
// Includes provenance + replay inputs + metrics snapshot + engine self-audit.
// Suitable for sharing with support, reproducing bugs, and determinism proofs.
// ---------------------------------------------------------------------------
struct ReplayBundle {
  // Identification
  std::string bundle_id;         // BLAKE3 of bundle_checksum + timestamp
  std::string bundle_version;    // "1.0"
  std::string created_at_iso;
  std::string incident_ticket;   // optional, filled by --incident flag

  // Core provenance record
  ExecutionProvenance provenance;

  // Replay inputs (the canonical request JSON that was executed)
  std::string request_json;

  // Metrics window (recent p50/p95/p99 snapshot at time of incident)
  std::string metrics_snapshot_json;

  // Engine self-audit output
  std::string engine_selfaudit_json;

  // Schema snapshot (current schema version identifiers)
  std::string schema_snapshot_json;

  // Determinism proof: result_digest was verified N times
  uint32_t    determinism_verifications{0};
  bool        determinism_proof_passed{false};
  std::string determinism_proof_note;

  // Serialize the full bundle to compact JSON.
  std::string to_json() const;

  // Write bundle to disk at the given path.
  // Returns true on success.
  bool write_to_file(const std::string& output_path) const;
};

// ---------------------------------------------------------------------------
// BundleBuilder — construct a ReplayBundle for an execution
// ---------------------------------------------------------------------------
// Usage:
//   BundleBuilder builder;
//   builder.set_provenance(prov);
//   builder.set_request_json(request);
//   builder.set_metrics_snapshot(metrics_json);
//   ReplayBundle bundle = builder.build();
//   bundle.write_to_file("artifacts/incidents/bundle_<id>.json");
// ---------------------------------------------------------------------------
class BundleBuilder {
 public:
  BundleBuilder& set_provenance(const ExecutionProvenance& p);
  BundleBuilder& set_request_json(const std::string& request_json);
  BundleBuilder& set_metrics_snapshot(const std::string& metrics_json);
  BundleBuilder& set_engine_selfaudit(const std::string& selfaudit_json);
  BundleBuilder& set_schema_snapshot(const std::string& schema_json);
  BundleBuilder& set_incident_ticket(const std::string& ticket_id);
  BundleBuilder& set_determinism_proof(uint32_t verifications, bool passed, const std::string& note);

  // Finalize and return the bundle.
  // Computes bundle_id, bundle_checksum, and signature scaffold.
  ReplayBundle build() const;

 private:
  ExecutionProvenance provenance_;
  std::string         request_json_;
  std::string         metrics_json_;
  std::string         selfaudit_json_;
  std::string         schema_json_;
  std::string         incident_ticket_;
  uint32_t            det_verifications_{0};
  bool                det_passed_{false};
  std::string         det_note_;
};

// ---------------------------------------------------------------------------
// Provenance helpers
// ---------------------------------------------------------------------------

// Populate an ExecutionProvenance from the current engine state.
// Reads: version constants, worker identity, snapshot file hashes.
// Never modifies any state.
ExecutionProvenance capture_current_provenance(
    const std::string& request_id,
    const std::string& request_digest,
    const std::string& result_digest,
    const std::string& replay_log_digest = "");

// Compute the BLAKE3 hash of a file's content with the "req:" domain prefix.
// Returns 64-char hex string. Returns empty string if file not readable.
std::string hash_file_content(const std::string& file_path);

// Load provenance from a saved JSON bundle.
// Returns false if the bundle_checksum does not match the recomputed value.
bool load_and_verify_bundle(const std::string& bundle_json,
                            ReplayBundle*       out_bundle,
                            std::string*        error);

}  // namespace provenance
}  // namespace requiem
