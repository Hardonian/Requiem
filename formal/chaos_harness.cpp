#include <cassert>
#include <filesystem>
#include <iostream>
#include <vector>

#include "requiem/cas.hpp"
#include "requiem/debugger.hpp"

namespace fs = std::filesystem;

void test_fork_deduplication() {
  std::cout << "[Chaos] Starting Fork Deduplication Test..." << std::endl;

  // Setup CAS
  std::string test_root = "test_chaos_cas";
  if (fs::exists(test_root))
    fs::remove_all(test_root);
  auto cas = std::make_shared<requiem::CasStore>(test_root);

  // Create initial state
  std::string initial_state =
      "{\"memory\": {\"key\": \"value\", \"large_buffer\": \"...static...\"}, "
      "\"step\": 0}";
  std::string state_digest = cas->put(initial_state);

  // Create root execution event
  std::string root_event = "{\"type\":\"start\", \"state_after\":\"" +
                           state_digest + "\", \"sequence_id\": 0}";
  std::string root_event_digest = cas->put(root_event);

  std::string execution_root =
      "{\"type\":\"execution_root\", \"head_event\":\"" + root_event_digest +
      "\"}";
  std::string execution_digest = cas->put(execution_root);

  // Load Debugger
  auto debugger = requiem::TimeTravelDebugger::Load(cas, execution_digest);

  // Fork 100 times
  // Each fork creates a new branch from the SAME state.
  std::vector<std::string> forks;
  for (int i = 0; i < 100; ++i) {
    std::string payload = "injection_" + std::to_string(i);
    forks.push_back(debugger->Fork(payload));
  }

  // Verify CAS size
  // Expected objects:
  // 1 initial state blob
  // 1 root event blob
  // 1 execution root blob
  // 100 fork event blobs
  // 100 new execution root blobs
  // TOTAL: ~203 objects.
  //
  // If deduplication failed (copying state), we would see 100 additional state
  // blobs.
  size_t obj_count = cas->size();
  std::cout << "[Chaos] CAS Object Count: " << obj_count << std::endl;

  if (obj_count > 210) {
    std::cerr << "[Chaos] FAIL: CAS object count too high (" << obj_count
              << "). Deduplication suspect." << std::endl;
    exit(1);
  }

  std::cout << "[Chaos] PASS: Fork deduplication verified." << std::endl;

  // Cleanup
  fs::remove_all(test_root);
}

int main() {
  try {
    test_fork_deduplication();
  } catch (const std::exception &e) {
    std::cerr << "[Chaos] Exception: " << e.what() << std::endl;
    return 1;
  }
  return 0;
}
