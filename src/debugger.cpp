#include "requiem/debugger.hpp"

#include <algorithm>
#include <chrono>
#include <ctime>
#include <sstream>
#include <stdexcept>
#include <vector>

#include "requiem/cas.hpp"
#include "requiem/jsonlite.hpp"

namespace requiem {

namespace {

// Maps a jsonlite::Object to a TimeStep
TimeStep map_event_to_step(const jsonlite::Object &obj,
                           const std::string &digest = "") {
  TimeStep step;
  step.event_digest = digest;
  step.sequence_id = jsonlite::get_u64(obj, "seq", 0);
  if (step.sequence_id == 0) {
    // handle both "seq" and "sequence_id" for compatibility
    step.sequence_id = jsonlite::get_u64(obj, "sequence_id", 0);
  }
  step.timestamp_ns = jsonlite::get_u64(obj, "t_ns", 0);
  if (step.timestamp_ns == 0) {
    step.timestamp_ns = jsonlite::get_u64(obj, "timestamp_ns", 0);
  }
  step.type = jsonlite::get_string(obj, "type", "");
  if (step.type.empty()) {
    step.type = jsonlite::get_string(obj, "event", "unknown");
  }
  step.state_digest = jsonlite::get_string(obj, "state_after", "");
  return step;
}

} // namespace

class TimeTravelDebuggerImpl : public TimeTravelDebugger {
public:
  enum class Mode { Linked, Array };

  TimeTravelDebuggerImpl(std::shared_ptr<CasStore> cas,
                         const std::string &execution_digest)
      : cas_(std::move(cas)), root_digest_(execution_digest) {

    if (!cas_)
      return;
    auto json = cas_->get(root_digest_);
    if (!json)
      return;

    std::string err;
    auto root_obj = jsonlite::parse(*json, &err);
    if (!std::holds_alternative<jsonlite::Object>(root_obj.v))
      return;
    const auto &obj = std::get<jsonlite::Object>(root_obj.v);

    // 1. Linked Mode (Formal chain)
    if (obj.count("head_event")) {
      mode_ = Mode::Linked;
      current_event_digest_ = jsonlite::get_string(obj, "head_event", "");
      auto ev_json = cas_->get(current_event_digest_);
      if (ev_json) {
        auto ev_obj = jsonlite::parse(*ev_json, nullptr);
        if (std::holds_alternative<jsonlite::Object>(ev_obj.v)) {
          const auto &eo = std::get<jsonlite::Object>(ev_obj.v);
          current_state_digest_ = jsonlite::get_string(eo, "state_after", "");
          current_sequence_id_ = jsonlite::get_u64(eo, "seq", 0);
        }
      }
    }
    // 2. Array Mode (Requiem ExecutionResult)
    else if (obj.count("trace_events")) {
      mode_ = Mode::Array;
    }
  }

  std::vector<TimeStep> GetTimeline() const override {
    if (!cas_)
      return {};
    auto json = cas_->get(root_digest_);
    if (!json)
      return {};

    auto root_val = jsonlite::parse(*json, nullptr);
    if (!std::holds_alternative<jsonlite::Object>(root_val.v))
      return {};
    const auto &root_obj = std::get<jsonlite::Object>(root_val.v);

    std::vector<TimeStep> timeline;

    if (mode_ == Mode::Linked) {
      std::string current = jsonlite::get_string(root_obj, "head_event", "");
      while (!current.empty()) {
        auto ev_json = cas_->get(current);
        if (!ev_json)
          break;
        auto ev_val = jsonlite::parse(*ev_json, nullptr);
        if (!std::holds_alternative<jsonlite::Object>(ev_val.v))
          break;
        const auto &ev_obj = std::get<jsonlite::Object>(ev_val.v);

        timeline.push_back(map_event_to_step(ev_obj, current));
        current = jsonlite::get_string(ev_obj, "parent_event", "");
      }
      std::reverse(timeline.begin(), timeline.end());
    } else {
      // Array mode
      if (root_obj.count("trace_events")) {
        const auto &events_val = root_obj.at("trace_events");
        if (std::holds_alternative<jsonlite::Array>(events_val.v)) {
          const auto &arr = std::get<jsonlite::Array>(events_val.v);
          for (const auto &entry : arr) {
            if (std::holds_alternative<jsonlite::Object>(entry.v)) {
              timeline.push_back(
                  map_event_to_step(std::get<jsonlite::Object>(entry.v)));
            }
          }
        }
      }
    }
    return timeline;
  }

  std::optional<StateSnapshot> Seek(uint64_t sequence_id) override {
    auto timeline = GetTimeline();
    for (const auto &step : timeline) {
      if (step.sequence_id == sequence_id) {
        current_sequence_id_ = step.sequence_id;
        current_event_digest_ = step.event_digest;
        current_state_digest_ = step.state_digest;

        StateSnapshot snapshot;
        snapshot.sequence_id = step.sequence_id;
        snapshot.memory_digest = step.state_digest;
        return snapshot;
      }
    }
    return std::nullopt;
  }

  std::optional<StateSnapshot> StepForward() override {
    return Seek(current_sequence_id_ + 1);
  }

