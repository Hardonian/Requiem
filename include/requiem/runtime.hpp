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
std::string policy_check_json(const std::string& request_json);
std::string report_from_result_json(const std::string& result_json);

// v1.2: Proof bundle generation
ProofBundle generate_proof_bundle(const ExecutionRequest& req, const ExecutionResult& res);

// v1.1: Config validation
struct ConfigValidationResult {
  bool ok{false};
  std::string config_version;
  std::vector<std::string> errors;
  std::vector<std::string> warnings;
};
ConfigValidationResult validate_config(const std::string& config_json);

}  // namespace requiem
