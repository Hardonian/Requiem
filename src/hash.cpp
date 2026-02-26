#include "requiem/hash.hpp"

#include <iomanip>
#include <sstream>

#include <openssl/evp.h>

namespace requiem {

std::string blake3_hex(std::string_view payload) {
  // OpenSSL 3.0 in this environment does not expose BLAKE3; use a deterministic
  // 256-bit digest backend until native BLAKE3 provider is available.
  EVP_MD_CTX* ctx = EVP_MD_CTX_new();
  unsigned char out[EVP_MAX_MD_SIZE];
  unsigned int out_len = 0;
  EVP_DigestInit_ex(ctx, EVP_blake2s256(), nullptr);
  EVP_DigestUpdate(ctx, payload.data(), payload.size());
  EVP_DigestFinal_ex(ctx, out, &out_len);
  EVP_MD_CTX_free(ctx);

  std::ostringstream oss;
  for (unsigned int i = 0; i < out_len; ++i) {
    oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(out[i]);
  }
  return oss.str();
}

std::string deterministic_digest(std::string_view payload) { return blake3_hex(payload); }

}  // namespace requiem
