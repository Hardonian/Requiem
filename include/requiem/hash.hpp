#pragma once

#include <string>
#include <string_view>

namespace requiem {

struct HashRuntimeInfo {
  std::string primitive;
  std::string backend;
  std::string version;
  bool compat_warning{false};
  bool blake3_available{false};
  bool fallback_allowed{false};
};

std::string blake3_hex(std::string_view payload);
std::string deterministic_digest(std::string_view payload);
HashRuntimeInfo hash_runtime_info();
void set_hash_fallback_allowed(bool allowed);

}  // namespace requiem
