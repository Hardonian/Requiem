#pragma once

// requiem/cluster.hpp — Distributed cluster platform for Requiem.
//
// DESIGN:
//   The cluster platform enables multiple Requiem engine instances (workers)
//   to operate as a coordinated cluster. In standalone mode (default), a single
//   worker handles all requests. In cluster mode, requests are sharded across
//   workers by tenant_id, providing horizontal scalability.
//
// ARCHITECTURE:
//   ClusterRegistry — in-process worker registry. Workers self-register on startup.
//     In a multi-process deployment, each worker process is autonomous; the registry
//     tracks only the local worker in stateless mode. For full multi-node awareness,
//     an external coordinator (Redis, etcd) would be used — but the interface is
//     designed to accommodate that upgrade without API changes.
//
//   ShardRouter — maps tenant_id → shard_id using FNV-1a (deterministic, no deps).
//     shard_id = fnv1a_32(tenant_id) % total_shards
//     Invariant: same tenant_id + same total_shards → same shard_id, always.
//
// INVARIANTS:
//   - Worker registration is idempotent (same worker_id → update, not duplicate).
//   - Shard assignment is purely derived from tenant_id — no per-request state.
//   - total_shards may not change mid-session (restart required for rebalance).
//   - cluster_mode must match the value in WorkerIdentity (checked at init).
//
// EXTENSION_POINT: external_cluster_coordinator
//   Current: in-process single-node registry (stateless per process).
//   Upgrade: replace ClusterRegistry with a gRPC/etcd-backed coordinator:
//     1. On init: POST /cluster/join → receive assigned shard range.
//     2. On tick: PUT /cluster/heartbeat → update health and queue depth.
//     3. On route: GET /cluster/shard/{id}/worker → get worker endpoint.
//   Invariant: the ShardRouter interface must not change during this upgrade.
//
// EXTENSION_POINT: cluster_rebalance
//   Current: total_shards is fixed at startup.
//   Upgrade: implement a shard rebalance protocol that drains in-flight requests
//   from old shard assignments before activating new routing. Workers announce
//   their drain state and coordinator waits for all ACKs before updating the
//   shard table.

#include <chrono>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

#include "requiem/worker.hpp"

namespace requiem {

// ---------------------------------------------------------------------------
// ShardRouter — deterministic tenant → shard mapping.
// ---------------------------------------------------------------------------
// Thread-safe: all methods are const or stateless.
// ---------------------------------------------------------------------------
class ShardRouter {
 public:
  // Compute the shard for a given tenant_id with the given total shards.
  // Returns 0 if total_shards == 0 (safe default).
  static uint32_t shard_for_tenant(const std::string& tenant_id,
                                   uint32_t            total_shards);

  // Convenience: use the global worker's total_shards.
  static uint32_t shard_for_tenant(const std::string& tenant_id);

  // Returns true if this worker is responsible for the given tenant_id.
  // In standalone mode (total_shards == 1), always returns true.
  static bool is_local_shard(const std::string& tenant_id);
};

// ---------------------------------------------------------------------------
// WorkerRecord — a registered worker's identity + last known health.
// ---------------------------------------------------------------------------
struct WorkerRecord {
  WorkerIdentity identity;
  WorkerHealth   last_health;
  uint64_t       registered_at_unix_ms{0};
  uint64_t       last_heartbeat_unix_ms{0};
  bool           healthy{true};
};

// ---------------------------------------------------------------------------
// ClusterStatus — snapshot of the cluster state.
// ---------------------------------------------------------------------------
struct ClusterStatus {
  bool        cluster_mode{false};
  uint32_t    total_workers{0};
  uint32_t    healthy_workers{0};
  uint32_t    total_shards{1};
  std::string local_worker_id;
  std::string local_node_id;
  uint32_t    local_shard_id{0};
  std::vector<WorkerRecord> workers;
};

// ---------------------------------------------------------------------------
// ClusterRegistry — worker registration and heartbeat tracking.
// ---------------------------------------------------------------------------
// Thread-safe. Singleton accessed via global_cluster_registry().
// ---------------------------------------------------------------------------
class ClusterRegistry {
 public:
  // Register (or refresh) a worker. Thread-safe.
  void register_worker(const WorkerIdentity& identity,
                       const WorkerHealth&   health);

  // Update a worker's health snapshot (heartbeat). Thread-safe.
  // No-op if worker_id is not already registered.
  void update_health(const std::string& worker_id,
                     const WorkerHealth& health);

  // Mark a worker as unhealthy (e.g., missed heartbeats). Thread-safe.
  void mark_unhealthy(const std::string& worker_id);

  // Snapshot of all registered workers. Thread-safe.
  std::vector<WorkerRecord> snapshot() const;

  // Number of registered workers.
  uint32_t worker_count() const;

  // Number of healthy workers.
  uint32_t healthy_count() const;

  // Get a full cluster status snapshot.
  ClusterStatus cluster_status() const;

  // Serialize cluster status to compact JSON.
  std::string cluster_status_to_json() const;

  // Serialize worker list to compact JSON array.
  std::string workers_to_json() const;

 private:
  mutable std::mutex         mu_;
  std::vector<WorkerRecord>  workers_;

  // Find index by worker_id. Must be called with mu_ held.
  int find_worker_index(const std::string& worker_id) const;

  static uint64_t now_unix_ms();
};

// Singleton accessor.
ClusterRegistry& global_cluster_registry();

// ---------------------------------------------------------------------------
// Cluster initialization helpers.
// ---------------------------------------------------------------------------

// Initialize cluster mode from environment:
//   REQUIEM_SHARD_ID     — shard assigned to this worker (default: 0)
//   REQUIEM_TOTAL_SHARDS — total shards in cluster (default: 1)
// Must be called after init_worker_identity().
// Updates g_worker_identity.shard_id and g_worker_identity.total_shards.
void init_cluster_from_env();

// Register the local worker with the global registry and emit a startup event.
// Call after init_cluster_from_env().
void register_local_worker();

}  // namespace requiem
