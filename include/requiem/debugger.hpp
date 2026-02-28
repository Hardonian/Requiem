#pragma once

#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "requiem/cas.hpp"

namespace requiem {

/**
 * @brief Represents a discrete point in an agent's execution timeline.
 */
struct TimeStep {
  uint64_t sequence_id;  // Monotonic event counter
  uint64_t timestamp_ns; // Wall-clock time (informational only)
  std::string
      event_digest; // CAS digest of the specific event (input/tool/output)
  std::string
      state_digest; // CAS digest of the full agent memory state *after* event
  std::string type; // "start", "tool_call", "tool_result", "model_output",
                    // "error", "process_start", "process_end"
};

/**
 * @brief A snapshot of the agent's internal state at a specific TimeStep.
 */
struct StateSnapshot {
  std::string memory_digest; // Root hash of the agent's working memory
  std::string last_output;   // Most recent stdout/response
  std::vector<std::string> active_policies; // Policies enforced at this step
  // Economic metrics at this snapshot
  uint64_t compute_units_consumed;
  uint64_t memory_bytes_used;
};

/**
 * @brief Configuration for a debug session.
 */
struct DebugSessionOptions {
  bool verify_cas_integrity = true;          // Re-verify Merkle proofs on load
  bool enable_speculative_execution = false; // Allow forking
};

/**
 * @brief The Time-Travel Debugger Interface.
 */
class TimeTravelDebugger {
public:
  virtual ~TimeTravelDebugger() = default;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * @brief Hydrates a debug session from a completed or running execution.
   * @param cas_backend Handle to the content-addressable storage.
   * @param execution_digest The root digest of the execution result or request.
   */
  static std::unique_ptr<TimeTravelDebugger>
  Load(std::shared_ptr<CasStore> cas_backend,
       const std::string &execution_digest, DebugSessionOptions options = {});

  // -------------------------------------------------------------------------
  // Navigation (The "VCR Controls")
  // -------------------------------------------------------------------------

  // Returns the full event timeline.
  virtual std::vector<TimeStep> GetTimeline() const = 0;

  // Jumps to a specific sequence ID. Reconstructs state via replay if
  // necessary.
  virtual std::optional<StateSnapshot> Seek(uint64_t sequence_id) = 0;

  // Step operations
  virtual std::optional<StateSnapshot> StepForward() = 0;
  virtual std::optional<StateSnapshot> StepBackward() = 0;

  // -------------------------------------------------------------------------
  // Inspection
  // -------------------------------------------------------------------------

  // Inspects a specific key in the agent's memory at the current Seek()
  // position. Returns the raw bytes (or JSON) from CAS.
  virtual std::optional<std::string>
  InspectMemory(const std::string &key) const = 0;

  // -------------------------------------------------------------------------
  // Branching (The "Multiverse" Capability)
  // -------------------------------------------------------------------------

  /**
   * @brief Forks the execution at the current Seek() position.
   */
  virtual std::string Fork(const std::string &injection_payload) = 0;

  /**
   * @brief Computes the semantic divergence between this session and another.
   */
  virtual std::vector<uint64_t>
  Diff(const TimeTravelDebugger &other_session) const = 0;
};

} // namespace requiem
