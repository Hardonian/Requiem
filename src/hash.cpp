#include "requiem/hash.hpp"

#include <iomanip>
#include <sstream>

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
  return hex64(fnv1a64(payload));
}

}  // namespace requiem
