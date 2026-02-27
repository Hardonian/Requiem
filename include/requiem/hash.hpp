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

// Stream-hash a file and return a 64-char hex digest.
// MICRO_OPT: Uses a 64 KB read buffer instead of reading the full file into RAM.
// MICRO_DOCUMENTED: Equivalent output to blake3_hex(read_file(path)), but avoids
// allocating a potentially large std::string for the file contents. For output
// files >4 KB this eliminates one heap allocation and one full-file memcpy.
// Determinism: BLAKE3 hasher produces identical output whether data is fed in one
// chunk or many sequential chunks (verified by BLAKE3 test vectors). See:
//   https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf §5
// EXTENSION_POINT: simd_expansion — BLAKE3's C implementation auto-selects
//   AVX512/AVX2/SSE4.1/NEON for the compression function. No manual SIMD needed.
std::string hash_file_blake3_hex(const std::string& path);

// Domain-separated hashing for different contexts
std::string hash_domain(std::string_view domain, std::string_view payload);
std::string canonical_json_hash(std::string_view canonical_json);
std::string result_json_hash(std::string_view canonical_result_json);
std::string cas_content_hash(std::string_view raw_bytes);

}  // namespace requiem
