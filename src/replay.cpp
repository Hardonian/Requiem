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

bool validate_replay_with_cas(const ExecutionRequest& request, const ExecutionResult& result,
                              const CasStore& cas, std::string* error) {
  if (!validate_replay(request, result)) {
    if (error) *error = "result_digest_mismatch";
    return false;
  }
  for (const auto& [path, digest] : result.output_digests) {
    (void)path;
    if (!cas.contains(digest)) {
      if (error) *error = "missing_cas_object";
      return false;
    }
    auto bytes = cas.get(digest);
    if (!bytes || deterministic_digest(*bytes) != digest) {
      if (error) *error = "cas_integrity_failed";
      return false;
    }
  }
  return true;
}

}  // namespace requiem
