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

// Core BLAKE3 hashing
std::string blake3_hex(std::string_view payload);
std::string deterministic_digest(std::string_view payload);
HashRuntimeInfo hash_runtime_info();
void set_hash_fallback_allowed(bool allowed);

// Binary digest (32 bytes)
std::string hash_bytes_blake3(std::string_view payload);

// File hashing
std::string hash_file_blake3(const std::string& path);

// Domain-separated hashing for different contexts
std::string hash_domain(std::string_view domain, std::string_view payload);
std::string canonical_json_hash(std::string_view canonical_json);
std::string result_json_hash(std::string_view canonical_result_json);
std::string cas_content_hash(std::string_view raw_bytes);

}  // namespace requiem
