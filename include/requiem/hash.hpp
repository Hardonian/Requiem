#pragma once

#include <cstdint>
#include <string>
#include <string_view>

namespace requiem {

std::uint64_t fnv1a64(std::string_view payload);
std::string hex64(std::uint64_t value);
std::string deterministic_digest(std::string_view payload);

}  // namespace requiem
