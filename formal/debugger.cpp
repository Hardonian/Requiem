#include "requiem/debugger.hpp"

#include <ctime>
#include <sstream>
#include <stdexcept>

#include "requiem/cas.hpp"

namespace requiem {

namespace {
// Helper to escape JSON strings (minimal implementation)
std::string escape_json(const std::string &s) {
  std::stringstream ss;
  for (char c : s) {
    if (c == '"')
      ss << "\\\"";
    else if (c == '\\')
      ss << "\\\\";
    else if (c == '\b')
      ss << "\\b";
    else if (c == '\f')
      ss << "\\f";
    else if (c == '\n')
      ss << "\\n";
    else if (c == '\r')
      ss << "\\r";
    else if (c == '\t')
      ss << "\\t";
    else if (static_cast<unsigned char>(c) < 0x20)
      ss << "\\u00" << std::hex << (int)c;
    else
      ss << c;
  }
  return ss.str();
}
} // namespace

class TimeTravelDebuggerImpl : public TimeTravelDebugger {
public:
  TimeTravelDebuggerImpl(std::shared_ptr<CasStore> cas,
                         const std::string &execution_digest)
      : cas_(std::move(cas)), root_digest_(execution_digest) {
    // In a full implementation, we would load the timeline here.
    // For now, we initialize at the root.
    current_state_digest_ = root_digest_;
    current_sequence_id_ = 0;
  }

  std::vector<TimeStep> GetTimeline() const override {
    // Stub: In real impl, walk the CAS DAG from root_digest_
    return {};
  }

  std::optional<StateSnapshot> Seek(uint64_t sequence_id) override {
    current_sequence_id_ = sequence_id;
    // Stub: In real impl, fetch state from CAS for this sequence.
    return std::nullopt;
  }

  std::optional<StateSnapshot> StepForward() override { return std::nullopt; }
  std::optional<StateSnapshot> StepBackward() override { return std::nullopt; }

  std::optional<std::string>
  InspectMemory(const std::string & /*key*/) const override {
    return std::nullopt;
  }

  std::string Fork(const std::string &injection_payload) override {
    if (!cas_) {
      throw std::runtime_error("Debugger not initialized with CAS backend");
    }

    // 1. Construct the Fork Event
    // This represents a divergence from the current timeline.
    // We use the current state digest as the 'parent' or 'basis'.
    // This leverages CAS Copy-On-Write: we don't copy the whole state,
    // just reference the parent digest.

    std::stringstream ss;
    ss << "{";
    ss << "\"type\":\"fork\",";
    ss << "\"parent_state\":\"" << current_state_digest_ << "\",";
    ss << "\"sequence_id\":" << (current_sequence_id_ + 1) << ",";
    ss << "\"injection_payload\":\"" << escape_json(injection_payload) << "\",";
    ss << "\"timestamp_ns\":" << std::time(nullptr) * 1000000000ULL;
    ss << "}";

    std::string event_json = ss.str();

    // 2. Write Event to CAS
    std::string event_digest = cas_->put(event_json);
    if (event_digest.empty()) {
      throw std::runtime_error("Failed to write fork event to CAS");
    }

    // 3. Create a new Execution Root (Branch Head)
    // This new root points to the fork event as its latest tip.
    std::stringstream root_ss;
    root_ss << "{";
    root_ss << "\"type\":\"execution_root\",";
    root_ss << "\"head_event\":\"" << event_digest << "\",";
    root_ss << "\"forked_from\":\"" << root_digest_ << "\"";
    root_ss << "}";

    std::string new_root_json = root_ss.str();
    std::string new_execution_digest = cas_->put(new_root_json);

    if (new_execution_digest.empty()) {
      throw std::runtime_error("Failed to write new execution root to CAS");
    }

    return new_execution_digest;
  }

  std::vector<uint64_t>
  Diff(const TimeTravelDebugger & /*other*/) const override {
    return {};
  }

private:
  std::shared_ptr<CasStore> cas_;
  std::string root_digest_;
  std::string current_state_digest_;
  uint64_t current_sequence_id_ = 0;
};

std::unique_ptr<TimeTravelDebugger>
TimeTravelDebugger::Load(std::shared_ptr<CasStore> cas_backend,
                         const std::string &execution_digest,
                         DebugSessionOptions /*options*/) {
  return std::make_unique<TimeTravelDebuggerImpl>(std::move(cas_backend),
                                                  execution_digest);
}

} // namespace requiem
