#include "requiem/hash.hpp"

#include <array>
#include <atomic>
#include <iomanip>
#include <sstream>

#include <openssl/evp.h>

#if defined(REQUIEM_BLAKE3_LLVM)
#include <llvm-c/blake3.h>
#endif

namespace requiem {
namespace {
std::atomic<bool> g_allow_fallback{false};

std::string to_hex(const unsigned char* out, std::size_t out_len) {
  std::ostringstream oss;
  for (std::size_t i = 0; i < out_len; ++i) oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(out[i]);
  return oss.str();
}

std::string evp_hex(const EVP_MD* md, std::string_view payload) {
  EVP_MD_CTX* ctx = EVP_MD_CTX_new();
  if (!ctx) return {};
  unsigned char out[EVP_MAX_MD_SIZE];
  unsigned int out_len = 0;
  if (EVP_DigestInit_ex(ctx, md, nullptr) != 1 || EVP_DigestUpdate(ctx, payload.data(), payload.size()) != 1 ||
      EVP_DigestFinal_ex(ctx, out, &out_len) != 1) {
    EVP_MD_CTX_free(ctx);
    return {};
  }
  EVP_MD_CTX_free(ctx);
  return to_hex(out, out_len);
}

#if defined(REQUIEM_BLAKE3_LLVM)
std::string llvm_blake3_hex(std::string_view payload) {
  llvm_blake3_hasher h;
  llvm_blake3_hasher_init(&h);
  llvm_blake3_hasher_update(&h, payload.data(), payload.size());
  std::array<unsigned char, LLVM_BLAKE3_OUT_LEN> out{};
  llvm_blake3_hasher_finalize(&h, out.data(), out.size());
  return to_hex(out.data(), out.size());
}
#endif
}  // namespace

HashRuntimeInfo hash_runtime_info() {
  HashRuntimeInfo info;
  info.version = "1";
  info.fallback_allowed = g_allow_fallback.load();
#if defined(REQUIEM_BLAKE3_LLVM)
  info.primitive = "blake3";
  info.backend = "llvm-c";
  info.version = llvm_blake3_version();
  info.blake3_available = true;
#else
  info.primitive = info.fallback_allowed ? "blake2s-256" : "blake3";
  info.backend = info.fallback_allowed ? "fallback" : "unavailable";
  info.blake3_available = false;
  info.compat_warning = info.fallback_allowed;
#endif
  return info;
}

void set_hash_fallback_allowed(bool allowed) { g_allow_fallback.store(allowed); }

std::string blake3_hex(std::string_view payload) {
#if defined(REQUIEM_BLAKE3_LLVM)
  return llvm_blake3_hex(payload);
#else
  const auto info = hash_runtime_info();
  if (!info.fallback_allowed) return {};
  return evp_hex(EVP_blake2s256(), payload);
#endif
}

std::string deterministic_digest(std::string_view payload) { return blake3_hex(payload); }

}  // namespace requiem
