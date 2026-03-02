#include "requiem/event_log.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/version.hpp"

#include <atomic>
#include <chrono>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <sstream>

namespace requiem {

// ---------------------------------------------------------------------------
// EventRecord serialization (canonical JSON for chain hashing)
// ---------------------------------------------------------------------------

std::string event_record_to_json(const EventRecord &r) {
  // Canonical JSON: keys sorted lexicographically.
  // Using jsonlite::Object (std::map) guarantees sorted keys.
  jsonlite::Object obj;
  obj["actor"] = r.actor;
  obj["cas_format_version"] = static_cast<uint64_t>(r.cas_format_version);
  obj["data_hash"] = r.data_hash;
  obj["duration_ns"] = r.duration_ns;
  obj["engine_abi_version"] = static_cast<uint64_t>(r.engine_abi_version);
  obj["engine_semver"] = r.engine_semver;
  obj["error_code"] = r.error_code;
  obj["event_type"] = r.event_type;
  obj["execution_id"] = r.execution_id;
  obj["hash_algorithm_version"] =
      static_cast<uint64_t>(r.hash_algorithm_version);
  obj["node_id"] = r.node_id;
  obj["ok"] = r.ok;
  obj["prev"] = r.prev;
  obj["replay_verified"] = r.replay_verified;
  obj["request_digest"] = r.request_digest;
  obj["result_digest"] = r.result_digest;
  obj["seq"] = r.seq;
  obj["tenant_id"] = r.tenant_id;
  obj["ts_logical"] = r.ts_logical;
  obj["worker_id"] = r.worker_id;

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string event_record_chain_hash(const EventRecord &record) {
  return hash_domain("evt:", event_record_to_json(record));
}

// ---------------------------------------------------------------------------
// EventLog implementation
// ---------------------------------------------------------------------------

EventLog::EventLog(const std::string &path) : path_(path) {
  last_digest_ = kGenesisPrev;

  if (!path_.empty()) {
    // Ensure parent directory exists.
    std::filesystem::path p(path_);
    if (p.has_parent_path()) {
      std::error_code ec;
      std::filesystem::create_directories(p.parent_path(), ec);
    }

    // Read existing events to recover sequence and chain state.
    std::ifstream ifs(path_);
    if (ifs.good()) {
      std::string line;
      while (std::getline(ifs, line)) {
        if (line.empty())
          continue;
        // Parse the record to rebuild seq and last_digest.
        auto parsed_obj = jsonlite::parse(line, nullptr);
        uint64_t seq = jsonlite::get_u64(parsed_obj, "seq", 0);
        if (seq > seq_) {
          seq_ = seq;
          logical_time_ = jsonlite::get_u64(parsed_obj, "ts_logical", seq);
          // Re-compute chain hash from the stored record.
          last_digest_ = hash_domain("evt:", line);
        }
      }
    }

    // Open for append.
    file_ = std::fopen(path_.c_str(), "a");
  }
}

EventLog::~EventLog() {
  if (file_) {
    std::fclose(static_cast<FILE *>(file_));
    file_ = nullptr;
  }
}

uint64_t EventLog::append(EventRecord &record) {
  std::lock_guard<std::mutex> lk(mu_);

  // Assign sequence and logical time.
  record.seq = ++seq_;
  record.ts_logical = ++logical_time_;
  record.prev = last_digest_;

  // Populate version fields.
  record.engine_abi_version = version::ENGINE_ABI_VERSION;
  record.hash_algorithm_version = version::HASH_ALGORITHM_VERSION;
  record.cas_format_version = version::CAS_FORMAT_VERSION;

  // Stamp wall-clock timestamp (metadata only, not in chain hash inputs).
  using SC = std::chrono::system_clock;
  record.timestamp_unix_ms = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          SC::now().time_since_epoch())
          .count());

  // Serialize to canonical JSON.
  const std::string json = event_record_to_json(record);

  // Update chain hash.
  last_digest_ = hash_domain("evt:", json);

  // Write to file.
  if (file_) {
    const std::string final_line = json + "\n";
    const bool written =
        (std::fwrite(final_line.data(), 1, final_line.size(),
                     static_cast<FILE *>(file_)) == final_line.size());
    std::fflush(static_cast<FILE *>(file_));
    if (!written)
      return 0;
  }

  return record.seq;
}

