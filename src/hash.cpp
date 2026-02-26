#include "requiem/hash.hpp"

#include <array>
#include <atomic>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <sstream>

// Vendored BLAKE3
extern "C" {
#include <blake3.h>
}

namespace requiem {
namespace {
std::atomic<bool> g_allow_fallback{false};

std::string to_hex(const unsigned char* out, std::size_t out_len) {
  std::ostringstream oss;
  for (std::size_t i = 0; i < out_len; ++i) {
    oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(out[i]);
  }
  return oss.str();
}

// OpenSSL fallback for when BLAKE3 is explicitly disabled (should not happen)
std::string openssl_blake2s256_hex(std::string_view payload) {
  // This is a stub - in practice we never want to use this
  // Return empty to enforce fail-closed behavior
  (void)payload;
  return {};
}

}  // namespace

HashRuntimeInfo hash_runtime_info() {
  HashRuntimeInfo info;
  info.version = blake3_version();
  info.fallback_allowed = g_allow_fallback.load();
  
#if defined(REQUIEM_BLAKE3_VENDORED)
  info.primitive = "blake3";
  info.backend = "vendored";
  info.blake3_available = true;
  info.compat_warning = false;
#else
  // This should never happen with vendored BLAKE3
  info.primitive = info.fallback_allowed ? "blake2s-256" : "blake3";
  info.backend = info.fallback_allowed ? "fallback" : "unavailable";
  info.blake3_available = false;
  info.compat_warning = info.fallback_allowed;
#endif
  
  return info;
}

void set_hash_fallback_allowed(bool allowed) { 
  g_allow_fallback.store(allowed); 
}

std::string blake3_hex(std::string_view payload) {
#if defined(REQUIEM_BLAKE3_VENDORED)
  blake3_hasher hasher;
  blake3_hasher_init(&hasher);
  blake3_hasher_update(&hasher, payload.data(), payload.size());
  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return to_hex(out.data(), out.size());
#else
  const auto info = hash_runtime_info();
  if (!info.fallback_allowed) {
    return {};
  }
  return openssl_blake2s256_hex(payload);
#endif
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
  
  constexpr std::size_t buffer_size = 8192;
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
  // Domain separation prefix
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
