#include "requiem/hash.hpp"

#include <iomanip>
#include <sstream>

#include <openssl/sha.h>

namespace requiem {

namespace {
constexpr std::uint64_t kFnvOffsetBasis = 14695981039346656037ull;
constexpr std::uint64_t kFnvPrime = 1099511628211ull;
}  // namespace

std::uint64_t fnv1a64(std::string_view payload) {
  std::uint64_t hash = kFnvOffsetBasis;
  for (unsigned char c : payload) {
    hash ^= c;
    hash *= kFnvPrime;
  }
  return hash;
}

std::string hex64(std::uint64_t value) {
  std::ostringstream oss;
  oss << std::hex << std::setfill('0') << std::setw(16) << value;
  return oss.str();
}

std::string deterministic_digest(std::string_view payload) {
  unsigned char out[SHA256_DIGEST_LENGTH];
  SHA256(reinterpret_cast<const unsigned char*>(payload.data()), payload.size(), out);
  std::ostringstream oss;
  for (unsigned char b : out) {
    oss << std::hex << std::setfill('0') << std::setw(2) << static_cast<int>(b);
  }
  return oss.str();
}

}  // namespace requiem