  std::optional<StateSnapshot> StepBackward() override {
    if (current_sequence_id_ == 0)
      return std::nullopt;

    // Optimization: In Linked mode, we can walk up the parent pointer
    // instead of rescanning the whole timeline via Seek().
    if (mode_ == Mode::Linked && !current_event_digest_.empty()) {
      auto ev_json = cas_->get(current_event_digest_);
      if (ev_json) {
        auto ev_val = jsonlite::parse(*ev_json, nullptr);
        if (std::holds_alternative<jsonlite::Object>(ev_val.v)) {
          const auto &ev_obj = std::get<jsonlite::Object>(ev_val.v);
          std::string parent = jsonlite::get_string(ev_obj, "parent_event", "");
          if (!parent.empty()) {
            // Load parent event
            auto p_json = cas_->get(parent);
            if (p_json) {
              auto p_val = jsonlite::parse(*p_json, nullptr);
              if (std::holds_alternative<jsonlite::Object>(p_val.v)) {
                const auto &p_obj = std::get<jsonlite::Object>(p_val.v);

                // Update state to parent
                current_event_digest_ = parent;
                current_state_digest_ =
                    jsonlite::get_string(p_obj, "state_after", "");

                // Handle seq/sequence_id compat
                current_sequence_id_ = jsonlite::get_u64(p_obj, "seq", 0);
                if (current_sequence_id_ == 0)
                  current_sequence_id_ =
                      jsonlite::get_u64(p_obj, "sequence_id", 0);

                StateSnapshot snapshot;
                snapshot.sequence_id = current_sequence_id_;
                snapshot.memory_digest = current_state_digest_;
                return snapshot;
              }
            }
          }
        }
      }
    }

    return Seek(current_sequence_id_ - 1);
  }

  std::optional<StateSnapshot> StepOver() override {
    auto timeline = GetTimeline();
    auto it = std::find_if(timeline.begin(), timeline.end(),
                           [this](const TimeStep &s) {
                             return s.sequence_id == current_sequence_id_;
                           });

    if (it != timeline.end() && it->type == "tool_call") {
      auto res = std::find_if(it + 1, timeline.end(), [](const TimeStep &s) {
        return s.type == "tool_result";
      });
      if (res != timeline.end()) {
        return Seek(res->sequence_id);
      }
    }
    return StepForward();
  }

  std::optional<StateSnapshot> StepOut() override {
    auto timeline = GetTimeline();
    auto it = std::find_if(timeline.begin(), timeline.end(),
                           [this](const TimeStep &s) {
                             return s.sequence_id == current_sequence_id_;
                           });

    if (it == timeline.end())
      return std::nullopt;

    std::string target_type = "result"; // Default: run to end of execution
    if (it->type == "tool_call")
      target_type = "tool_result";
    else if (it->type == "process_start")
      target_type = "process_end";

    auto target = std::find_if(it + 1, timeline.end(), [&](const TimeStep &s) {
      if (target_type == "result")
        return s.type == "result" || s.type == "error" || s.type == "end";
      return s.type == target_type;
    });

    if (target != timeline.end())
      return Seek(target->sequence_id);
    return std::nullopt;
  }

  std::optional<std::string>
  InspectMemory(const std::string &key) const override {
    if (current_state_digest_.empty())
      return std::nullopt;
    auto state_json = cas_->get(current_state_digest_);
    if (!state_json)
      return std::nullopt;

    // Feature: Empty key returns the full state object
    if (key.empty()) {
      return state_json;
    }

    auto val = jsonlite::parse(*state_json, nullptr);
    if (std::holds_alternative<jsonlite::Object>(val.v)) {
      const auto &obj = std::get<jsonlite::Object>(val.v);
      if (obj.count(key)) {
        return jsonlite::get_string(obj, key, "");
      }
    }
    return std::nullopt;
  }

  std::string Fork(const std::string &injection_payload) override {
    if (!cas_)
      throw std::runtime_error("No CAS backend");

    // Construct the fork record
    std::string ev_json = "{";
    ev_json += "\"type\":\"fork\",";
    ev_json += "\"parent_event\":\"" + current_event_digest_ + "\",";
    ev_json += "\"state_before\":\"" + current_state_digest_ + "\",";
    ev_json += "\"seq\":" + std::to_string(current_sequence_id_ + 1) + ",";
    ev_json += "\"injection_payload\":\"" +
               jsonlite::escape(injection_payload) + "\",";
    ev_json += "\"t_ns\":" +
               std::to_string(
                   std::chrono::system_clock::now().time_since_epoch().count());
    ev_json += "}";

    std::string ev_digest = cas_->put(ev_json);

    // Create new root (always Linked mode for forks)
    std::string root_json = "{";
    root_json += "\"type\":\"execution_root\",";
    root_json += "\"head_event\":\"" + ev_digest + "\",";
    root_json += "\"forked_from\":\"" + root_digest_ + "\"";
    root_json += "}";

    return cas_->put(root_json);
  }

  std::vector<uint64_t> Diff(const TimeTravelDebugger &other) const override {
    auto t1 = GetTimeline();
    auto t2 = other.GetTimeline();
    std::vector<uint64_t> diffs;
    size_t n = std::min(t1.size(), t2.size());
    for (size_t i = 0; i < n; ++i) {
      if (t1[i].event_digest != t2[i].event_digest) {
        diffs.push_back(t1[i].sequence_id);
        break; // Diverged
      }
    }
    return diffs;
  }

private:
  std::shared_ptr<CasStore> cas_;
  std::string root_digest_;
  Mode mode_ = Mode::Linked;
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
