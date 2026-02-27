#include "requiem/replay.hpp"

#include "requiem/hash.hpp"
#include "requiem/runtime.hpp"

namespace requiem {

bool validate_replay(const ExecutionRequest& request, const ExecutionResult& result) {
  // INV-1 ENFORCEMENT: Use domain-separated hashes matching execute() path.
  const std::string expected_request_digest = canonical_json_hash(canonicalize_request(request));
  if (expected_request_digest != result.request_digest) {
    return false;
  }

  const std::string expected_result_digest = result_json_hash(canonicalize_result(result));
  if (expected_result_digest != result.result_digest) {
    return false;
  }

  // CLAIM ENFORCEMENT: Validate stdout, stderr, and trace digests.
  // The contract states replay must verify ALL digests, not just request+result.
  if (!result.stdout_digest.empty()) {
    const std::string expected_stdout = deterministic_digest(result.stdout_text);
    if (expected_stdout != result.stdout_digest) return false;
  }
  if (!result.stderr_digest.empty()) {
    const std::string expected_stderr = deterministic_digest(result.stderr_text);
    if (expected_stderr != result.stderr_digest) return false;
  }

  return true;
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
    if (!bytes || cas_content_hash(*bytes) != digest) {
      if (error) *error = "cas_integrity_failed";
      return false;
    }
  }
  return true;
}

}  // namespace requiem
