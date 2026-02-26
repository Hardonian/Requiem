#include "requiem/replay.hpp"

#include "requiem/hash.hpp"
#include "requiem/runtime.hpp"

namespace requiem {

bool validate_replay(const ExecutionRequest& request, const ExecutionResult& result) {
  const std::string expected_request_digest = deterministic_digest(canonicalize_request(request));
  if (expected_request_digest != result.request_digest) {
    return false;
  }

  const std::string expected_result_digest = deterministic_digest(canonicalize_result(result));
  return expected_result_digest == result.result_digest;
}

}  // namespace requiem
