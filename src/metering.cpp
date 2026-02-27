#include "requiem/metering.hpp"

#include <chrono>
#include <map>

namespace requiem {

// ---------------------------------------------------------------------------
// BillingBehavior helpers
// ---------------------------------------------------------------------------

std::string to_string(BillingBehavior b) {
  switch (b) {
    case BillingBehavior::charge:       return "charge";
    case BillingBehavior::no_charge:    return "no_charge";
    case BillingBehavior::charge_quota: return "charge_quota";
  }
  return "no_charge";
}

// Explicit billing rules per error code.
// Default: no_charge.  Successful execution (empty error_code): charge.
BillingBehavior billing_behavior_for_error(const std::string& error_code) {
  if (error_code.empty()) return BillingBehavior::charge;
  // Timeout: resource was consumed — charge (configurable, default no_charge here).
  if (error_code == "timeout") return BillingBehavior::no_charge;
  // CAS integrity failure: internal fault — no charge.
  if (error_code == "cas_integrity_failed") return BillingBehavior::no_charge;
  // Quota exceeded: client error — no charge.
  if (error_code == "quota_exceeded") return BillingBehavior::no_charge;
  // Daemon crash (spawn_failed): internal fault — no charge.
  if (error_code == "spawn_failed") return BillingBehavior::no_charge;
  // Hash unavailable: internal fault — no charge.
  if (error_code == "hash_unavailable_blake3") return BillingBehavior::no_charge;
  // Path escape: client error — no charge.
  if (error_code == "path_escape") return BillingBehavior::no_charge;
  // Replay/drift: internal fault — no charge.
  if (error_code == "replay_failed") return BillingBehavior::no_charge;
  if (error_code == "drift_detected") return BillingBehavior::no_charge;
  return BillingBehavior::no_charge;
}

// ---------------------------------------------------------------------------
// MeterLog implementation
// ---------------------------------------------------------------------------

void MeterLog::emit(const MeterEvent& event) {
  // INVARIANT: shadow runs must never enter the meter log.
  if (event.is_shadow) return;
  std::lock_guard<std::mutex> lock(mu_);
  events_.push_back(event);
}

std::vector<MeterEvent> MeterLog::snapshot() const {
  std::lock_guard<std::mutex> lock(mu_);
  return events_;
}

std::size_t MeterLog::count_primary_success(const std::string& tenant_id) const {
  std::lock_guard<std::mutex> lock(mu_);
  std::size_t count = 0;
  for (const auto& e : events_) {
    if (e.is_shadow) continue;
    if (!e.success) continue;
    if (!tenant_id.empty() && e.tenant_id != tenant_id) continue;
    ++count;
  }
  return count;
}

std::size_t MeterLog::count_shadow() const {
  // By invariant, shadow events never enter the log — this must always return 0.
  std::lock_guard<std::mutex> lock(mu_);
  std::size_t count = 0;
  for (const auto& e : events_) {
    if (e.is_shadow) ++count;
  }
  return count;
}

std::vector<std::string> MeterLog::find_duplicates() const {
  std::lock_guard<std::mutex> lock(mu_);
  std::map<std::string, int> seen;
  for (const auto& e : events_) {
    if (!e.is_shadow && e.success && !e.request_digest.empty()) {
      seen[e.request_digest]++;
    }
  }
  std::vector<std::string> dups;
  for (const auto& [digest, count] : seen) {
    if (count > 1) dups.push_back(digest);
  }
  return dups;
}

std::string MeterLog::verify_parity(std::size_t expected_primary_success) const {
  const std::size_t shadow_count  = count_shadow();
  const std::size_t primary_count = count_primary_success();
  const auto        dups          = find_duplicates();

  // Shadow events must be zero — enforced at emit site.
  if (shadow_count != 0) {
    return "FAIL shadow_in_meter_log: count=" + std::to_string(shadow_count);
  }
  // Primary success count must match executions.
  if (primary_count != expected_primary_success) {
    return "FAIL primary_count_mismatch: expected=" + std::to_string(expected_primary_success) +
           " actual=" + std::to_string(primary_count);
  }
  // No duplicate billing (idempotency via request_digest).
  if (!dups.empty()) {
    return "FAIL duplicate_billing: first_dup=" + dups[0];
  }
  return "";  // pass
}

void MeterLog::clear() {
  std::lock_guard<std::mutex> lock(mu_);
  events_.clear();
}

// ---------------------------------------------------------------------------
// Module-level API
// ---------------------------------------------------------------------------

MeterLog& global_meter() {
  static MeterLog inst;
  return inst;
}

void emit_meter_event(const MeterEvent& event) {
  global_meter().emit(event);
}

MeterEvent make_meter_event(
    const std::string& tenant_id,
    const std::string& request_id,
    const std::string& request_digest,
    bool               success,
    const std::string& error_code,
    bool               is_shadow) {
  MeterEvent e;
  e.tenant_id      = tenant_id;
  e.request_id     = request_id;
  e.request_digest = request_digest;
  e.success        = success;
  e.error_code     = error_code;
  e.is_shadow      = is_shadow;
  // Billing rule: charge only if (not shadow) AND (success == true).
  // A non-zero exit code with empty error_code (e.g. execve returns 127)
  // is still a failed execution — must not charge.
  e.billing = is_shadow  ? BillingBehavior::no_charge
            : !success   ? BillingBehavior::no_charge
                         : billing_behavior_for_error(error_code);
  // Monotonic ns timestamp for ordering.
  e.timestamp_ns = static_cast<uint64_t>(
      std::chrono::duration_cast<std::chrono::nanoseconds>(
          std::chrono::steady_clock::now().time_since_epoch())
          .count());
  return e;
}

}  // namespace requiem
