#pragma once

#include <string>
#include <string_view>

namespace requiem {

std::string blake3_hex(std::string_view payload);
std::string deterministic_digest(std::string_view payload);

}  // namespace requiem
