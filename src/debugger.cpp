#include "requiem/debugger.hpp"

#include <algorithm>
#include <unordered_set>

#include "requiem/jsonlite.hpp"

namespace requiem {

namespace {

std::optional<jsonlite::Object> read_cas_json(
    const std::shared_ptr<CasStore>& cas_backend, const std::string& digest) {
  if (!cas_backend || digest.empty()) {
    return std::nullopt;
  }

  auto payload = cas_backend->get(digest);
  if (!payload) {
    return std::nullopt;
  }

  std::optional<jsonlite::JsonError> err;
  auto obj = jsonlite::parse(*payload, &err);
  if (err) {
    return std::nullopt;
  }
  return obj;
}

StateSnapshot to_snapshot(const TimeStep& step) {
  StateSnapshot out;
  out.sequence_id = step.sequence_id;
  out.memory_digest = step.state_digest;
  out.last_output = "";
  out.active_policies = {};
  out.compute_units_consumed = 0;
  out.memory_bytes_used = 0;
  return out;
}

class BasicDebugger final : public TimeTravelDebugger {
 public:
  BasicDebugger(std::shared_ptr<CasStore> cas_backend,
                std::vector<TimeStep> timeline)
      : cas_backend_(std::move(cas_backend)), timeline_(std::move(timeline)) {
    if (!timeline_.empty()) {
      current_index_ = timeline_.size() - 1;
    }
  }

  std::vector<TimeStep> GetTimeline() const override { return timeline_; }

  std::optional<StateSnapshot> Seek(std::uint64_t sequence_id) override {
    for (std::size_t i = 0; i < timeline_.size(); ++i) {
      if (timeline_[i].sequence_id == sequence_id) {
        current_index_ = i;
        return to_snapshot(timeline_[i]);
      }
    }
    return std::nullopt;
  }

  std::optional<StateSnapshot> StepForward() override {
    if (timeline_.empty() || current_index_ + 1 >= timeline_.size()) {
      return std::nullopt;
    }
    ++current_index_;
    return to_snapshot(timeline_[current_index_]);
  }

  std::optional<StateSnapshot> StepBackward() override {
    if (timeline_.empty() || current_index_ == 0) {
      return std::nullopt;
    }
    --current_index_;
    return to_snapshot(timeline_[current_index_]);
  }

  std::optional<StateSnapshot> StepInto() override { return StepForward(); }

  std::optional<StateSnapshot> StepOver() override {
    if (timeline_.empty()) {
      return std::nullopt;
    }

    const auto& current = timeline_[current_index_];
    if (current.type == "tool_call") {
      for (std::size_t i = current_index_ + 1; i < timeline_.size(); ++i) {
        if (timeline_[i].type == "tool_result") {
          current_index_ = i;
          return to_snapshot(timeline_[current_index_]);
        }
      }
      return std::nullopt;
    }

    return StepForward();
  }

  std::optional<StateSnapshot> StepOut() override {
    if (timeline_.empty()) {
      return std::nullopt;
    }

    const auto& current = timeline_[current_index_];
    if (current.type != "tool_call") {
      return std::nullopt;
    }

    for (std::size_t i = current_index_ + 1; i < timeline_.size(); ++i) {
      if (timeline_[i].type == "tool_result") {
        current_index_ = i;
        return to_snapshot(timeline_[current_index_]);
      }
    }
    return std::nullopt;
  }

  std::optional<std::string> InspectMemory(const std::string& key) const override {
    if (timeline_.empty()) {
      return std::nullopt;
    }

    const auto& state_digest = timeline_[current_index_].state_digest;
    if (state_digest.empty()) {
      return std::nullopt;
    }

    auto payload = cas_backend_->get(state_digest);
    if (!payload) {
      return std::nullopt;
    }

    if (key.empty()) {
      return payload;
    }

    std::optional<jsonlite::JsonError> err;
    auto obj = jsonlite::parse(*payload, &err);
    if (err) {
      return std::nullopt;
    }

    auto it = obj.find(key);
    if (it == obj.end()) {
      return std::nullopt;
    }

    return jsonlite::to_json(it->second);
  }

