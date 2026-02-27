#pragma once

// requiem/multiregion.hpp — Multi-region replication scaffold.
//
// DESIGN:
//   Each engine node belongs to exactly one region. CAS objects replicate
//   to secondary regions by digest (immutable: same digest = same bytes).
//   Cross-region replay verification confirms determinism equivalence.
//
// INVARIANTS:
//   1. CAS replication is immutable by hash: if a digest exists in both regions,
//      the content must be byte-for-byte identical (CAS-INV-1 across regions).
//   2. Replay equivalence must hold across regions: same request_digest must
//      produce same result_digest regardless of which region executes it.
//   3. region_id is stamped on every provenance record and audit log entry.
//   4. Cross-region replay divergence is treated as a P1 incident trigger.
//   5. The primary region is authoritative for shard routing; secondaries are
//      read replicas until promoted.
//
// EXTENSION_POINT: external_region_coordinator
//   Current: in-process registry with static region config.
//   Upgrade: replace with a geo-distributed coordinator (e.g., Cloudflare
//   Workers KV or etcd with geographic replication) for live region discovery.

#include <chrono>
#include <cstdint>
#include <mutex>
#include <string>
#include <vector>

namespace requiem {
namespace multiregion {

// ---------------------------------------------------------------------------
// RegionConfig — static configuration for one region
// ---------------------------------------------------------------------------
struct RegionConfig {
  std::string region_id;          // e.g. "us-east-1", "eu-west-1"
  std::string display_name;       // e.g. "US East (N. Virginia)"
  std::string cas_root;           // filesystem path or S3 bucket prefix for this region's CAS
  bool        is_primary{false};  // true = authoritative for shard routing
  bool        accept_writes{true};
  bool        accept_reads{true};
  uint32_t    replication_lag_warning_ms{5000};  // warn if lag exceeds this

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// RegionStatus — runtime health of one region
// ---------------------------------------------------------------------------
struct RegionStatus {
  std::string region_id;
  bool        reachable{true};
  uint64_t    last_heartbeat_unix_ms{0};
  uint64_t    cas_objects_count{0};
  double      replication_lag_ms{0.0};   // -1.0 = unknown
  uint32_t    replay_verifications{0};
  uint32_t    replay_divergences{0};
  double      replay_drift_rate{-1.0};  // -1.0 = no data yet

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// ReplicationRecord — one CAS object replication event
// ---------------------------------------------------------------------------
struct ReplicationRecord {
  std::string digest;              // BLAKE3 hex digest of the object
  std::string source_region_id;
  std::string dest_region_id;
  std::string replicated_at_iso;
  bool        verified{false};    // digest was re-computed at dest and matched
  std::string error;              // non-empty on failure
};

// ---------------------------------------------------------------------------
// CrossRegionReplayResult — result of cross-region replay equivalence check
// ---------------------------------------------------------------------------
struct CrossRegionReplayResult {
  bool        equivalent{true};
  std::string request_digest;
  std::string region_a;
  std::string region_b;
  std::string result_digest_a;
  std::string result_digest_b;
  std::string checked_at_iso;
  std::string error;   // non-empty if check could not complete

  std::string to_json() const;
};

// ---------------------------------------------------------------------------
// RegionRegistry — tracks all configured regions and their status
// ---------------------------------------------------------------------------
// Thread-safe. Singleton accessed via global_region_registry().
// ---------------------------------------------------------------------------
class RegionRegistry {
 public:
  // Register a region from config. Idempotent by region_id.
  void register_region(const RegionConfig& config);

  // Get config for the local region (set via REQUIEM_REGION_ID env var).
  RegionConfig local_region() const;

  // Get all region configs.
  std::vector<RegionConfig> all_regions() const;

  // Update status for a region (heartbeat, replication lag, drift rate).
  void update_status(const std::string& region_id, const RegionStatus& status);

  // Get current status snapshot for all regions.
  std::vector<RegionStatus> all_statuses() const;

  // Serialize all region statuses to JSON array (for /api/cluster/regions).
  std::string regions_to_json() const;

  // Record a replication event.
  void record_replication(const ReplicationRecord& rec);

  // Record a cross-region replay verification result.
  void record_replay_check(const CrossRegionReplayResult& result);

  // Returns true if cross-region replay equivalence holds for all recent checks.
  bool replay_equivalence_ok() const;

  // Number of regions with reachable=true.
  uint32_t reachable_count() const;

 private:
  mutable std::mutex         mu_;
  std::vector<RegionConfig>  configs_;
  std::vector<RegionStatus>  statuses_;
  std::vector<ReplicationRecord>       replications_;
  std::vector<CrossRegionReplayResult> replay_checks_;
  std::string local_region_id_;

  int find_config_index(const std::string& region_id) const;
  int find_status_index(const std::string& region_id) const;
};

// Singleton accessor.
RegionRegistry& global_region_registry();

// Initialize region registry from environment:
//   REQUIEM_REGION_ID      — this node's region ID (default: "default")
//   REQUIEM_PRIMARY_REGION — primary region ID (default: "default")
void init_regions_from_env();

}  // namespace multiregion
}  // namespace requiem
