#pragma once

// requiem/worker.hpp — Worker identity and cluster mode for distributed scaling.
//
// DESIGN:
//   Each engine process has a unique WorkerIdentity assigned at startup.
//   worker_id: unique within a node (PID-derived or UUID-like).
//   node_id:   unique within a cluster (hostname or injected via env).
//   cluster_mode: enables multi-node behaviors (health reporting, queue sharding).
//
// EXTENSION_POINT: cluster_coordinator
//   Current: stateless, single-worker mode. Each process is independent.
//   Upgrade path:
//     1. Implement a ClusterCoordinator that workers register with on startup.
//     2. ClusterCoordinator assigns shard ranges and coordinates replay comparison.
//     3. Workers emit health beats via the coordinator.
//     4. ShardedExecutionQueue distributes requests across workers by tenant hash.
//   Invariant: worker_id + node_id must be included in execution provenance records.
//   Invariant: cluster_mode must NEVER change mid-session without restarting the engine.
//
// STATELESS WORKER MODE:
//   The engine is designed to be stateless per-execution:
//     - No in-memory state persists between executions (only global EngineStats).
//     - CAS storage is the only shared state and is append-only (safe concurrent access).
//     - Multiple workers can process executions from the same CAS without coordination.
//   This enables horizontal scaling: spin up N identical workers pointing at
//   the same CAS backend and distribute requests via an external load balancer.
//
// EXTENSION_POINT: cluster_coordinator
//   ShardedExecutionQueue implementation:
//     - Hash tenant_id → shard_id (0..N-1).
//     - Route to worker assigned to that shard.
//     - Rebalance on worker join/leave without stopping existing workers.
//     - Invariant: requests for the same tenant_id must go to the same shard
//       to maintain per-tenant ordering guarantees.

#include <cstdint>
#include <string>

namespace requiem {

// ---------------------------------------------------------------------------
// WorkerIdentity — populated at engine init, immutable thereafter.
// ---------------------------------------------------------------------------
struct WorkerIdentity {
  std::string worker_id;      // Unique within node (format: "w-<pid>-<random>")
  std::string node_id;        // Unique within cluster (hostname by default)
  bool        cluster_mode{false};  // True when running as part of a cluster
  uint32_t    shard_id{0};    // Assigned shard (0 = unsharded/standalone)
  uint32_t    total_shards{1};// Total shards in cluster (1 = standalone)

  // EXTENSION_POINT: cluster_coordinator
  // Add: coordinator_endpoint, heartbeat_interval_ms, last_heartbeat_ts
};

// ---------------------------------------------------------------------------
// WorkerHealth — reported periodically in cluster mode.
// ---------------------------------------------------------------------------
struct WorkerHealth {
  std::string  worker_id;
  bool         alive{true};
  uint64_t     executions_total{0};
  uint64_t     executions_inflight{0};
  uint64_t     queue_depth{0};
  double       utilization_pct{0.0};  // 0-100

  // EXTENSION_POINT: cluster_coordinator
  // Add: last_heartbeat_unix_ms, p99_latency_ms, error_rate_pct
};

// ---------------------------------------------------------------------------
// Initialize worker identity from environment/config.
// Must be called once at engine startup.
// Sources (in priority order):
//   1. Explicit parameters (if non-empty).
//   2. Environment: REQUIEM_WORKER_ID, REQUIEM_NODE_ID, REQUIEM_CLUSTER_MODE.
//   3. Defaults: worker_id = "w-<pid>", node_id = hostname.
// ---------------------------------------------------------------------------
WorkerIdentity init_worker_identity(const std::string& worker_id = "",
                                    const std::string& node_id    = "",
                                    bool               cluster_mode = false);

// Returns the global worker identity (read-only after init).
const WorkerIdentity& global_worker_identity();

// Report current worker health snapshot.
WorkerHealth worker_health_snapshot();

// Serialize WorkerIdentity to compact JSON.
std::string worker_identity_to_json(const WorkerIdentity& w);

// Serialize WorkerHealth to compact JSON.
std::string worker_health_to_json(const WorkerHealth& h);

}  // namespace requiem