  std::string Fork(const std::string& injection_payload) override {
    if (!cas_backend_ || timeline_.empty()) {
      return {};
    }

    const auto& current = timeline_[current_index_];
    const std::uint64_t fork_seq = current.sequence_id + 1;

    const std::string state_json =
        "{\"fork_payload\":\"" + jsonlite::escape(injection_payload) +
        "\",\"parent_state\":\"" + jsonlite::escape(current.state_digest) + "\"}";
    const std::string state_digest = cas_backend_->put(state_json);
    if (state_digest.empty()) {
      return {};
    }

    const std::string event_json =
        "{\"type\":\"fork_injection\",\"sequence_id\":" +
        std::to_string(fork_seq) + ",\"state_after\":\"" +
        jsonlite::escape(state_digest) + "\",\"parent_event\":\"" +
        jsonlite::escape(current.event_digest) + "\",\"payload\":\"" +
        jsonlite::escape(injection_payload) + "\"}";
    const std::string event_digest = cas_backend_->put(event_json);
    if (event_digest.empty()) {
      return {};
    }

    const std::string execution_root =
        "{\"type\":\"execution_root\",\"head_event\":\"" +
        jsonlite::escape(event_digest) + "\"}";
    return cas_backend_->put(execution_root);
  }

  std::vector<std::uint64_t> Diff(const TimeTravelDebugger& other_session) const override {
    std::vector<std::uint64_t> diffs;
    const auto other_timeline = other_session.GetTimeline();
    const std::size_t max_n = std::max(timeline_.size(), other_timeline.size());

    for (std::size_t i = 0; i < max_n; ++i) {
      if (i >= timeline_.size()) {
        diffs.push_back(other_timeline[i].sequence_id);
        continue;
      }
      if (i >= other_timeline.size()) {
        diffs.push_back(timeline_[i].sequence_id);
        continue;
      }

      const auto& a = timeline_[i];
      const auto& b = other_timeline[i];
      if (a.event_digest != b.event_digest || a.state_digest != b.state_digest ||
          a.type != b.type) {
        diffs.push_back(a.sequence_id);
      }
    }

    return diffs;
  }

 private:
  std::shared_ptr<CasStore> cas_backend_;
  std::vector<TimeStep> timeline_;
  std::size_t current_index_{0};
};

}  // namespace

std::unique_ptr<TimeTravelDebugger> TimeTravelDebugger::Load(
    std::shared_ptr<CasStore> cas_backend, const std::string& execution_digest,
    DebugSessionOptions) {
  if (!cas_backend || execution_digest.empty()) {
    return std::make_unique<BasicDebugger>(std::move(cas_backend), std::vector<TimeStep>{});
  }

  std::string head_event_digest = execution_digest;
  if (auto root_obj = read_cas_json(cas_backend, execution_digest)) {
    const auto maybe_head = jsonlite::get_string(*root_obj, "head_event", "");
    if (!maybe_head.empty()) {
      head_event_digest = maybe_head;
    }
  }

  std::vector<TimeStep> reversed;
  std::unordered_set<std::string> visited;
  std::string cursor = head_event_digest;

  while (!cursor.empty() && !visited.count(cursor)) {
    visited.insert(cursor);
    auto obj = read_cas_json(cas_backend, cursor);
    if (!obj) {
      break;
    }

    TimeStep step;
    step.sequence_id = jsonlite::get_u64(*obj, "sequence_id", reversed.size());
    step.timestamp_ns = jsonlite::get_u64(*obj, "t_ns", 0);
    step.event_digest = cursor;
    step.state_digest = jsonlite::get_string(*obj, "state_after", "");
    step.type = jsonlite::get_string(*obj, "type", "");

    reversed.push_back(std::move(step));
    cursor = jsonlite::get_string(*obj, "parent_event", "");
  }

  std::reverse(reversed.begin(), reversed.end());
  std::sort(reversed.begin(), reversed.end(),
            [](const TimeStep& a, const TimeStep& b) {
              return a.sequence_id < b.sequence_id;
            });

  return std::make_unique<BasicDebugger>(std::move(cas_backend), std::move(reversed));
}

}  // namespace requiem
