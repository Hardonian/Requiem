#pragma once

#include <string>

#include "requiem/types.hpp"

namespace requiem {

std::string canonicalize_request(const ExecutionRequest& request);
std::string canonicalize_result(const ExecutionResult& result);
ExecutionResult execute(const ExecutionRequest& request);

}  // namespace requiem
