#pragma once

#include <string>

#include "requiem/types.hpp"

namespace requiem {

std::string canonicalize_request(const ExecutionRequest& request);
std::string canonicalize_result(const ExecutionResult& result);
ExecutionResult execute(const ExecutionRequest& request);

ExecutionRequest parse_request_json(const std::string& json_payload, std::string* error);
std::string result_to_json(const ExecutionResult& result);
std::string trace_pretty(const ExecutionResult& result);
std::string policy_explain(const ExecPolicy& policy);

}  // namespace requiem
