#pragma once

#include <string>

#include "requiem/cas.hpp"
#include "requiem/types.hpp"

namespace requiem {

bool validate_replay(const ExecutionRequest& request, const ExecutionResult& result);
bool validate_replay_with_cas(const ExecutionRequest& request, const ExecutionResult& result,
                              const CasStore& cas, std::string* error);

}  // namespace requiem
