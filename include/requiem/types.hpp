#pragma once

// requiem/types.hpp — Core data structures for the Requiem deterministic execution engine.
//
// ARCHITECTURE NOTES (Phase 0 — Repo Truth Extraction):
//
// DETERMINISM GUARANTEES:
//   - ExecutionRequest canonicalization is deterministic: same inputs → same canonical JSON
//     → same request_digest. This is tested by verify_determinism.sh (200x repeat gate).
//   - ExecPolicy.required_env injects PYTHONHASHSEED=0 unconditionally, preventing Python
//     hash randomization from leaking into outputs.
//   - time_mode="fixed_zero" suppresses wall-clock injection into child processes.
//
// DETERMINISM ASSUMPTIONS (not yet proven, only assumed):
//   - Filesystem ordering of scan_objects() is NOT guaranteed deterministic on all filesystems.
//     Future: sort by digest after scan. EXTENSION_POINT: deterministic_directory_iteration
//   - Output file hashing order follows request.outputs vector order (deterministic: good).
//
// CONCURRENCY NOTES:
//   - ExecutionRequest/ExecutionResult are value types — no shared state per execution.
//   - ExecPolicy.env_denylist is read-only after construction — safe for concurrent reads.
//   - Global MeterLog (metering.hpp) uses a mutex — sharding candidate for high throughput.
//     EXTENSION_POINT: sharded_meter_log
//
// MEMORY OWNERSHIP:
//   - All string members are value-owned. No borrowed references.
//   - execute() returns ExecutionResult by value. Caller owns it.
//   - No raw pointer members in any public API type.
//
// EXTENSION_POINT: allocator_strategy
//   Current: all allocations use the default system allocator.
//   Upgrade path: replace with per-execution arena allocators to:
//     1. Eliminate fragmentation in long-running daemon mode.
//     2. Enable O(1) teardown (bulk-free the arena after each execution).
//     3. Improve cache locality by keeping execution state contiguous.
//   Invariant to preserve: ExecutionResult must be fully owned (no arena-internal pointers
//   escape to the caller). Use a copy-on-return strategy.

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

namespace requiem {

enum class ErrorCode {
  none,
  json_parse_error,
  json_duplicate_key,
  path_escape,
  missing_input,
  spawn_failed,
  timeout,
  cas_integrity_failed,
  replay_failed,
  drift_detected,
  hash_unavailable_blake3,
  sandbox_unavailable,
  quota_exceeded,
};

std::string to_string(ErrorCode code);

// Sandbox capabilities detected at runtime
struct SandboxCapabilities {
  bool workspace_confinement{false};
  bool rlimits_cpu{false};
  bool rlimits_mem{false};
  bool rlimits_fds{false};
  bool seccomp_baseline{false};
  bool job_objects{false};
  bool restricted_token{false};
  bool process_mitigations{false};

  // EXTENSION_POINT: seccomp_profile
  // Current: seccomp_baseline is always false (not implemented).
  // Upgrade path: add seccomp-bpf profile loading and apply via PR_SET_SECCOMP.
  // Landlock LSM for path-based sandboxing is also a candidate here.
  // Invariant: capability detection must never throw — uses error_code paths.

  std::vector<std::string> enforced() const;
  std::vector<std::string> unsupported() const;
};

SandboxCapabilities detect_sandbox_capabilities();

// ---------------------------------------------------------------------------
// HashEnvelope — Phase 2: Versioned hash schema
// ---------------------------------------------------------------------------
// Wraps a BLAKE3 digest with version metadata to enable future algorithm
// upgrades without silent compatibility breaks.
//
// EXTENSION_POINT: hash_algorithm_upgrade
//   Current: hash_version=1, algorithm="blake3", BLAKE3_OUT_LEN=32 bytes.
//   Upgrade path: increment hash_version and update algorithm[] when migrating.
//   Invariant: ALL components that verify digests must check hash_version first.
//   Migration strategy: dual-verify during transition window, then cut over.
//
// Memory layout: fixed-size, copyable, no heap allocation. Safe for C ABI crossing.
struct HashEnvelope {
  uint32_t hash_version{1};          // Bump when algorithm changes
  char     algorithm[16]{"blake3"};  // Null-terminated algorithm name
  char     engine_version[32]{};     // Set by hash.cpp from blake3_version()
  uint8_t  payload_hash[32]{};       // Raw 32-byte BLAKE3 output (not hex)
};

// Populate a HashEnvelope from a hex digest string (64 chars → 32 bytes).
// Returns false if hex string is invalid.
bool hash_envelope_from_hex(HashEnvelope& env, const std::string& hex_digest);

// Render a HashEnvelope to a 64-char hex string.
std::string hash_envelope_to_hex(const HashEnvelope& env);

// ---------------------------------------------------------------------------
// Per-execution metrics — Phase 1 / Phase 4
// ---------------------------------------------------------------------------
// Captured during execute() for observability and billing.
//
// EXTENSION_POINT: arena_high_water_metric
//   Current: stack-allocated, zero-overhead.
//   Upgrade: add arena_high_water_bytes when per-execution arena allocator is added.
struct ExecutionMetrics {
  uint64_t total_duration_ns{0};     // Wall-clock time of entire execute() call
  uint64_t hash_duration_ns{0};      // Time spent in BLAKE3 operations
  uint64_t sandbox_duration_ns{0};   // Time from process spawn to collection
  uint64_t canonicalize_ns{0};       // Time spent canonicalizing request/result
  size_t   bytes_stdin{0};           // Input payload size (request JSON)
  size_t   bytes_stdout{0};          // Output captured from process
  size_t   bytes_stderr{0};          // Stderr captured from process
  size_t   cas_puts{0};              // CAS write operations
  size_t   cas_hits{0};              // CAS dedup hits (skipped writes)
  size_t   output_files_hashed{0};   // Number of output files hashed post-execution
};

struct ExecPolicy {
  bool deterministic{true};
  bool allow_outside_workspace{false};
  bool inherit_env{false};
  std::string mode{"strict"};
  std::string time_mode{"fixed_zero"};
  std::string scheduler_mode{"turbo"};  // "repro" or "turbo"