std::vector<EventRecord> EventLog::read_all() const {
  std::lock_guard<std::mutex> lk(mu_);
  std::vector<EventRecord> events;

  if (path_.empty())
    return events;

  std::ifstream ifs(path_);
  if (!ifs.good())
    return events;

  std::string line;
  while (std::getline(ifs, line)) {
    if (line.empty())
      continue;
    auto obj = jsonlite::parse(line, nullptr);

    EventRecord r;
    r.seq = jsonlite::get_u64(obj, "seq", 0);
    r.prev = jsonlite::get_string(obj, "prev", "");
    r.ts_logical = jsonlite::get_u64(obj, "ts_logical", 0);
    r.event_type = jsonlite::get_string(obj, "event_type", "");
    r.actor = jsonlite::get_string(obj, "actor", "");
    r.data_hash = jsonlite::get_string(obj, "data_hash", "");
    r.execution_id = jsonlite::get_string(obj, "execution_id", "");
    r.tenant_id = jsonlite::get_string(obj, "tenant_id", "");
    r.request_digest = jsonlite::get_string(obj, "request_digest", "");
    r.result_digest = jsonlite::get_string(obj, "result_digest", "");
    r.engine_semver = jsonlite::get_string(obj, "engine_semver", "");
    r.engine_abi_version =
        static_cast<uint32_t>(jsonlite::get_u64(obj, "engine_abi_version", 0));
    r.hash_algorithm_version = static_cast<uint32_t>(
        jsonlite::get_u64(obj, "hash_algorithm_version", 0));
    r.cas_format_version =
        static_cast<uint32_t>(jsonlite::get_u64(obj, "cas_format_version", 0));
    r.replay_verified = jsonlite::get_bool(obj, "replay_verified", false);
    r.ok = jsonlite::get_bool(obj, "ok", false);
    r.error_code = jsonlite::get_string(obj, "error_code", "");
    r.duration_ns = jsonlite::get_u64(obj, "duration_ns", 0);
    r.worker_id = jsonlite::get_string(obj, "worker_id", "");
    r.node_id = jsonlite::get_string(obj, "node_id", "");

    events.push_back(std::move(r));
  }

  return events;
}

std::optional<EventRecord> EventLog::read(uint64_t seq) const {
  auto events = read_all();
  for (const auto &e : events) {
    if (e.seq == seq)
      return e;
  }
  return std::nullopt;
}

LogVerifyResult EventLog::verify() const {
  LogVerifyResult result;
  auto events = read_all();
  result.total_events = events.size();

  std::string expected_prev(kGenesisPrev);

  for (const auto &e : events) {
    EventVerifyResult vr;
    vr.seq = e.seq;

    if (e.prev != expected_prev) {
      vr.ok = false;
      vr.error =
          "prev_hash_mismatch: expected=" + expected_prev + " actual=" + e.prev;
      result.failures.push_back(vr);
    } else {
      vr.ok = true;
      ++result.verified_events;
    }

    // Compute the chain hash for this record.
    expected_prev = event_record_chain_hash(e);
  }

  result.ok = result.failures.empty();
  return result;
}

uint64_t EventLog::logical_time() const {
  std::lock_guard<std::mutex> lk(mu_);
  return logical_time_;
}

std::string EventLog::head_digest() const {
  std::lock_guard<std::mutex> lk(mu_);
  return last_digest_;
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

namespace {
std::string g_event_log_path;
std::atomic<bool> g_event_log_path_set{false};
EventLog *g_event_log_instance = nullptr;
std::mutex g_event_log_init_mu;
} // namespace

void set_event_log_path(const std::string &path) {
  std::lock_guard<std::mutex> lk(g_event_log_init_mu);
  g_event_log_path = path;
  g_event_log_path_set.store(true, std::memory_order_release);
}

EventLog &global_event_log() {
  std::lock_guard<std::mutex> lk(g_event_log_init_mu);
  if (!g_event_log_instance) {
    std::string path;
    if (g_event_log_path_set.load(std::memory_order_acquire)) {
      path = g_event_log_path;
    } else {
      const char *env = std::getenv("REQUIEM_EVENT_LOG");
      if (env && env[0])
        path = env;
    }
    g_event_log_instance = new EventLog(path);
  }
  return *g_event_log_instance;
}

} // namespace requiem
