#pragma once

#include <cstdint>
#include <map>
#include <string>

namespace requiem {

struct ExecutionRequest {
  std::string command;
  std::map<std::string, std::string> inputs;
  std::uint64_t nonce{0};
};

struct ExecutionResult {
  int exit_code{0};
  std::string stdout_text;
  std::string stderr_text;
  std::string request_digest;
  std::string result_digest;
};

}  // namespace requiem
