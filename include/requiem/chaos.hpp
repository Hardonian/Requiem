#pragma once

// requiem/chaos.hpp — Chaos engineering fault injection harness.
//
// DESIGN:
//   Fault injection for resilience testing. All faults are controlled via the
//   ChaosController singleton. Production builds compile this header but the
//   controller is a no-op unless REQUIEM_CHAOS_ENABLED=1 is set at runtime.
//
// INVARIANTS:
//   - Chaos faults NEVER corrupt CAS objects (data integrity is inviolable).
//   - Chaos faults NEVER suppress error reporting (errors are always logged).
//   - Chaos faults NEVER affect result_digest computation (determinism preserved).
//   - All faults are transient — state always recovers to a valid configuration.
//   - Fault injection is guarded by feature flag 'enable_chaos_testing'.
//     Setting this flag in production is a policy violation.
//
// FAULT CATEGORIES:
//   network_partition  — simulate connectivity failure between nodes
//   cas_partial_write  — simulate CAS write that is truncated mid-stream
//   journal_corruption — simulate corrupted tail of replay journal
//   node_crash         — simulate abrupt worker process termination
//   region_latency     — inject artificial latency for cross-region operations
//   dep_mismatch       — simulate version mismatch on a cluster node
//   migration_conflict — simulate concurrent migration on the same schema
//   resource_exhausted — simulate memory/fd exhaustion for graceful degradation

#include <atomic>
#include <cstdint>
#include <functional>
#include <mutex>
#include <string>
#include <vector>

namespace requiem {
namespace chaos {

// ---------------------------------------------------------------------------
// FaultType — enumeration of injectable fault scenarios
// ---------------------------------------------------------------------------
enum class FaultType : uint8_t {
  none              = 0,
  network_partition = 1,   // connectivity loss between nodes
  cas_partial_write = 2,   // truncated CAS write
  journal_corruption = 3,  // corrupted journal tail (last N bytes invalid)
  node_crash        = 4,   // abrupt worker termination (signals SIGKILL-like)
  region_latency    = 5,   // artificial cross-region latency injection
  dep_mismatch      = 6,   // version mismatch in cluster peer announcement
  migration_conflict = 7,  // concurrent migration schema conflict
  resource_exhausted = 8,  // memory/fd exhaustion (ENOMEM / EMFILE)
};

std::string fault_type_to_string(FaultType ft);
FaultType fault_type_from_string(const std::string& s);

// ---------------------------------------------------------------------------
// FaultSpec — configuration for a single injectable fault
// ---------------------------------------------------------------------------
struct FaultSpec {
  FaultType   type{FaultType::none};
  std::string description;
  double      probability{1.0};       // 0.0–1.0; 1.0 = always inject
  uint64_t    duration_ms{0};         // 0 = instant/transient
  uint32_t    max_inject_count{0};    // 0 = unlimited during test window
  uint32_t    inject_count{0};        // current inject count (reset per run)
  bool        fail_gracefully{true};  // if true, must produce structured error (not silent)
};

// ---------------------------------------------------------------------------
// ChaosResult — outcome of a chaos fault injection
// ---------------------------------------------------------------------------
struct ChaosResult {
  bool        injected{false};       // was the fault actually injected?
  FaultType   fault_type{FaultType::none};
  std::string error_code;            // structured error code if injected
  std::string description;           // human-readable fault description
  uint64_t    duration_ms{0};        // actual fault duration
  bool        recovered{false};      // did the system recover gracefully?
  bool        cas_intact{true};      // CAS invariants still hold?
  bool        determinism_intact{true}; // determinism invariants still hold?
};

// ---------------------------------------------------------------------------
// ChaosController — singleton for chaos fault management
// ---------------------------------------------------------------------------
// Thread-safe. All methods are no-ops when !is_enabled().
// ---------------------------------------------------------------------------
class ChaosController {
 public:
  // Returns true if chaos mode is active (REQUIEM_CHAOS_ENABLED=1 && feature flag set).
  bool is_enabled() const { return enabled_.load(std::memory_order_relaxed); }

  // Activate chaos mode (only valid in test/CI environments).
  // Fails silently if called with an invalid activation key.
  void activate(const std::string& activation_key);

