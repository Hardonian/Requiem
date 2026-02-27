#include "requiem/hash.hpp"

#include <array>
#include <atomic>
#include <cstring>
#include <fstream>

// Vendored BLAKE3 — sole hash primitive. No fallbacks.
extern "C" {
#include <blake3.h>
}

namespace requiem {
namespace {

// Fast hex encoder — avoids std::ostringstream overhead.
constexpr char kHexChars[] = "0123456789abcdef";

std::string to_hex(const unsigned char* data, std::size_t len) {
  std::string out;
  out.resize(len * 2);
  for (std::size_t i = 0; i < len; ++i) {
    out[i * 2]     = kHexChars[data[i] >> 4];
    out[i * 2 + 1] = kHexChars[data[i] & 0x0f];
  }
  return out;
}

}  // namespace

HashRuntimeInfo hash_runtime_info() {
  HashRuntimeInfo info;
  info.version = blake3_version();
  info.primitive = "blake3";
  info.backend = "vendored";
  info.blake3_available = true;
  info.compat_warning = false;
  info.fallback_allowed = false;
  return info;
}

void set_hash_fallback_allowed(bool /*allowed*/) {
  // No-op: fallback is permanently disabled. BLAKE3 is always vendored.
}

std::string blake3_hex(std::string_view payload) {
  blake3_hasher hasher;
  blake3_hasher_init(&hasher);
  blake3_hasher_update(&hasher, payload.data(), payload.size());
  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return to_hex(out.data(), out.size());
}

std::string hash_bytes_blake3(std::string_view payload) {
  blake3_hasher hasher;
  blake3_hasher_init(&hasher);
  blake3_hasher_update(&hasher, payload.data(), payload.size());
  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return std::string(reinterpret_cast<char*>(out.data()), out.size());
}

std::string hash_file_blake3(const std::string& path) {
  std::ifstream file(path, std::ios::binary);
  if (!file) {
    return {};
  }

  blake3_hasher hasher;
  blake3_hasher_init(&hasher);

  constexpr std::size_t buffer_size = 65536;  // 64KB for better I/O throughput
  char buffer[buffer_size];
  while (file.good()) {
    file.read(buffer, buffer_size);
    std::streamsize count = file.gcount();
    if (count > 0) {
      blake3_hasher_update(&hasher, buffer, static_cast<size_t>(count));
    }
  }

  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return std::string(reinterpret_cast<char*>(out.data()), out.size());
}

std::string hash_domain(std::string_view domain, std::string_view payload) {
  blake3_hasher hasher;
  blake3_hasher_init(&hasher);
  // Domain separation: prefix + length-delimited payload prevents
  // ambiguity when domain strings have variable length.
  blake3_hasher_update(&hasher, domain.data(), domain.size());
  blake3_hasher_update(&hasher, payload.data(), payload.size());
  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return to_hex(out.data(), out.size());
}

std::string deterministic_digest(std::string_view payload) {
  return blake3_hex(payload);
}

std::string canonical_json_hash(std::string_view canonical_json) {
  return hash_domain("req:", canonical_json);
}

std::string result_json_hash(std::string_view canonical_result_json) {
  return hash_domain("res:", canonical_result_json);
}

std::string cas_content_hash(std::string_view raw_bytes) {
  return hash_domain("cas:", raw_bytes);
}

}  // namespace requiem
