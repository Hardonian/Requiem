#include "requiem/snapshot.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/metering.hpp"

#include <chrono>
#include <mutex>

namespace requiem {

// In-memory snapshot store
struct SnapshotStore {
  std::mutex mu;
  std::map<std::string, Snapshot> snapshots; // snapshot_hash -> snapshot
};

static SnapshotStore &snapshot_store() {
  static SnapshotStore store;
  return store;
}

// Global logical time counter
static uint64_t &global_logical_time() {
  static uint64_t time = 0;
  return time;
}

Snapshot snapshot_create(const std::string &tenant_id) {
  Snapshot snapshot;
  snapshot.snapshot_version = 1;
  snapshot.logical_time = ++global_logical_time();
  snapshot.event_log_head = "evt_" + std::to_string(snapshot.logical_time);

  // Compute CAS root hash (simplified)
  snapshot.cas_root_hash =
      hash_domain("cas:", "snapshot_" + std::to_string(snapshot.logical_time));

  // Add tenant's capability fingerprints if specified
  if (!tenant_id.empty()) {
    snapshot.active_caps.push_back("cap_" + tenant_id + "_admin");
  }

  // Include current budgets
  if (!tenant_id.empty()) {
    snapshot.budgets[tenant_id] = meter_get_budget(tenant_id);
  }

  snapshot.timestamp_unix_ms = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch())
          .count());

  snapshot.snapshot_hash = snapshot_compute_hash(snapshot);

  std::lock_guard<std::mutex> lock(snapshot_store().mu);
  snapshot_store().snapshots[snapshot.snapshot_hash] = snapshot;

  return snapshot;
}

std::vector<Snapshot> snapshot_list(const std::string &tenant_id) {
  std::lock_guard<std::mutex> lock(snapshot_store().mu);
  std::vector<Snapshot> result;

  for (const auto &[hash, snap] : snapshot_store().snapshots) {
    if (tenant_id.empty() || snap.budgets.count(tenant_id)) {
      result.push_back(snap);
    }
  }

  return result;
}

SnapshotRestoreResult snapshot_restore(const std::string &snapshot_hash) {
  SnapshotRestoreResult result;

  std::lock_guard<std::mutex> lock(snapshot_store().mu);
  auto it = snapshot_store().snapshots.find(snapshot_hash);

  if (it == snapshot_store().snapshots.end()) {
    result.ok = false;
    result.message = "Snapshot not found: " + snapshot_hash;
    return result;
  }

  const auto &snapshot = it->second;

  // Restore logical time
  global_logical_time() = snapshot.logical_time;

  // Restore budgets
  for (const auto &[tenant_id, budget] : snapshot.budgets) {
    meter_set_budget(tenant_id, "exec", budget.exec_limit);
    meter_set_budget(tenant_id, "cas_put", budget.cas_put_limit);
    meter_set_budget(tenant_id, "policy_eval", budget.policy_eval_limit);
  }

  result.ok = true;
  result.restored_logical_time = snapshot.logical_time;
  result.message = "Successfully restored from snapshot " + snapshot_hash +
                   ". Logical time set to " +
                   std::to_string(snapshot.logical_time);

  return result;
}

std::string snapshot_to_json(const Snapshot &snapshot) {
  jsonlite::Object obj;
  obj["snapshot_version"] = snapshot.snapshot_version;
  obj["logical_time"] = snapshot.logical_time;
  obj["event_log_head"] = snapshot.event_log_head;
  obj["cas_root_hash"] = snapshot.cas_root_hash;
  obj["snapshot_hash"] = snapshot.snapshot_hash;
  obj["timestamp_unix_ms"] = snapshot.timestamp_unix_ms;

  jsonlite::Array caps;
  for (const auto &cap : snapshot.active_caps) {
    caps.push_back(jsonlite::Value{cap});
  }
  obj["active_caps"] = std::move(caps);

  jsonlite::Array revoked;
  for (const auto &cap : snapshot.revoked_caps) {
    revoked.push_back(jsonlite::Value{cap});
  }
  obj["revoked_caps"] = std::move(revoked);

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

Snapshot snapshot_from_json(const std::string &json) {
  Snapshot snapshot;
  auto obj = jsonlite::parse(json, nullptr);

  snapshot.snapshot_version =
      static_cast<uint32_t>(jsonlite::get_u64(obj, "snapshot_version", 1));
  snapshot.logical_time = jsonlite::get_u64(obj, "logical_time", 0);
  snapshot.event_log_head = jsonlite::get_string(obj, "event_log_head", "");
  snapshot.cas_root_hash = jsonlite::get_string(obj, "cas_root_hash", "");
  snapshot.snapshot_hash = jsonlite::get_string(obj, "snapshot_hash", "");
  snapshot.timestamp_unix_ms = jsonlite::get_u64(obj, "timestamp_unix_ms", 0);

  return snapshot;
}

std::string snapshot_compute_hash(const Snapshot &snapshot) {
  jsonlite::Object obj;
  obj["snapshot_version"] = snapshot.snapshot_version;
  obj["logical_time"] = snapshot.logical_time;
  obj["event_log_head"] = snapshot.event_log_head;
  obj["cas_root_hash"] = snapshot.cas_root_hash;

  return hash_domain("snap:",
                     jsonlite::to_json(jsonlite::Value{std::move(obj)}));
}

} // namespace requiem
