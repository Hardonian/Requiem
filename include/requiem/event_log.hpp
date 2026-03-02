#pragma once

// requiem/event_log.hpp — Immutable, prev-hash chained event log.
//
// KERNEL_SPEC §4: The EventLog is the immutable, append-only audit trail.
// Each entry carries prev_hash = H("evt:", canonical_json(previous_entry)).
//
// INVARIANTS:
//   INV-CHAIN: Every entry's prev must equal H("evt:", previous_entry_json).
//   INV-NO-WALLCLOCK: Kernel uses logical time only. Wall-clock is metadata.
//
// This module supersedes the existing ImmutableAuditLog with proper
// prev-hash chain verification and logical time enforcement.

#include <cstdint>
#include <functional>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

namespace requiem {

// A single event record in the log.
struct EventRecord {
  uint64_t seq{0};          // Monotonic logical sequence number
  std::string prev;         // H("evt:", canonical_json(previous_record))
  uint64_t ts_logical{0};   // Monotonic logical time (incremented per event)
  std::string event_type;   // e.g. "exec.complete", "cap.mint"
  std::string actor;        // Capability fingerprint of the actor
  std::string data_hash;    // H of event-specific data (stored in CAS)
  std::string execution_id; // Request digest (for exec events)
  std::string tenant_id;
  std::string request_digest;
  std::string result_digest;
  std::string engine_semver;
  uint32_t engine_abi_version{0};
  uint32_t hash_algorithm_version{0};
  uint32_t cas_format_version{0};
  bool replay_verified{false};
  bool ok{false};
  std::string error_code;
  uint64_t duration_ns{0};
  uint64_t timestamp_unix_ms{0}; // Wall-clock metadata (NOT used in chain hash)
  std::string worker_id;
  std::string node_id;
};

// Serialize an EventRecord to canonical JSON (for hashing and storage).
std::string event_record_to_json(const EventRecord &record);

// Compute the chain hash for an event record.
// chain_hash = H("evt:", event_record_to_json(record))
std::string event_record_chain_hash(const EventRecord &record);

// Verification result for a single event.
struct EventVerifyResult {
  uint64_t seq{0};
  bool ok{false};
  std::string error; // Empty if ok
};

// Verification result for the entire log.
struct LogVerifyResult {
  bool ok{false};
  uint64_t total_events{0};
  uint64_t verified_events{0};
  std::vector<EventVerifyResult> failures;
};

// EventLog — append-only, prev-hash chained event log.
//
// Thread-safe: uses internal mutex for concurrent appends.
// Each write is crash-safe (append + flush).
class EventLog {
public:
  // path: filesystem path to the event log file. Created if absent.
  explicit EventLog(const std::string &path = "");
  ~EventLog();

  // Append an event record. Assigns seq, ts_logical, and prev automatically.
  // Returns the assigned sequence number, or 0 on failure.
  uint64_t append(EventRecord &record);

  // Read all events from the log file.
  std::vector<EventRecord> read_all() const;

  // Read a single event by sequence number.
  std::optional<EventRecord> read(uint64_t seq) const;

  // Verify the entire chain from genesis.
  LogVerifyResult verify() const;

  // Current logical time (= number of events appended).
  uint64_t logical_time() const;

  // Head digest (prev-hash of the latest event).
  std::string head_digest() const;

  // Path this log writes to.
  const std::string &path() const { return path_; }

private:
  std::string path_;
  void *file_{nullptr};
  mutable std::mutex mu_;
  uint64_t seq_{0};
  uint64_t logical_time_{0};
  std::string last_digest_;

  // Genesis prev is 64 zero hex chars.
  static constexpr const char *kGenesisPrev =
      "0000000000000000000000000000000000000000000000000000000000000000";
};

// Global event log singleton.
EventLog &global_event_log();
void set_event_log_path(const std::string &path);

} // namespace requiem