  // Deactivate chaos mode and reset all fault specs.
  void deactivate();

  // Register a fault spec for injection during the test window.
  void register_fault(const FaultSpec& spec);

  // Clear all registered faults.
  void clear_faults();

  // Inject a fault of the given type. Returns result describing what happened.
  // If not enabled or fault not registered, returns ChaosResult{injected=false}.
  // INVARIANT: this never corrupts CAS or suppresses errors.
  ChaosResult inject(FaultType fault_type);

  // Check if a specific fault is currently registered and would fire.
  bool would_inject(FaultType fault_type) const;

  // Returns a JSON snapshot of all registered faults and their inject counts.
  std::string status_to_json() const;

  // Global stats
  uint64_t total_injections() const;
  uint64_t total_recoveries() const;

 private:
  std::atomic<bool>        enabled_{false};
  mutable std::mutex       mu_;
  std::vector<FaultSpec>   faults_;
  std::atomic<uint64_t>    total_injections_{0};
  std::atomic<uint64_t>    total_recoveries_{0};

  static constexpr const char* ACTIVATION_KEY = "chaos-ci-only-not-production";

  FaultSpec* find_fault(FaultType ft);  // must hold mu_
};

// Singleton accessor.
ChaosController& global_chaos();

// ---------------------------------------------------------------------------
// ChaosHarness — structured chaos test runner
// ---------------------------------------------------------------------------
// Runs a suite of fault scenarios and verifies invariants after each.
// ---------------------------------------------------------------------------
struct ChaosTestCase {
  std::string name;
  FaultSpec   fault;
  std::string expected_error_code;   // empty = expect success
  bool        expect_cas_intact{true};
  bool        expect_determinism_intact{true};
};

struct ChaosRunReport {
  uint32_t    tests_run{0};
  uint32_t    tests_passed{0};
  uint32_t    tests_failed{0};
  std::string summary;
  std::vector<std::string> failures;

  std::string to_json() const;
};

class ChaosHarness {
 public:
  // Register a test case.
  void add_test(const ChaosTestCase& tc);

  // Run all registered test cases.
  // Each test: inject fault, run workload_fn, check invariants.
  ChaosRunReport run(std::function<ChaosResult(const FaultSpec&)> workload_fn);

  // Standard test suite for the Requiem engine.
  // Returns a pre-populated harness with all standard fault scenarios.
  static ChaosHarness standard_suite();

 private:
  std::vector<ChaosTestCase> tests_;
};

// ---------------------------------------------------------------------------
// Chaos scenario implementations — callable from test harnesses
// ---------------------------------------------------------------------------

// Simulate node crash mid-execution: triggers SIGABRT in test process.
// Returns structured error; never corrupts CAS.
ChaosResult simulate_node_crash();

// Simulate partial CAS write: writes only the first N bytes of an object.
// Returns error; CAS integrity check must detect and reject.
ChaosResult simulate_cas_partial_write(const std::string& cas_path, size_t truncate_at);

// Simulate corrupted journal tail: appends garbage bytes to replay journal.
// Returns error; replay verification must detect and reject.
ChaosResult simulate_journal_corruption(const std::string& journal_path, size_t corrupt_bytes);

// Simulate network partition: marks all cluster peers as unreachable.
// Returns error; cluster must enter degraded-but-safe mode.
ChaosResult simulate_network_partition(uint64_t duration_ms);

// Simulate region latency: injects artificial sleep in cross-region paths.
// Must not affect result_digest or determinism.
ChaosResult simulate_region_latency(uint64_t latency_ms);

// Simulate dependency mismatch: registers a peer with wrong engine_abi_version.
// Cluster must reject the peer and emit version_mismatch error.
ChaosResult simulate_dep_mismatch(uint32_t bad_abi_version);

// Simulate migration conflict: two concurrent schema migrations on same version.
// Migration lock must prevent double-application.
ChaosResult simulate_migration_conflict();

// Simulate resource exhaustion: attempts to allocate beyond available memory.
// Must fail gracefully with resource_exhausted error, not crash.
ChaosResult simulate_resource_exhaustion();

}  // namespace chaos
}  // namespace requiem
