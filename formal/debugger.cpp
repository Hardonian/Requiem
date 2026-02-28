#include "requiem/debugger.hpp"

#include <algorithm>
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

// Helper to extract a field from a JSON string (minimal parser)
std::string extract_json_field(const std::string &json,
                               const std::string &key) {
  std::string search_key = "\"" + key + "\"";
  size_t pos = json.find(search_key);
  if (pos == std::string::npos)
    return "";

  pos = json.find(":", pos);
  if (pos == std::string::npos)
    return "";

  size_t start = json.find_first_of("\"0123456789", pos);
  if (start == std::string::npos)
    return "";

  if (json[start] == '"') {
    size_t end = json.find("\"", start + 1);
    return (end == std::string::npos) ? ""
                                      : json.substr(start + 1, end - start - 1);
  }

  // Number
  size_t end = json.find_first_of(",}", start);
  return (end == std::string::npos) ? json.substr(start)
                                    : json.substr(start, end - start);
}
} // namespace

class TimeTravelDebuggerImpl : public TimeTravelDebugger {
public:
  TimeTravelDebuggerImpl(std::shared_ptr<CasStore> cas,
                         const std::string &execution_digest)
      : cas_(std::move(cas)), root_digest_(execution_digest) {

    // Hydrate initial state from the execution root
    if (cas_) {
      auto root_json = cas_->get(root_digest_);
      if (root_json) {
        // The root points to the head of the event chain
        current_event_digest_ = extract_json_field(*root_json, "head_event");

        // Load the head event to get sequence and state
        auto event_json = cas_->get(current_event_digest_);
        if (event_json) {
          current_state_digest_ =
              extract_json_field(*event_json, "state_after");
          std::string seq_str = extract_json_field(*event_json, "sequence_id");
          current_sequence_id_ = seq_str.empty() ? 0 : std::stoull(seq_str);
        }
      }
    }
  }

  std::vector<TimeStep> GetTimeline() const override {
    if (!cas_)
      return {};

    auto root_json = cas_->get(root_digest_);
    if (!root_json)
      return {};
    std::string current_digest = extract_json_field(*root_json, "head_event");

    std::vector<TimeStep> timeline;
    while (!current_digest.empty()) {
      auto event_json = cas_->get(current_digest);
      if (!event_json)
        break;

      TimeStep step;
      step.event_digest = current_digest;
      step.type = extract_json_field(*event_json, "type");
      step.state_digest = extract_json_field(*event_json, "state_after");
      std::string seq = extract_json_field(*event_json, "sequence_id");
      step.sequence_id = seq.empty() ? 0 : std::stoull(seq);
      std::string ts = extract_json_field(*event_json, "timestamp_ns");
      step.timestamp_ns = ts.empty() ? 0 : std::stoull(ts);
      timeline.push_back(step);

      current_digest = extract_json_field(*event_json, "parent_event");
    }
    std::reverse(timeline.begin(), timeline.end());
    return timeline;
  }

  std::optional<StateSnapshot> Seek(uint64_t sequence_id) override {
    if (!cas_)
      return std::nullopt;

    // 1. Start at the head (or current) and walk backwards
    // Optimization: If target > current, we might need to reload from root (if
    // we don't cache the timeline) For safety, let's start from the root's head
    // event to ensure we can reach any valid ID.
    auto root_json = cas_->get(root_digest_);
    if (!root_json)
      return std::nullopt;

    std::string walker_digest = extract_json_field(*root_json, "head_event");

    while (!walker_digest.empty()) {
      auto event_json = cas_->get(walker_digest);
      if (!event_json)
        break;

      std::string seq_str = extract_json_field(*event_json, "sequence_id");
      uint64_t seq = seq_str.empty() ? 0 : std::stoull(seq_str);

      if (seq == sequence_id) {
        // Found target
        current_sequence_id_ = seq;
        current_event_digest_ = walker_digest;
        current_state_digest_ = extract_json_field(*event_json, "state_after");

        // Construct snapshot
        StateSnapshot snapshot;
        snapshot.memory_digest = current_state_digest_;
        // In a real impl, we'd parse more fields here
        return snapshot;
      }

      if (seq < sequence_id) {
        // We went too far back (or target doesn't exist in this branch)
        break;
      }

      // Walk to parent
      walker_digest = extract_json_field(*event_json, "parent_event");
    }

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
    ss << "\"parent_event\":\"" << current_event_digest_ << "\",";
    ss << "\"state_before\":\"" << current_state_digest_ << "\",";
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

  std::vector<uint64_t> Diff(const TimeTravelDebugger &other) const override {
    auto my_timeline = GetTimeline();
    auto other_timeline = other.GetTimeline();

    std::vector<uint64_t> divergences;
    size_t len = std::min(my_timeline.size(), other_timeline.size());

    for (size_t i = 0; i < len; ++i) {
      if (my_timeline[i].event_digest != other_timeline[i].event_digest) {
        divergences.push_back(my_timeline[i].sequence_id);
        // Once diverged, the rest of the timeline is effectively a different
        // branch.
        break;
      }
    }
    return divergences;
  }

private:
  std::shared_ptr<CasStore> cas_;
  std::string root_digest_;
  std::string current_event_digest_;
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
