#include "requiem/audit.hpp"
#include "requiem/version.hpp"

#include <atomic>
#include <chrono>
#include <cstdio>
#include <mutex>
#include <sstream>
#include <string>

namespace requiem {

// ---------------------------------------------------------------------------
// ProvenanceRecord → JSON
// ---------------------------------------------------------------------------
std::string provenance_to_json(const ProvenanceRecord& r) {
  std::ostringstream o;
  o << "{"
    << "\"seq\":" << r.sequence
    << ",\"execution_id\":\"" << r.execution_id << "\""
    << ",\"tenant_id\":\"" << r.tenant_id << "\""
    << ",\"request_digest\":\"" << r.request_digest << "\""
    << ",\"result_digest\":\"" << r.result_digest << "\""
    << ",\"engine_semver\":\"" << r.engine_semver << "\""
    << ",\"engine_abi_version\":" << r.engine_abi_version
    << ",\"hash_algorithm_version\":" << r.hash_algorithm_version
    << ",\"cas_format_version\":" << r.cas_format_version
    << ",\"replay_verified\":" << (r.replay_verified ? "true" : "false")
    << ",\"ok\":" << (r.ok ? "true" : "false")
    << ",\"error_code\":\"" << r.error_code << "\""
    << ",\"duration_ns\":" << r.duration_ns
    << ",\"timestamp_unix_ms\":" << r.timestamp_unix_ms
    << ",\"worker_id\":\"" << r.worker_id << "\""
    << ",\"node_id\":\"" << r.node_id << "\""
    << "}";
  return o.str();
}

// ---------------------------------------------------------------------------
// ImmutableAuditLog
// ---------------------------------------------------------------------------

// Internal pimpl using std::mutex to avoid void* casting
struct AuditLogImpl {
  std::mutex mu;
  FILE*      file{nullptr};
  uint64_t   seq{0};
  uint64_t   entry_count{0};
  uint64_t   failure_count{0};
};

ImmutableAuditLog::ImmutableAuditLog(const std::string& path) : path_(path) {
  auto* impl = new AuditLogImpl();
  mutex_ = impl;

  if (!path_.empty()) {
    impl->file = std::fopen(path_.c_str(), "a");
    file_      = impl->file;
  }
}

ImmutableAuditLog::~ImmutableAuditLog() {
  auto* impl = static_cast<AuditLogImpl*>(mutex_);
  if (impl->file) {
    std::fclose(impl->file);
    impl->file = nullptr;
  }
  delete impl;
}

bool ImmutableAuditLog::append(ProvenanceRecord& record) {
  auto* impl = static_cast<AuditLogImpl*>(mutex_);
  std::lock_guard<std::mutex> lk(impl->mu);

  if (!impl->file) {
    // Audit log not configured — silently skip (non-fatal).
    return true;
  }

  // Assign monotonic sequence number.
  record.sequence = ++impl->seq;

  // Stamp timestamp.
  using SC = std::chrono::system_clock;
  record.timestamp_unix_ms = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          SC::now().time_since_epoch()).count());

  // Populate version fields from manifest.
  record.engine_abi_version      = requiem::version::ENGINE_ABI_VERSION;
  record.hash_algorithm_version  = requiem::version::HASH_ALGORITHM_VERSION;
  record.cas_format_version      = requiem::version::CAS_FORMAT_VERSION;

  const std::string line = provenance_to_json(record) + "\n";

  const bool written = (std::fwrite(line.data(), 1, line.size(), impl->file) == line.size());
  std::fflush(impl->file);  // minimize data loss on crash

  if (written) {
    ++impl->entry_count;
  } else {
    ++impl->failure_count;
  }
  return written;
}

uint64_t ImmutableAuditLog::entry_count() const {
  const auto* impl = static_cast<const AuditLogImpl*>(mutex_);
  std::lock_guard<std::mutex> lk(const_cast<std::mutex&>(impl->mu));
  return impl->entry_count;
}

uint64_t ImmutableAuditLog::failure_count() const {
  const auto* impl = static_cast<const AuditLogImpl*>(mutex_);
  std::lock_guard<std::mutex> lk(const_cast<std::mutex&>(impl->mu));
  return impl->failure_count;
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

namespace {
std::string g_audit_log_path;
std::atomic<bool> g_path_set{false};
ImmutableAuditLog* g_audit_log_instance = nullptr;
std::mutex g_audit_log_init_mu;
}  // namespace

void set_audit_log_path(const std::string& path) {
  std::lock_guard<std::mutex> lk(g_audit_log_init_mu);
  g_audit_log_path = path;
  g_path_set.store(true, std::memory_order_release);
}

ImmutableAuditLog& global_audit_log() {
  std::lock_guard<std::mutex> lk(g_audit_log_init_mu);
  if (!g_audit_log_instance) {
    std::string path;
    if (g_path_set.load(std::memory_order_acquire)) {
      path = g_audit_log_path;
    } else {
      // Fall back to REQUIEM_AUDIT_LOG env var.
      const char* env = std::getenv("REQUIEM_AUDIT_LOG");
      if (env && env[0]) path = env;
    }
    g_audit_log_instance = new ImmutableAuditLog(path);
  }
  return *g_audit_log_instance;
}

}  // namespace requiem
