#include "requiem/cluster.hpp"
#include "requiem/worker.hpp"

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <sstream>

namespace requiem {

// ---------------------------------------------------------------------------
// ShardRouter
// ---------------------------------------------------------------------------

// FNV-1a 32-bit hash — deterministic, dependency-free.
// https://tools.ietf.org/html/draft-eastlake-fnv
static uint32_t fnv1a_32(const std::string& s) {
  uint32_t hash = 2166136261u;
  for (unsigned char c : s) {
    hash ^= static_cast<uint32_t>(c);
    hash *= 16777619u;
  }
  return hash;
}

uint32_t ShardRouter::shard_for_tenant(const std::string& tenant_id,
                                        uint32_t            total_shards) {
  if (total_shards <= 1) return 0;
  if (tenant_id.empty()) return 0;
  return fnv1a_32(tenant_id) % total_shards;
}

uint32_t ShardRouter::shard_for_tenant(const std::string& tenant_id) {
  const auto& w = global_worker_identity();
  return shard_for_tenant(tenant_id, w.total_shards);
}

bool ShardRouter::is_local_shard(const std::string& tenant_id) {
  const auto& w = global_worker_identity();
  if (!w.cluster_mode || w.total_shards <= 1) return true;
  return shard_for_tenant(tenant_id, w.total_shards) == w.shard_id;
}

// ---------------------------------------------------------------------------
// ClusterRegistry
// ---------------------------------------------------------------------------

uint64_t ClusterRegistry::now_unix_ms() {
  using namespace std::chrono;
  return static_cast<uint64_t>(
      duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count());
}

int ClusterRegistry::find_worker_index(const std::string& worker_id) const {
  for (int i = 0; i < static_cast<int>(workers_.size()); ++i) {
    if (workers_[i].identity.worker_id == worker_id) return i;
  }
  return -1;
}

void ClusterRegistry::register_worker(const WorkerIdentity& identity,
                                       const WorkerHealth&   health) {
  std::lock_guard<std::mutex> lk(mu_);
  const uint64_t now = now_unix_ms();
  int idx = find_worker_index(identity.worker_id);
  if (idx < 0) {
    WorkerRecord r;
    r.identity              = identity;
    r.last_health           = health;
    r.registered_at_unix_ms = now;
    r.last_heartbeat_unix_ms = now;
    r.healthy               = true;
    workers_.push_back(std::move(r));
  } else {
    workers_[idx].identity              = identity;
    workers_[idx].last_health           = health;
    workers_[idx].last_heartbeat_unix_ms = now;
    workers_[idx].healthy               = health.alive;
  }
}

void ClusterRegistry::update_health(const std::string& worker_id,
                                     const WorkerHealth& health) {
  std::lock_guard<std::mutex> lk(mu_);
  int idx = find_worker_index(worker_id);
  if (idx < 0) return;
  workers_[idx].last_health            = health;
  workers_[idx].last_heartbeat_unix_ms = now_unix_ms();
  workers_[idx].healthy                = health.alive;
}

void ClusterRegistry::mark_unhealthy(const std::string& worker_id) {
  std::lock_guard<std::mutex> lk(mu_);
  int idx = find_worker_index(worker_id);
  if (idx < 0) return;
  workers_[idx].healthy                    = false;
  workers_[idx].last_health.alive          = false;
  workers_[idx].last_heartbeat_unix_ms     = now_unix_ms();
}

std::vector<WorkerRecord> ClusterRegistry::snapshot() const {
  std::lock_guard<std::mutex> lk(mu_);
  return workers_;
}

uint32_t ClusterRegistry::worker_count() const {
  std::lock_guard<std::mutex> lk(mu_);
  return static_cast<uint32_t>(workers_.size());
}

uint32_t ClusterRegistry::healthy_count() const {
  std::lock_guard<std::mutex> lk(mu_);
  uint32_t n = 0;
  for (const auto& w : workers_) if (w.healthy) ++n;
  return n;
}

ClusterStatus ClusterRegistry::cluster_status() const {
  std::lock_guard<std::mutex> lk(mu_);
  const auto& local = global_worker_identity();

  ClusterStatus s;
  s.cluster_mode     = local.cluster_mode;
  s.total_shards     = local.total_shards;
  s.local_worker_id  = local.worker_id;
  s.local_node_id    = local.node_id;
  s.local_shard_id   = local.shard_id;
  s.total_workers    = static_cast<uint32_t>(workers_.size());
  s.healthy_workers  = 0;
  for (const auto& w : workers_) if (w.healthy) ++s.healthy_workers;
  s.workers          = workers_;
  return s;
}

std::string ClusterRegistry::cluster_status_to_json() const {
  const auto s = cluster_status();
  std::ostringstream o;
  o << "{"
    << "\"cluster_mode\":" << (s.cluster_mode ? "true" : "false")
    << ",\"total_workers\":" << s.total_workers
    << ",\"healthy_workers\":" << s.healthy_workers
    << ",\"total_shards\":" << s.total_shards
    << ",\"local_worker_id\":\"" << s.local_worker_id << "\""
    << ",\"local_node_id\":\"" << s.local_node_id << "\""
    << ",\"local_shard_id\":" << s.local_shard_id
    << "}";
  return o.str();
}

std::string ClusterRegistry::workers_to_json() const {
  const auto workers = snapshot();
  std::ostringstream o;
  o << "[";
  bool first = true;
  for (const auto& r : workers) {
    if (!first) o << ",";
    first = false;
    o << "{"
      << "\"worker_id\":\"" << r.identity.worker_id << "\""
      << ",\"node_id\":\"" << r.identity.node_id << "\""
      << ",\"cluster_mode\":" << (r.identity.cluster_mode ? "true" : "false")
      << ",\"shard_id\":" << r.identity.shard_id
      << ",\"total_shards\":" << r.identity.total_shards
      << ",\"healthy\":" << (r.healthy ? "true" : "false")
      << ",\"executions_total\":" << r.last_health.executions_total
      << ",\"executions_inflight\":" << r.last_health.executions_inflight
      << ",\"queue_depth\":" << r.last_health.queue_depth
      << ",\"registered_at_unix_ms\":" << r.registered_at_unix_ms
      << ",\"last_heartbeat_unix_ms\":" << r.last_heartbeat_unix_ms
      << "}";
  }
  o << "]";
  return o.str();
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

ClusterRegistry& global_cluster_registry() {
  static ClusterRegistry instance;
  return instance;
}

// ---------------------------------------------------------------------------
// Initialization helpers
// ---------------------------------------------------------------------------

void init_cluster_from_env() {
  // These are written directly to the global worker identity fields.
  // init_worker_identity() must have already been called.
  // We use a non-const reference trick via re-init with the same IDs.
  const auto& current = global_worker_identity();

  uint32_t shard_id     = current.shard_id;
  uint32_t total_shards = current.total_shards;

  const char* e_shard = std::getenv("REQUIEM_SHARD_ID");
  const char* e_total = std::getenv("REQUIEM_TOTAL_SHARDS");

  if (e_shard && e_shard[0]) {
    int val = std::atoi(e_shard);
    if (val >= 0) shard_id = static_cast<uint32_t>(val);
  }
  if (e_total && e_total[0]) {
    int val = std::atoi(e_total);
    if (val >= 1) total_shards = static_cast<uint32_t>(val);
  }

  // Clamp shard_id to [0, total_shards - 1]
  if (total_shards > 1 && shard_id >= total_shards) {
    shard_id = 0;
  }

  // Re-initialize worker identity preserving existing IDs, updating shard fields.
  auto w = init_worker_identity(current.worker_id, current.node_id, current.cluster_mode);
  (void)w;

  // Patch shard fields (init_worker_identity always resets them to 0/1).
  // We need to update the global after init — use the mutable accessor pattern
  // by calling init again with explicit params.
  // The actual shard fields in g_worker_identity are private; we call init again
  // and then patch via the public interface by re-calling init_worker_identity
  // with cluster_mode=true when shard config is set.
  //
  // Since init_worker_identity resets shard_id/total_shards to 0/1, and we need
  // to set them, we expose a separate setter in worker.cpp via a free function.
  // To avoid coupling, we store the values in a file-local and expose them via
  // the cluster query helpers — the ShardRouter reads global_worker_identity()
  // which returns the fields we need. We must update those fields.
  //
  // Design choice: call update_worker_shard() declared below.
  update_worker_shard(shard_id, total_shards);
}

void register_local_worker() {
  const auto& identity = global_worker_identity();
  const auto  health   = worker_health_snapshot();
  global_cluster_registry().register_worker(identity, health);
}

}  // namespace requiem
