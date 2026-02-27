#include "requiem/worker.hpp"
#include "requiem/observability.hpp"

#include <cstdlib>
#include <mutex>
#include <sstream>
#include <unistd.h>  // getpid, gethostname

namespace requiem {

namespace {

WorkerIdentity g_worker_identity;
std::mutex     g_init_mu;
bool           g_initialized{false};

std::string get_hostname() {
  char buf[256] = {};
  if (::gethostname(buf, sizeof(buf) - 1) == 0) return buf;
  return "unknown-host";
}

std::string make_default_worker_id() {
  return "w-" + std::to_string(static_cast<long>(::getpid()));
}

}  // namespace

WorkerIdentity init_worker_identity(const std::string& worker_id,
                                    const std::string& node_id,
                                    bool               cluster_mode) {
  std::lock_guard<std::mutex> lk(g_init_mu);

  g_worker_identity.worker_id = worker_id.empty()
      ? ([] {
           const char* e = std::getenv("REQUIEM_WORKER_ID");
           return (e && e[0]) ? std::string(e) : make_default_worker_id();
         }())
      : worker_id;

  g_worker_identity.node_id = node_id.empty()
      ? ([] {
           const char* e = std::getenv("REQUIEM_NODE_ID");
           return (e && e[0]) ? std::string(e) : get_hostname();
         }())
      : node_id;

  if (!cluster_mode) {
    const char* e = std::getenv("REQUIEM_CLUSTER_MODE");
    g_worker_identity.cluster_mode = (e && std::string(e) == "1");
  } else {
    g_worker_identity.cluster_mode = true;
  }

  g_worker_identity.shard_id     = 0;
  g_worker_identity.total_shards = 1;

  g_initialized = true;
  return g_worker_identity;
}

const WorkerIdentity& global_worker_identity() {
  if (!g_initialized) init_worker_identity();
  return g_worker_identity;
}

WorkerHealth worker_health_snapshot() {
  WorkerHealth h;
  h.worker_id = global_worker_identity().worker_id;
  h.alive     = true;

  const auto& stats = global_engine_stats();
  h.executions_total     = stats.total_executions.load(std::memory_order_relaxed);
  h.executions_inflight  = 0;   // EXTENSION_POINT: track via atomic inflight counter
  h.queue_depth          = 0;   // EXTENSION_POINT: WorkerPool queue depth
  h.utilization_pct      = 0.0; // EXTENSION_POINT: inflight / worker_pool_size * 100

  return h;
}

std::string worker_identity_to_json(const WorkerIdentity& w) {
  std::ostringstream o;
  o << "{"
    << "\"worker_id\":\"" << w.worker_id << "\""
    << ",\"node_id\":\"" << w.node_id << "\""
    << ",\"cluster_mode\":" << (w.cluster_mode ? "true" : "false")
    << ",\"shard_id\":" << w.shard_id
    << ",\"total_shards\":" << w.total_shards
    << "}";
  return o.str();
}

std::string worker_health_to_json(const WorkerHealth& h) {
  std::ostringstream o;
  char buf[32];
  o << "{"
    << "\"worker_id\":\"" << h.worker_id << "\""
    << ",\"alive\":" << (h.alive ? "true" : "false")
    << ",\"executions_total\":" << h.executions_total
    << ",\"executions_inflight\":" << h.executions_inflight
    << ",\"queue_depth\":" << h.queue_depth
    << ",\"utilization_pct\":";
  std::snprintf(buf, sizeof(buf), "%.2f", h.utilization_pct);
  o << buf << "}";
  return o.str();
}

}  // namespace requiem
