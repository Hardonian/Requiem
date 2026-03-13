/**
 * Canonical Hash Pipeline — C++ Kernel
 *
 * Mirror of /packages/hash/src/canonical_hash.ts for cross-language parity.
 *
 * Requirements:
 *   - BLAKE3-256 everywhere
 *   - Canonical JSON serialization with stable key ordering
 *   - UTF-8 NFC normalization
 *   - Newline normalization (CRLF → LF)
 *   - Domain separation matching TypeScript layer
 *
 * INVARIANT: canonical_hash_cpp(input) == canonical_hash_ts(input)
 *            for all valid inputs.
 */

#include <algorithm>
#include <array>
#include <cstring>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>
#include <map>

extern "C" {
#include <blake3.h>
}

namespace requiem {
namespace canonical {

// ---------------------------------------------------------------------------
// Hex Encoding
// ---------------------------------------------------------------------------

namespace {
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

// ---------------------------------------------------------------------------
// Text Normalization
// ---------------------------------------------------------------------------

std::string normalize_newlines(std::string_view input) {
  std::string result;
  result.reserve(input.size());
  for (std::size_t i = 0; i < input.size(); ++i) {
    if (input[i] == '\r') {
      result += '\n';
      // Skip the \n in \r\n pairs
      if (i + 1 < input.size() && input[i + 1] == '\n') {
        ++i;
      }
    } else {
      result += input[i];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Canonical JSON Serialization
// ---------------------------------------------------------------------------

// Forward declaration
std::string canonical_json_value(std::string_view json_value);

/**
 * Escape a JSON string value per RFC 8259.
 * Input should be the raw string content (not including quotes).
 */
std::string escape_json_string(std::string_view s) {
  std::string result;
  result.reserve(s.size() + 2);
  result += '"';
  for (char c : s) {
    switch (c) {
      case '"':  result += "\\\""; break;
      case '\\': result += "\\\\"; break;
      case '\b': result += "\\b";  break;
      case '\f': result += "\\f";  break;
      case '\n': result += "\\n";  break;
      case '\r': result += "\\r";  break;
      case '\t': result += "\\t";  break;
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          char buf[8];
          snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned char>(c));
          result += buf;
        } else {
          result += c;
        }
    }
  }
  result += '"';
  return result;
}

/**
 * Produce canonical JSON for a std::map with sorted keys.
 * Values are pre-serialized JSON strings.
 */
std::string canonical_json_object(const std::map<std::string, std::string>& obj) {
  std::string result = "{";
  bool first = true;
  for (const auto& [key, value] : obj) {
    if (!first) result += ',';
    first = false;
    result += escape_json_string(key);
    result += ':';
    result += value;
  }
  result += '}';
  return result;
}

/**
 * Produce canonical JSON for a vector of pre-serialized values.
 */
std::string canonical_json_array(const std::vector<std::string>& arr) {
  std::string result = "[";
  for (std::size_t i = 0; i < arr.size(); ++i) {
    if (i > 0) result += ',';
    result += arr[i];
  }
  result += ']';
  return result;
}

// ---------------------------------------------------------------------------
// Core Hash Functions
// ---------------------------------------------------------------------------

/** BLAKE3-256 hash returning 64 hex chars */
std::string canonical_hash(std::string_view payload) {
  blake3_hasher hasher;
  blake3_hasher_init(&hasher);
  blake3_hasher_update(&hasher, payload.data(), payload.size());
  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return to_hex(out.data(), out.size());
}

/** Hash with domain separation prefix */
std::string hash_domain(std::string_view domain, std::string_view payload) {
  blake3_hasher hasher;
  blake3_hasher_init(&hasher);
  blake3_hasher_update(&hasher, domain.data(), domain.size());
  blake3_hasher_update(&hasher, payload.data(), payload.size());
  std::array<unsigned char, BLAKE3_OUT_LEN> out{};
  blake3_hasher_finalize(&hasher, out.data(), out.size());
  return to_hex(out.data(), out.size());
}

// Domain-specific hash functions
std::string request_digest(std::string_view canonical_json) {
  return hash_domain("req:", canonical_json);
}

std::string result_digest(std::string_view canonical_json) {
  return hash_domain("res:", canonical_json);
}

std::string cas_content_hash(std::string_view raw_bytes) {
  return hash_domain("cas:", raw_bytes);
}

std::string event_chain_hash(std::string_view event_json) {
  return hash_domain("evt:", event_json);
}

std::string policy_proof_hash(std::string_view decision_json) {
  return hash_domain("pol:", decision_json);
}

std::string receipt_hash(std::string_view receipt_json) {
  return hash_domain("rcpt:", receipt_json);
}

std::string plan_hash(std::string_view plan_json) {
  return hash_domain("plan:", plan_json);
}

std::string capability_hash(std::string_view cap_json) {
  return hash_domain("cap:", cap_json);
}

// ---------------------------------------------------------------------------
// Merkle Root
// ---------------------------------------------------------------------------

std::string compute_merkle_root(const std::vector<std::string>& digests) {
  if (digests.empty()) return canonical_hash("empty_tree");
  if (digests.size() == 1) return digests[0];

  std::vector<std::string> pairs;
  for (std::size_t i = 0; i < digests.size(); i += 2) {
    const auto& left = digests[i];
    const auto& right = (i + 1 < digests.size()) ? digests[i + 1] : left;
    pairs.push_back(canonical_hash(left + right));
  }
  return compute_merkle_root(pairs);
}

}  // namespace canonical
}  // namespace requiem
