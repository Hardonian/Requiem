#pragma once

// requiem/economics.hpp — Economic layer: metering units, quotas, and rate limiting.
//
// DESIGN:
//   Extends the base metering layer (metering.hpp) with structured resource units
//   for per-tenant accounting. The economic layer is OBSERVATIONAL ONLY by default
//   (feature flag `enable_economic_quotas` gates hard enforcement).
//
// UNIT DEFINITIONS:
//   compute_units  — 1 unit = 1ms of CPU wall time used by the sandbox executor
//   memory_units   — 1 unit = 1 MB·second of peak RSS during execution
//   cas_io_units   — 1 unit = 1 CAS object read or write operation
//   replay_units   — 1 unit = 1 complete replay verification cycle
//   storage_units  — 1 unit = 1 MB stored in CAS (per object, not per read)
//   network_units  — 1 unit = 1 KB of cross-node or cross-region data transfer
//
// INVARIANTS:
//   1. Unit accounting NEVER affects result_digest or execution determinism.
//   2. Shadow runs are NEVER metered (same rule as billing layer).
//   3. Quota enforcement only blocks new submissions — never aborts in-flight.
//   4. All quota checks are logged to the audit stream.
//   5. dry-run cost estimation must not alter any stored state.

#include <cstdint>
#include <mutex>
#include <string>
#include <unordered_map>

namespace requiem {
namespace economics {

// ---------------------------------------------------------------------------
// ResourceUnits — resource consumption record for one execution
// ---------------------------------------------------------------------------
struct ResourceUnits {
  uint64_t compute_units{0};   // CPU wall-time ms
  uint64_t memory_units{0};    // MB·second peak RSS
  uint64_t cas_io_units{0};    // CAS read + write ops
  uint64_t replay_units{0};    // replay verification cycles
  uint64_t storage_units{0};   // MB stored (new objects only)
  uint64_t network_units{0};   // KB cross-node transfer
};

// Serialize to compact JSON.
std::string resource_units_to_json(const ResourceUnits& u);

// ---------------------------------------------------------------------------
// TenantQuota — per-tenant limits (null = unlimited)
// ---------------------------------------------------------------------------
// Loaded from policy/default.policy.json:tenant.default_quota.
// Per-tenant overrides can be set via the admin API.
// ---------------------------------------------------------------------------
struct TenantQuota {
  // Hourly rate limits (0 = unlimited)
  uint64_t compute_units_per_hour{0};
  uint64_t memory_units_per_hour{0};
  uint64_t cas_io_units_per_hour{0};
  uint64_t replay_units_per_hour{0};
  uint64_t network_units_per_hour{0};
  // Total storage cap (0 = unlimited)
  uint64_t storage_units_total{0};

  // Budget cap: max total compute_units before hard stop (0 = no cap)
  uint64_t budget_cap_compute_units{0};

  bool is_unlimited() const {
    return compute_units_per_hour == 0 &&
           memory_units_per_hour  == 0 &&
           cas_io_units_per_hour  == 0 &&
           replay_units_per_hour  == 0 &&
           storage_units_total    == 0 &&
           budget_cap_compute_units == 0;
  }

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// TenantUsageSummary — current usage window for a tenant
// ---------------------------------------------------------------------------
struct TenantUsageSummary {
  std::string tenant_id;
  std::string window_start_iso;   // ISO-8601 start of current hourly window
  std::string window_end_iso;

  // Current window usage
  uint64_t compute_units_used{0};
  uint64_t memory_units_used{0};
  uint64_t cas_io_units_used{0};
  uint64_t replay_units_used{0};
  uint64_t network_units_used{0};
  uint64_t storage_units_total_used{0};

  // Quota limits (from TenantQuota)
  TenantQuota quota;

  // Derived: percentage used per dimension (0–100+; >100 = exceeded)
  double compute_pct() const;
  double storage_pct() const;

