#pragma once

// requiem/audit.hpp — Immutable, append-only audit log for execution provenance.
//
// DESIGN INVARIANTS (must not be broken):
//   1. APPEND-ONLY: entries are never modified or deleted.
//   2. SEQUENTIAL: each entry carries a monotonically increasing sequence number.
//   3. STRUCTURED: every entry is a single-line JSON object (NDJSON format).
//   4. FAIL-SAFE: write failures are non-fatal to the execution; the execution
//      result is authoritative. Audit failures increment a separate counter.
//   5. PROVENANCE: every entry records engine_version + hash_version + replay_flag.
//
// EXTENSION_POINT: governance_enhancements
//   Current: file-backed NDJSON with fsync on each write.
//   Upgrade path for enterprise:
//     a) Merkle-chained audit log: each entry hashes the previous entry's
//        digest to form a tamper-evident chain (like a certificate transparency log).
//     b) Remote write: forward entries to an immutable log service (e.g.,
//        Amazon QLDB, Google Cloud Spanner, or a Kafka compacted topic).
//     c) Distributed replay comparison: store replay results from multiple nodes
//        and compare digests to detect non-determinism at scale.
//   Invariant: the on-disk format (AUDIT_LOG_VERSION) must be bumped before
//   any structural change to ProvenanceRecord fields.
//   Invariant: NEVER re-use a sequence number, even after log rotation.

#include <cstdint>
#include <string>

namespace requiem {

// ---------------------------------------------------------------------------
// ProvenanceRecord — per-execution provenance metadata
// ---------------------------------------------------------------------------
// Stored in the audit log for every execution. Provides:
//   - Which engine version produced this result.
//   - Which hash algorithm was used (hash_version).
//   - Whether replay verification was performed and passed.
//   - Timing and sizing metadata for SRE/audit queries.
//
// EXTENSION_POINT: governance_enhancements
//   Add: signature field (Ed25519 over result_digest + engine_semver + hash_version).
//   Add: previous_entry_digest for Merkle-chaining.
struct ProvenanceRecord {
  uint64_t    sequence{0};            // Monotonic sequence number (global counter)
  std::string execution_id;           // = request_digest (deterministic execution ID)
  std::string tenant_id;              // Multi-tenant context
  std::string request_digest;         // BLAKE3 of canonical request
  std::string result_digest;          // BLAKE3 of canonical result
  std::string engine_semver;          // e.g. "0.8.0"
  uint32_t    engine_abi_version{0};  // from version::ENGINE_ABI_VERSION
  uint32_t    hash_algorithm_version{0}; // from version::HASH_ALGORITHM_VERSION
  uint32_t    cas_format_version{0};  // from version::CAS_FORMAT_VERSION
  bool        replay_verified{false}; // Was replay validation run and passed?
  bool        ok{false};              // Execution succeeded?
  std::string error_code;             // Empty if ok
  uint64_t    duration_ns{0};         // Wall-clock execution time
  uint64_t    timestamp_unix_ms{0};   // Wall-clock timestamp at record creation
  std::string worker_id;              // Worker that ran this execution
  std::string node_id;                // Node/host that ran this execution
};

// Serialize to compact single-line JSON (suitable for NDJSON append).
std::string provenance_to_json(const ProvenanceRecord& r);

// ---------------------------------------------------------------------------
// ImmutableAuditLog — append-only NDJSON log writer
// ---------------------------------------------------------------------------
// Thread-safe: uses internal mutex for concurrent appends.
// Each write is followed by fflush() to minimize data loss on crash.
//
// EXTENSION_POINT: governance_enhancements
//   Replace with a MerkleAuditLog that chains entries via BLAKE3.
class ImmutableAuditLog {
 public:
  // path: filesystem path to the audit log file. Created if absent.
  // Caller must ensure the directory exists.
  explicit ImmutableAuditLog(const std::string& path = "");

  ~ImmutableAuditLog();

  // Append a provenance record. Returns true on success, false on write error.
  // Never throws. Never modifies existing entries.
  // INVARIANT: if append() returns false, the entry was NOT written.
  bool append(ProvenanceRecord& record);  // assigns sequence number in-place

  // Returns the count of entries appended in this process lifetime.
  uint64_t entry_count() const;

  // Returns the count of failed append attempts.
  uint64_t failure_count() const;

  // Returns the path this log writes to.
  const std::string& path() const { return path_; }

 private:
  std::string  path_;
  void*        file_{nullptr};   // opaque FILE*, avoid including stdio in header
  mutable void* mutex_{nullptr}; // opaque pthread_mutex_t* or std::mutex*
  uint64_t     seq_{0};          // monotonic sequence, protected by mutex
  uint64_t     entry_count_{0};
  uint64_t     failure_count_{0};
};

// ---------------------------------------------------------------------------
// Global audit log singleton
// ---------------------------------------------------------------------------
// Activated by setting REQUIEM_AUDIT_LOG=/path/to/audit.ndjson before engine init.
// In Enterprise mode: configured programmatically via set_audit_log_path().
//
// EXTENSION_POINT: governance_enhancements
//   set_audit_log_path() could be extended to accept a URI scheme:
//     file:///var/log/requiem/audit.ndjson   → local file (current)
//     kafka://broker:9092/topic              → Kafka producer
//     qldb://ledger/table                    → Amazon QLDB
ImmutableAuditLog& global_audit_log();

// Configure the audit log path. Must be called before the first execution.
// If not called, defaults to REQUIEM_AUDIT_LOG env var or no-op (disabled).
void set_audit_log_path(const std::string& path);

}  // namespace requiem
