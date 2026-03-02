#pragma once

// requiem/snapshot.hpp — State snapshots for checkpoint and restore.
//
// KERNEL_SPEC §9: A snapshot captures complete kernel state at a logical time,
// enabling deterministic restore and replay alignment verification.
//
// INVARIANTS:
//   INV-CHAIN: Snapshot includes event_log_head for chain verification.
//   INV-CAS: Snapshot includes cas_root_hash for content verification.
//   INV-REPLAY: Restore + replay must produce identical state.

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace requiem {

// Forward declaration
struct BudgetInfo;

// A snapshot capturing kernel state at a specific logical time.
struct Snapshot {
  uint32_t snapshot_version{1};
  uint64_t logical_time{0};
  std::string event_log_head;  // Digest of last event in log
  std::string cas_root_hash;   // H("cas:", sorted_concat(all_object_digests))
  std::vector<std::string> active_caps;
  std::vector<std::string> revoked_caps;
  std::map<std::string, BudgetInfo> budgets;  // tenant_id -> budget
  std::map<std::string, std::string> policies;  // policy_id -> policy_hash
  std::string snapshot_hash;  // H("snap:", canonical_json(this_without_snapshot_hash))
  uint64_t timestamp_unix_ms{0};
};

// Result of a snapshot restore operation.
struct SnapshotRestoreResult {
  bool ok{false};
  uint64_t restored_logical_time{0};
  std::string message;
  std::string error;
};

// Create a snapshot of current kernel state.
Snapshot snapshot_create(const std::string& tenant_id = "");

// List available snapshots (optionally filtered by tenant).
std::vector<Snapshot> snapshot_list(const std::string& tenant_id = "");

// Restore kernel state from a snapshot.
SnapshotRestoreResult snapshot_restore(const std::string& snapshot_hash);

// Serialize a snapshot to JSON.
std::string snapshot_to_json(const Snapshot& snapshot);

// Parse a snapshot from JSON.
Snapshot snapshot_from_json(const std::string& json);

// Compute snapshot hash: H("snap:", canonical_json(fields_without_snapshot_hash))
std::string snapshot_compute_hash(const Snapshot& snapshot);

} // namespace requiem
