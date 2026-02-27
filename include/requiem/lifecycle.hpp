#pragma once

// requiem/lifecycle.hpp — Data lifecycle controls: retention, export, and soft-delete.
//
// DESIGN:
//   Governs the retention and deletion of CAS objects, audit log entries,
//   and execution records on a per-tenant basis.
//
// INVARIANTS:
//   1. Audit log entries are NEVER hard-deleted (immutable by design).
//      Soft-delete marks them as redacted but the entry persists.
//   2. CAS objects are content-addressed — once committed, the digest is
//      immutable. Deletion removes the path mapping, not the hash.
//   3. Soft-delete is reversible within the retention window.
//   4. Hard-delete is permanent and requires explicit admin confirmation.
//   5. Export operations are read-only and never modify stored state.
//   6. Retention policies are per-tenant; the platform policy sets the minimum.
//
// EXTENSION_POINT: compliance_integration
//   Current: JSON-based retention config with file-based export.
//   Upgrade: integrate with GDPR/CCPA right-to-erasure APIs. Add a deletion
//   attestation that is committed to the audit log before any hard delete.

#include <cstdint>
#include <string>
#include <vector>

namespace requiem {
namespace lifecycle {

// ---------------------------------------------------------------------------
// RetentionPolicy — per-tenant data retention configuration
// ---------------------------------------------------------------------------
struct RetentionPolicy {
  std::string tenant_id;

  // Days to retain each data type (0 = no explicit policy, use platform default)
  uint32_t execution_records_days{90};     // execution metadata (request/result digest)
  uint32_t cas_objects_days{365};          // CAS objects (content-addressed storage)
  uint32_t replay_logs_days{90};           // replay verification logs
  uint32_t audit_log_days{0};             // 0 = never (audit log is permanently immutable)
  uint32_t incident_bundles_days{30};      // incident capture bundles

  // Whether soft-delete is enabled (true = soft, false = hard on expiry)
  bool     soft_delete_enabled{true};

  // Compliance mode: if true, deletion requires signed attestation in audit log
  bool     compliance_attestation_required{false};

  std::string to_json() const;
};

// Parse a RetentionPolicy from JSON.
RetentionPolicy retention_policy_from_json(const std::string& json);

// ---------------------------------------------------------------------------
// SoftDeleteRecord — marks an object as soft-deleted
// ---------------------------------------------------------------------------
struct SoftDeleteRecord {
  std::string object_type;     // "cas_object" | "execution_record" | "replay_log"
  std::string object_id;       // digest or execution ID
  std::string tenant_id;
  std::string deleted_at_iso;
  std::string deleted_by;      // worker_id or operator token ID
  std::string reason;          // human-readable reason
  bool        is_hard_deleted{false};
  std::string hard_delete_at_iso;  // scheduled hard delete time

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// ExportRequest — parameters for a tenant data export
// ---------------------------------------------------------------------------
struct ExportRequest {
  std::string tenant_id;
  std::string format;           // "json" | "ndjson"
  bool        include_cas_objects{false};   // large; off by default
  bool        include_replay_logs{true};
  bool        include_audit_log{true};
  bool        include_execution_records{true};
  std::string start_date_iso;  // ISO-8601; empty = no lower bound
  std::string end_date_iso;    // ISO-8601; empty = now
};

// ---------------------------------------------------------------------------
// ExportResult — result of an export operation
// ---------------------------------------------------------------------------
struct ExportResult {
  bool        ok{false};
  std::string tenant_id;
  std::string export_id;        // unique ID for this export (for audit log)
  std::string output_path;      // where the export was written
  uint64_t    records_exported{0};
  uint64_t    bytes_written{0};
  std::string exported_at_iso;
  std::string error;            // non-empty if !ok

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// LifecycleManager — data lifecycle operations
// ---------------------------------------------------------------------------
// Thread-safe. Operations are logged to the audit stream.
// ---------------------------------------------------------------------------
class LifecycleManager {
 public:
  // Set the retention policy for a tenant (admin operation).
  void set_retention_policy(const RetentionPolicy& policy);

  // Get the current retention policy for a tenant.
  // Falls back to the platform default if no tenant-specific policy is set.
  RetentionPolicy get_retention_policy(const std::string& tenant_id) const;

  // Soft-delete a CAS object for a tenant.
  // Records a SoftDeleteRecord in the audit log.
  // INVARIANT: audit log entries for the soft-delete are never themselves deleted.
  SoftDeleteRecord soft_delete(
      const std::string& tenant_id,
      const std::string& object_type,
      const std::string& object_id,
      const std::string& reason,
      const std::string& deleted_by);

  // Export all data for a tenant.
  // INVARIANT: export is read-only; does not alter any stored data.
  ExportResult export_tenant_data(const ExportRequest& req) const;

  // Apply retention policy: scan and soft-delete expired objects.
  // Should be called by a nightly maintenance job.
  // Returns number of objects soft-deleted.
  uint64_t apply_retention_policy(const std::string& tenant_id);

  // Promote a soft-delete to hard-delete (requires compliance_attestation if configured).
  // Writes deletion attestation to audit log first.
  bool hard_delete(const std::string& soft_delete_record_id,
                   const std::string& attestation,
                   std::string* error);

  // Serialize all soft-delete records for a tenant to JSON array.
  std::string soft_deletes_to_json(const std::string& tenant_id) const;

 private:
  mutable std::mutex mu_;
  std::vector<RetentionPolicy>    policies_;
  std::vector<SoftDeleteRecord>   soft_deletes_;
  RetentionPolicy                 platform_default_;

  const RetentionPolicy* find_policy(const std::string& tenant_id) const;
};

// Singleton accessor.
LifecycleManager& global_lifecycle_manager();

}  // namespace lifecycle
}  // namespace requiem
