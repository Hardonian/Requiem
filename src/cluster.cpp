#include "requiem/cluster.hpp"
#include "requiem/worker.hpp"
#include "requiem/observability.hpp"
#include "requiem/version.hpp"

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <cstdio>
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
  const auto& w = global_worker_identity();
  WorkerIdentity identity = w;
  // Populate version stamps for cluster compatibility checking.
  // These are set here because init_worker_identity() runs before version info is available.
  if (identity.engine_semver.empty()) {
    const auto vm = version::current_manifest();
    identity.engine_semver            = vm.engine_semver;
    identity.engine_abi_version       = vm.engine_abi;
    identity.hash_algorithm_version   = vm.hash_algorithm;
    identity.protocol_framing_version = vm.protocol_framing;
  }
  const auto health = worker_health_snapshot();
  global_cluster_registry().register_worker(identity, health);
}

// ---------------------------------------------------------------------------
// ClusterDriftStatus::to_json
// ---------------------------------------------------------------------------

std::string ClusterDriftStatus::to_json() const {
  std::ostringstream o;
  o << "{"
    << "\"ok\":" << (ok ? "true" : "false")
    << ",\"engine_version_mismatch\":" << (engine_version_mismatch ? "true" : "false")
    << ",\"hash_version_mismatch\":" << (hash_version_mismatch ? "true" : "false")
    << ",\"protocol_version_mismatch\":" << (protocol_version_mismatch ? "true" : "false")
    << ",\"auth_version_mismatch\":" << (auth_version_mismatch ? "true" : "false")
    << ",\"replay_drift_rate\":" << replay_drift_rate
    << ",\"replay_divergences\":" << replay_divergences
    << ",\"replay_verifications\":" << replay_verifications
    << ",\"total_workers\":" << total_workers
    << ",\"compatible_workers\":" << compatible_workers
    << ",\"mismatches\":[";
  bool first = true;
  for (const auto& m : mismatches) {
    if (!first) o << ",";
    first = false;
    o << "{\"field\":\"" << m.field << "\""
      << ",\"expected\":\"" << m.expected << "\""
      << ",\"observed\":\"" << m.observed << "\""
      << ",\"worker_id\":\"" << m.worker_id << "\"}";
  }
  o << "]}";
  return o.str();
}

// ---------------------------------------------------------------------------
// ClusterRegistry::cluster_drift_status
// ---------------------------------------------------------------------------

ClusterDriftStatus ClusterRegistry::cluster_drift_status() const {
  ClusterDriftStatus drift;

  const auto& local = global_worker_identity();
  const auto  vm    = version::current_manifest();

  // Use local version as the reference baseline.
  const std::string ref_engine_semver = vm.engine_semver.empty()
      ? local.engine_semver : vm.engine_semver;
  const uint32_t ref_hash_version     = vm.hash_algorithm;
  const uint32_t ref_proto_version    = vm.protocol_framing;
  const uint32_t ref_auth_version     = local.auth_version;

  // Compute replay drift rate from global engine stats.
  const EngineStats& stats = global_engine_stats();
  const uint64_t divergences     = stats.replay_divergences.load(std::memory_order_relaxed);
  const uint64_t verifications   = stats.replay_verifications.load(std::memory_order_relaxed);
  drift.replay_divergences    = divergences;
  drift.replay_verifications  = verifications;
  drift.replay_drift_rate     = (verifications > 0)
      ? static_cast<double>(divergences) / static_cast<double>(verifications)
      : -1.0;

  // Check all registered workers for version compatibility.
  std::lock_guard<std::mutex> lk(mu_);
  drift.total_workers = static_cast<uint32_t>(workers_.size());
  drift.compatible_workers = 0;

  for (const auto& wr : workers_) {
    const WorkerIdentity& wi = wr.identity;
    bool this_worker_ok = true;

    // engine_semver check (skip if not populated yet).
    if (!wi.engine_semver.empty() && !ref_engine_semver.empty() &&
        wi.engine_semver != ref_engine_semver) {
      VersionMismatch m;
      m.field     = "engine_semver";
      m.expected  = ref_engine_semver;
      m.observed  = wi.engine_semver;
      m.worker_id = wi.worker_id;
      drift.mismatches.push_back(m);
      drift.engine_version_mismatch = true;
      this_worker_ok = false;
    }

    // hash_algorithm_version check.
    if (wi.hash_algorithm_version > 0 &&
        wi.hash_algorithm_version != ref_hash_version) {
      VersionMismatch m;
      m.field     = "hash_algorithm_version";
      m.expected  = std::to_string(ref_hash_version);
      m.observed  = std::to_string(wi.hash_algorithm_version);
      m.worker_id = wi.worker_id;
      drift.mismatches.push_back(m);
      drift.hash_version_mismatch = true;
      this_worker_ok = false;
    }

    // protocol_framing_version check.
    if (wi.protocol_framing_version > 0 &&
        wi.protocol_framing_version != ref_proto_version) {
      VersionMismatch m;
      m.field     = "protocol_framing_version";
      m.expected  = std::to_string(ref_proto_version);
      m.observed  = std::to_string(wi.protocol_framing_version);
      m.worker_id = wi.worker_id;
      drift.mismatches.push_back(m);
      drift.protocol_version_mismatch = true;
      this_worker_ok = false;
    }

    // auth_version check.
    if (wi.auth_version != ref_auth_version) {
      VersionMismatch m;
      m.field     = "auth_version";
      m.expected  = std::to_string(ref_auth_version);
      m.observed  = std::to_string(wi.auth_version);
      m.worker_id = wi.worker_id;
      drift.mismatches.push_back(m);
      drift.auth_version_mismatch = true;
      this_worker_ok = false;
    }

    if (this_worker_ok) ++drift.compatible_workers;
  }

  drift.ok = drift.mismatches.empty();
  return drift;
}

std::string ClusterRegistry::cluster_drift_to_json() const {
  return cluster_drift_status().to_json();
}

bool ClusterRegistry::validate_version_compatibility(ClusterDriftStatus* out) const {
  const ClusterDriftStatus drift = cluster_drift_status();
  if (out) *out = drift;
  return drift.ok;
}

// ---------------------------------------------------------------------------
// enforce_cluster_version_compatibility
// ---------------------------------------------------------------------------

bool enforce_cluster_version_compatibility(bool strict) {
  const auto& local = global_worker_identity();
  if (!local.cluster_mode) return true;  // standalone: no enforcement

  ClusterDriftStatus drift;
  const bool ok = global_cluster_registry().validate_version_compatibility(&drift);

  if (!ok) {
    // Always log to stderr.
    std::fprintf(stderr,
        "[requiem:cluster] VERSION MISMATCH DETECTED — cluster is incompatible.\n"
        "  %s\n",
        drift.to_json().c_str());

    if (strict) {
      std::fprintf(stderr,
          "[requiem:cluster] REQUIEM_FAIL_ON_VERSION_MISMATCH=1: aborting startup.\n");
      std::abort();
    } else {
      std::fprintf(stderr,
          "[requiem:cluster] WARNING: running with version-mismatched cluster. "
          "Set REQUIEM_FAIL_ON_VERSION_MISMATCH=1 to enforce strict compatibility.\n");
    }
  }

  return ok;
}

}  // namespace requiem
