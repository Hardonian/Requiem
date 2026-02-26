#pragma once

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace requiem {

struct ProcessSpec {
  std::string command;
  std::vector<std::string> argv;
  std::map<std::string, std::string> env;
  std::string cwd;
  std::uint64_t timeout_ms{5000};
  std::size_t max_output_bytes{4096};
  bool deterministic{true};
};

struct ProcessResult {
  int exit_code{0};
  bool timed_out{false};
  bool stdout_truncated{false};
  bool stderr_truncated{false};
  std::string stdout_text;
  std::string stderr_text;
  std::string error_message;
};

ProcessResult run_process(const ProcessSpec& spec);

}  // namespace requiem
