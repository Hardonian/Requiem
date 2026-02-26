#include "requiem/runtime.hpp"

#include <sstream>

#include "requiem/hash.hpp"

namespace requiem {

std::string canonicalize_request(const ExecutionRequest& request) {
  std::ostringstream oss;
  oss << "command=" << request.command << "\n";
  oss << "nonce=" << request.nonce << "\n";
  for (const auto& [key, value] : request.inputs) {
    oss << key << "=" << value << "\n";
  }
  return oss.str();
}

std::string canonicalize_result(const ExecutionResult& result) {
  std::ostringstream oss;
  oss << "exit=" << result.exit_code << "\n";
  oss << "stdout=" << result.stdout_text << "\n";
  oss << "stderr=" << result.stderr_text << "\n";
  oss << "request_digest=" << result.request_digest << "\n";
  return oss.str();
}

ExecutionResult execute(const ExecutionRequest& request) {
  ExecutionResult result;
  result.request_digest = deterministic_digest(canonicalize_request(request));

  // Deterministic execution scaffold: stable, side-effect-free synthetic output.
  result.stdout_text = "executed:" + request.command + ":" + result.request_digest;
  result.stderr_text.clear();
  result.exit_code = 0;
  result.result_digest = deterministic_digest(canonicalize_result(result));
  return result;
}

}  // namespace requiem
