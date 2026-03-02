// src/debugger.cpp — Minimal stub for build compatibility
//
// Full implementation requires jsonlite API alignment.
// This stub provides the interface for chaos_harness linking.

#include "requiem/debugger.hpp"
#include "requiem/cas.hpp"

namespace requiem {

// Stub implementation of TimeTravelDebugger
class StubDebugger : public TimeTravelDebugger {
public:
  std::vector<TimeStep> GetTimeline() const override { return {}; }
  std::optional<StateSnapshot> Seek(uint64_t) override { return std::nullopt; }
  std::optional<StateSnapshot> StepForward() override { return std::nullopt; }
  std::optional<StateSnapshot> StepBackward() override { return std::nullopt; }
  std::optional<StateSnapshot> StepInto() override { return std::nullopt; }
  std::optional<StateSnapshot> StepOver() override { return std::nullopt; }
  std::optional<StateSnapshot> StepOut() override { return std::nullopt; }
  std::optional<std::string> InspectMemory(const std::string&) const override {
    return std::nullopt;
  }
  std::string Fork(const std::string&) override { return ""; }
  std::vector<uint64_t> Diff(const TimeTravelDebugger&) const override { return {}; }
};

std::unique_ptr<TimeTravelDebugger>
TimeTravelDebugger::Load(std::shared_ptr<CasStore>,
                         const std::string &,
                         DebugSessionOptions) {
  return std::make_unique<StubDebugger>();
}

} // namespace requiem