  // EXTENSION_POINT: scheduler_strategy
  //   "repro": single-worker FIFO — maximum isolation, lowest throughput.
  //   "turbo": worker pool — maximum throughput, requires determinism enforcement.
  //   Future: "dag" mode for dependency-aware parallel execution.
  //   Invariant: scheduler_mode appears in canonicalize_request() — changing it
  //   changes the request_digest. Never change mode silently mid-session.

  std::vector<std::string> env_allowlist;
  std::vector<std::string> env_denylist{"RANDOM", "TZ", "HOSTNAME", "PWD", "OLDPWD", "SHLVL"};
  std::map<std::string, std::string> required_env{{"PYTHONHASHSEED", "0"}};
  // Sandbox options
  bool enforce_sandbox{true};
  std::uint64_t max_memory_bytes{0};  // 0 = unlimited
  std::uint64_t max_file_descriptors{0};  // 0 = unlimited
};

struct PolicyApplied {
  std::string mode;
  std::string time_mode;
  std::vector<std::string> allowed_keys;
  std::vector<std::string> denied_keys;
  std::vector<std::string> injected_required_keys;
};

struct SandboxApplied {
  bool workspace_confinement{false};
  bool rlimits{false};
  bool seccomp{false};
  bool job_object{false};
  bool restricted_token{false};
  std::vector<std::string> enforced;
  std::vector<std::string> unsupported;
};

struct LlmOptions {
  std::string mode{"none"};  // "none", "subprocess", "sidecar", "freeze_then_compute", "attempt_deterministic"

  // EXTENSION_POINT: ai_model_integration
  //   Current: mode="none" is the only fully implemented path.
  //   "subprocess": spawn model runner as child process, capture deterministic output via seed.
  //   "freeze_then_compute": snapshot model weights, hash, then run inference.
  //   "attempt_deterministic": best-effort with determinism_confidence score.
  //   Hook for Kimi/Codex/Gemini: each model runner plugs in via runner_argv + model_ref.
  //   Invariant: if include_in_digest=true, LLM output MUST be captured before result_digest
  //   is computed. Failing to do so creates a silent digest mismatch.

  std::vector<std::string> runner_argv;
  std::string model_ref;
  std::uint64_t seed{0};
  bool has_seed{false};
  std::map<std::string, std::string> sampler;
  bool include_in_digest{false};
  double determinism_confidence{0.0};  // 0.0-1.0, only for attempt_deterministic
};

struct ExecutionRequest {
  std::string request_id;
  std::string command;
  std::vector<std::string> argv;
  std::map<std::string, std::string> env;
  std::string cwd;
  std::string workspace_root{"."};
  std::map<std::string, std::string> inputs;
  std::vector<std::string> outputs;
  std::uint64_t nonce{0};
  std::uint64_t timeout_ms{5000};
  std::size_t max_output_bytes{4096};
  ExecPolicy policy;
  LlmOptions llm;
  // Multi-tenant support
  std::string tenant_id;
  // NOTE: tenant_id is intentionally excluded from canonicalize_request().
  // Tenant isolation is enforced at the infrastructure layer (separate CAS stores,
  // separate result stores, separate billing meters). The engine itself is tenant-agnostic.
};

struct TraceEvent {
  std::uint64_t seq{0};
  std::uint64_t t_ns{0};
  std::string type;
  std::map<std::string, std::string> data;
};

struct ExecutionResult {
  bool ok{false};
  int exit_code{0};
  std::string error_code;
  std::string termination_reason;
  bool stdout_truncated{false};
  bool stderr_truncated{false};
  std::string stdout_text;
  std::string stderr_text;
  std::string request_digest;
  std::string trace_digest;
  std::string stdout_digest;
  std::string stderr_digest;
  std::string result_digest;
  std::vector<TraceEvent> trace_events;
  std::map<std::string, std::string> output_digests;
  PolicyApplied policy_applied;
  SandboxApplied sandbox_applied;
  // Enterprise features
  std::string signature;     // Stub for signed result envelope
  std::string audit_log_id;
  // Per-execution metrics (Phase 1/4)
  ExecutionMetrics metrics;
};

}  // namespace requiem
