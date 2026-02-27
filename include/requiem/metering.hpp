#pragma once

// requiem/metering.hpp — Billing/metering contract enforcement.
//
// Exactly-once semantics for primary executions:
//   - One meter event per successful PRIMARY execution.
//   - ZERO meter events for shadow runs (enforced at emit site, not caller).
//   - Deterministic failure categorization with explicit billing rules.
//
// Hash primitive: BLAKE3 (request_digest used as billing idempotency key).
// No secret leakage: tenant_id and request_id are safe to log; result content is not.

#include <cstdint>
#include <map>
#include <mutex>
#include <string>
#include <vector>

namespace requiem {

// Billing categorization for failed executions.
// Explicit — no implicit billing on failure.
enum class BillingBehavior {
  charge,       // successful primary execution: emit one meter event
  no_charge,    // failed execution: no meter event
  charge_quota, // quota/rate-limit errors charged as failed request (configurable)
};

std::string to_string(BillingBehavior b);
BillingBehavior billing_behavior_for_error(const std::string& error_code);

struct MeterEvent {
  std::string tenant_id;
  std::string request_id;
  std::string request_digest;  // BLAKE3 idempotency key — prevents double-billing on retry
  uint64_t    timestamp_ns{0};
  bool        is_shadow{false};  // shadow runs must NEVER appear in meter log
  bool        success{false};
  std::string error_code;
  BillingBehavior billing{BillingBehavior::no_charge};
};

// Thread-safe metering log with exactly-once emission guarantee.
// Primary execution path:  emit() → events_
// Shadow execution path:   emit() → no-op (is_shadow check at emit site)
class MeterLog {
 public:
  // Emit one meter event. No-op if event.is_shadow == true.
  void emit(const MeterEvent& event);

  // Snapshot all events (under lock).
  std::vector<MeterEvent> snapshot() const;

  // Count successful primary events, optionally filtered by tenant.
  std::size_t count_primary_success(const std::string& tenant_id = "") const;

  // Count shadow events — must always be 0.
  std::size_t count_shadow() const;

  // Detect duplicate request_digests (double-billing on retry).
  std::vector<std::string> find_duplicates() const;

  // Verify parity: expected_primary_success events, 0 shadow events, no duplicates.
  // Returns "" on pass, error description on fail.
  std::string verify_parity(std::size_t expected_primary_success) const;

  void clear();

 private:
  mutable std::mutex       mu_;
  std::vector<MeterEvent>  events_;
};

// Global meter log (used by harnesses and emit_meter_event).
MeterLog& global_meter();

// Emit a meter event to the global log.
// Shadow-safe: is_shadow=true is a guaranteed no-op.
void emit_meter_event(const MeterEvent& event);

// Build a meter event from execution results.
MeterEvent make_meter_event(
    const std::string& tenant_id,
    const std::string& request_id,
    const std::string& request_digest,
    bool               success,
    const std::string& error_code,
    bool               is_shadow);

}  // namespace requiem
