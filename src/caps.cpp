#include "requiem/caps.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

#include <mutex>
#include <random>
#include <set>

// ed25519 via OpenSSL EVP interface.
#include <openssl/evp.h>
#include <openssl/rand.h>

namespace requiem {

namespace {

// Global revocation set (fingerprints of revoked capabilities).
std::mutex g_revoke_mu;
std::set<std::string> g_revoked;

// Convert raw bytes to hex string.
std::string bytes_to_hex(const unsigned char *data, size_t len) {
  static const char kHex[] = "0123456789abcdef";
  std::string out;
  out.resize(len * 2);
  for (size_t i = 0; i < len; ++i) {
    out[i * 2] = kHex[data[i] >> 4];
    out[i * 2 + 1] = kHex[data[i] & 0x0f];
  }
  return out;
}

// Convert hex string to raw bytes.
bool hex_to_bytes(const std::string &hex, unsigned char *out,
                  size_t expected_len) {
  if (hex.size() != expected_len * 2)
    return false;
  for (size_t i = 0; i < expected_len; ++i) {
    auto nibble = [](char c) -> int {
      if (c >= '0' && c <= '9')
        return c - '0';
      if (c >= 'a' && c <= 'f')
        return c - 'a' + 10;
      if (c >= 'A' && c <= 'F')
        return c - 'A' + 10;
      return -1;
    };
    int hi = nibble(hex[i * 2]);
    int lo = nibble(hex[i * 2 + 1]);
    if (hi < 0 || lo < 0)
      return false;
    out[i] = static_cast<unsigned char>((hi << 4) | lo);
  }
  return true;
}

} // namespace

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

KeyPair caps_generate_keypair() {
  KeyPair kp;
  EVP_PKEY *pkey = nullptr;
  EVP_PKEY_CTX *ctx = EVP_PKEY_CTX_new_id(EVP_PKEY_ED25519, nullptr);
  if (!ctx)
    return kp;

  if (EVP_PKEY_keygen_init(ctx) <= 0) {
    EVP_PKEY_CTX_free(ctx);
    return kp;
  }
  if (EVP_PKEY_keygen(ctx, &pkey) <= 0) {
    EVP_PKEY_CTX_free(ctx);
    return kp;
  }
  EVP_PKEY_CTX_free(ctx);

  // Extract public key.
  unsigned char pub[32];
  size_t pub_len = 32;
  EVP_PKEY_get_raw_public_key(pkey, pub, &pub_len);
  kp.public_key_hex = bytes_to_hex(pub, pub_len);

  // Extract private key (seed). ED25519 uses 32-byte seed.
  // OpenSSL returns 64 bytes (expanded form: seed + public key), but
  // we only need the first 32 bytes (the seed) for signing.
  unsigned char priv[64];
  size_t priv_len = 64;
  EVP_PKEY_get_raw_private_key(pkey, priv, &priv_len);
  // Store only the first 32 bytes (the seed)
  kp.secret_key_hex = bytes_to_hex(priv, 32);

  EVP_PKEY_free(pkey);
  return kp;
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

std::string caps_token_to_signing_payload(const CapabilityToken &token) {
  // Canonical JSON of all fields except signature and fingerprint, sorted by key.
  // Note: fingerprint is computed FROM this payload, so it must not be included.
  jsonlite::Object obj;
  obj["cap_version"] = static_cast<uint64_t>(token.cap_version);
  obj["issuer_fingerprint"] = token.issuer_fingerprint;
  obj["nonce"] = token.nonce;
  obj["not_after"] = token.not_after;
  obj["not_before"] = token.not_before;

  jsonlite::Array perms_arr;
  for (const auto &p : token.permissions)
    perms_arr.push_back(jsonlite::Value{p});
  obj["permissions"] = std::move(perms_arr);

  obj["subject"] = token.subject;
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string caps_token_to_json(const CapabilityToken &token) {
  jsonlite::Object obj;
  obj["cap_version"] = static_cast<uint64_t>(token.cap_version);
  obj["fingerprint"] = token.fingerprint;
  obj["issuer_fingerprint"] = token.issuer_fingerprint;
  obj["nonce"] = token.nonce;
  obj["not_after"] = token.not_after;
  obj["not_before"] = token.not_before;

  jsonlite::Array perms_arr;
  for (const auto &p : token.permissions)
    perms_arr.push_back(jsonlite::Value{p});
  obj["permissions"] = std::move(perms_arr);

  obj["signature"] = token.signature;
  obj["subject"] = token.subject;
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

CapabilityToken caps_token_from_json(const std::string &json) {
  CapabilityToken token;
  auto obj = jsonlite::parse(json, nullptr);
  token.cap_version =
      static_cast<uint32_t>(jsonlite::get_u64(obj, "cap_version", 1));
  token.fingerprint = jsonlite::get_string(obj, "fingerprint", "");
  token.issuer_fingerprint =
      jsonlite::get_string(obj, "issuer_fingerprint", "");
  token.subject = jsonlite::get_string(obj, "subject", "");
  token.permissions = jsonlite::get_string_array(obj, "permissions");
  token.not_before = jsonlite::get_u64(obj, "not_before", 0);
  token.not_after = jsonlite::get_u64(obj, "not_after", 0);
  token.nonce = jsonlite::get_u64(obj, "nonce", 0);
  token.signature = jsonlite::get_string(obj, "signature", "");
  return token;
}

std::string caps_compute_fingerprint(const CapabilityToken &token) {
  return hash_domain("cap:", caps_token_to_signing_payload(token));
}

// ---------------------------------------------------------------------------
// Mint
// ---------------------------------------------------------------------------

CapabilityToken caps_mint(const std::vector<std::string> &permissions,
                          const std::string &subject,
                          const std::string &secret_key_hex,
                          const std::string &public_key_hex,
                          const std::string &issuer_fingerprint,
                          uint64_t not_before, uint64_t not_after) {

  // Mint currently signs with the private seed and does not require the
  // public key for serialization or fingerprint derivation. Keep the
  // parameter for API compatibility with callers that keep keypair context.
  (void)public_key_hex;

  CapabilityToken token;
  token.cap_version = 1;
  token.subject = subject;
  token.permissions = permissions;
  token.not_before = not_before;
  token.not_after = not_after;
  token.issuer_fingerprint = issuer_fingerprint;

  // Generate deterministic nonce from secret key + subject.
  token.nonce =
      static_cast<uint64_t>(std::hash<std::string>{}(secret_key_hex + subject));

  // Compute fingerprint.
  token.fingerprint = caps_compute_fingerprint(token);

  // Sign the payload.
  const std::string payload = caps_token_to_signing_payload(token);

  // ED25519 private key is 32 bytes (seed). OpenSSL's get_raw_private_key
  // returns 64 bytes (seed + public key), but new_raw_private_key expects 32.
  unsigned char priv_bytes[32];
  hex_to_bytes(secret_key_hex, priv_bytes, 32);

  EVP_PKEY *pkey = EVP_PKEY_new_raw_private_key(EVP_PKEY_ED25519, nullptr,
                                                priv_bytes, 32);

  if (pkey) {
    EVP_MD_CTX *md_ctx = EVP_MD_CTX_new();
    if (md_ctx) {
      unsigned char sig[64];
      size_t sig_len = 64;

      if (EVP_DigestSignInit(md_ctx, nullptr, nullptr, nullptr, pkey) > 0 &&
          EVP_DigestSign(
              md_ctx, sig, &sig_len,
              reinterpret_cast<const unsigned char *>(payload.data()),
              payload.size()) > 0) {
        token.signature = bytes_to_hex(sig, sig_len);
      }
      EVP_MD_CTX_free(md_ctx);
    }
    EVP_PKEY_free(pkey);
  }

  return token;
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

CapsVerifyResult caps_verify(const CapabilityToken &token,
                             const std::string &required_action,
                             const std::string &public_key_hex,
                             uint64_t current_logical_time) {

  CapsVerifyResult result;

  // Check version.
  if (token.cap_version != 1) {
    result.error = "unsupported_cap_version";
    return result;
  }

  // Check revocation.
  if (caps_is_revoked(token.fingerprint)) {
    result.error = "capability_revoked";
    return result;
  }

  // Check time bounds.
  if (token.not_before > 0 && current_logical_time < token.not_before) {
    result.error = "capability_not_yet_valid";
    return result;
  }
  if (token.not_after > 0 && current_logical_time > token.not_after) {
    result.error = "capability_expired";
    return result;
  }

  // Check permission.
  bool has_perm = false;
  for (const auto &p : token.permissions) {
    if (p == required_action || p == "*") {
      has_perm = true;
      break;
    }
  }
  if (!has_perm) {
    result.error = "missing_permission:" + required_action;
    return result;
  }

  // Verify fingerprint.
  std::string expected_fp = caps_compute_fingerprint(token);
  if (expected_fp != token.fingerprint) {
    result.error = "fingerprint_mismatch";
    return result;
  }

  // Verify ed25519 signature.
  const std::string payload = caps_token_to_signing_payload(token);

  unsigned char pub_bytes[32];
  if (!hex_to_bytes(public_key_hex, pub_bytes, 32)) {
    result.error = "invalid_public_key";
    return result;
  }

  unsigned char sig_bytes[64];
  if (!hex_to_bytes(token.signature, sig_bytes, 64)) {
    result.error = "invalid_signature_format";
    return result;
  }

  EVP_PKEY *pkey =
      EVP_PKEY_new_raw_public_key(EVP_PKEY_ED25519, nullptr, pub_bytes, 32);
  if (!pkey) {
    result.error = "public_key_load_failed";
    return result;
  }

  EVP_MD_CTX *md_ctx = EVP_MD_CTX_new();
  bool sig_ok = false;
  if (md_ctx) {
    if (EVP_DigestVerifyInit(md_ctx, nullptr, nullptr, nullptr, pkey) > 0) {
      sig_ok = EVP_DigestVerify(
                   md_ctx, sig_bytes, 64,
                   reinterpret_cast<const unsigned char *>(payload.data()),
                   payload.size()) == 1;
    }
    EVP_MD_CTX_free(md_ctx);
  }
  EVP_PKEY_free(pkey);

  if (!sig_ok) {
    result.error = "signature_invalid";
    return result;
  }

  result.ok = true;
  return result;
}

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

void caps_revoke(const std::string &fingerprint) {
  std::lock_guard<std::mutex> lk(g_revoke_mu);
  g_revoked.insert(fingerprint);
}

bool caps_is_revoked(const std::string &fingerprint) {
  std::lock_guard<std::mutex> lk(g_revoke_mu);
  return g_revoked.count(fingerprint) > 0;
}

std::set<std::string> caps_revocation_set() {
  std::lock_guard<std::mutex> lk(g_revoke_mu);
  return g_revoked;
}

void caps_clear_revocations() {
  std::lock_guard<std::mutex> lk(g_revoke_mu);
  g_revoked.clear();
}

} // namespace requiem