  bool any_quota_exceeded() const;

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// QuotaCheckResult — outcome of a pre-execution quota check
// ---------------------------------------------------------------------------
struct QuotaCheckResult {
  bool     allowed{true};           // true if execution may proceed
  bool     quota_enforced{false};   // false if observe-only mode
  std::string rejection_reason;     // empty if allowed
  std::string error_code;           // "quota_exceeded" | "rate_limited" | ""
  TenantUsageSummary current_usage;

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// CostEstimate — dry-run cost estimate for a proposed execution
// ---------------------------------------------------------------------------
// Does NOT alter any stored state. Returns projected unit consumption.
struct CostEstimate {
  std::string tenant_id;
  ResourceUnits estimated_units;
  bool         would_exceed_quota{false};
  std::string  exceeded_dimension;   // which quota would be violated, if any
  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// EconomicMeter — thread-safe per-tenant unit accumulation
// ---------------------------------------------------------------------------
// Singleton accessed via global_economic_meter().
// Accumulates ResourceUnits from each execution.
// Never modifies execution logic.
// ---------------------------------------------------------------------------
class EconomicMeter {
 public:
  // Record resource usage for a completed execution.
  // is_shadow must be false (caller's responsibility).
  // INVARIANT: shadow runs must never be passed here.
  void record(const std::string& tenant_id, const ResourceUnits& units, bool is_shadow);

  // Return current usage summary for a tenant (within current hour window).
  TenantUsageSummary usage_summary(const std::string& tenant_id) const;

  // Check whether a tenant's next execution is allowed under their quota.
  // If enable_economic_quotas flag is off: always returns allowed=true.
  QuotaCheckResult check_quota(const std::string& tenant_id,
                               const TenantQuota&  quota) const;

  // Produce a dry-run cost estimate without modifying state.
  CostEstimate estimate_cost(const std::string& tenant_id,
                             const ResourceUnits& projected,
                             const TenantQuota&   quota) const;

  // Set per-tenant quota override (admin operation).
  void set_quota(const std::string& tenant_id, const TenantQuota& quota);

  // Get per-tenant quota (falls back to default).
  TenantQuota get_quota(const std::string& tenant_id) const;

  // Set the global default quota (loaded from policy at startup).
  void set_default_quota(const TenantQuota& quota);

  // Serialize all tenant usage to compact JSON array.
  std::string all_usage_to_json() const;

  // Reset usage counters for a tenant (admin / test use only).
  void reset_tenant(const std::string& tenant_id);

  // Whether hard quota enforcement is active (requires feature flag).
  bool enforcement_active() const { return enforcement_active_; }
  void set_enforcement(bool active) { enforcement_active_ = active; }

 private:
  mutable std::mutex mu_;
  std::unordered_map<std::string, ResourceUnits>  usage_by_tenant_;
  std::unordered_map<std::string, TenantQuota>    quota_by_tenant_;
  TenantQuota   default_quota_;
  bool          enforcement_active_{false};

  // Current window start (reset hourly).
  uint64_t window_start_unix_s_{0};

  void maybe_rotate_window();  // called under mu_
};

// Singleton accessor.
EconomicMeter& global_economic_meter();

// ---------------------------------------------------------------------------
// Helpers for computing resource units from execution metadata
// ---------------------------------------------------------------------------

// Estimate compute_units from wall-time duration.
// 1 compute_unit = 1ms of wall time.
inline uint64_t compute_units_from_duration_ms(uint64_t duration_ms) {
  return duration_ms;
}

// Estimate memory_units from peak RSS and duration.
// 1 memory_unit = 1 MB·second (peak_rss_mb * duration_s).
inline uint64_t memory_units_from_rss(uint64_t peak_rss_mb, uint64_t duration_ms) {
  return (peak_rss_mb * duration_ms) / 1000;  // MB·second
}

}  // namespace economics
}  // namespace requiem
