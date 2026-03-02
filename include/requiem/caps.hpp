#pragma once

// requiem/caps.hpp — Capability tokens for non-ambient authorization.
//
// KERNEL_SPEC §6: Every privileged action requires a valid, non-revoked
// capability token. Tokens are ed25519-signed JSON structures.
//
// INVARIANTS:
//   INV-CAPABILITY: No privileged operation proceeds without valid token.
//   INV-NO-AMBIENT: No global state used for authorization.
//
// Security:
//   - Private keys never leave the minting process.
//   - Only fingerprints (hashes) are stored in the event log.
//   - Revocation is permanent, anchored in the event chain.

#include <cstdint>
#include <set>
#include <string>
#include <vector>

namespace requiem {

// A capability token granting specific permissions.
struct CapabilityToken {
  uint32_t cap_version{1};
  std::string fingerprint;        // H("cap:", canonical_json(payload))
  std::string issuer_fingerprint; // Fingerprint of the issuer (root = self)
  std::string subject;            // Tenant or entity
  std::vector<std::string> permissions; // e.g. ["exec.run", "cas.put"]
  uint64_t not_before{0};               // Logical time (0 = immediate)
  uint64_t not_after{0};                // Logical time (0 = no expiry)
  uint64_t nonce{0};                    // Anti-replay
  std::string signature;                // ed25519 hex signature
};

// ed25519 key pair (public key = 32 bytes hex, secret key = 64 bytes hex).
struct KeyPair {
  std::string public_key_hex; // 64 hex chars (32 bytes)
  std::string secret_key_hex; // 128 hex chars (64 bytes)
};

// Generate a new ed25519 key pair.
KeyPair caps_generate_keypair();

// Serialize a capability token to canonical JSON (excluding signature field).
std::string caps_token_to_signing_payload(const CapabilityToken &token);

// Serialize a complete capability token to JSON.
std::string caps_token_to_json(const CapabilityToken &token);

// Parse a capability token from JSON.
CapabilityToken caps_token_from_json(const std::string &json);

// Compute the fingerprint of a token payload.
// fingerprint = H("cap:", caps_token_to_signing_payload(token))
std::string caps_compute_fingerprint(const CapabilityToken &token);

// Mint a new capability token.
// Creates the token, signs it with the given secret key, and logs the event.
CapabilityToken caps_mint(const std::vector<std::string> &permissions,
                          const std::string &subject,
                          const std::string &secret_key_hex,
                          const std::string &public_key_hex,
                          const std::string &issuer_fingerprint = "",
                          uint64_t not_before = 0, uint64_t not_after = 0);

// Verify a capability token.
// Checks: version, signature, permissions, time bounds, revocation.
struct CapsVerifyResult {
  bool ok{false};
  std::string error; // Empty if ok
};

CapsVerifyResult caps_verify(const CapabilityToken &token,
                             const std::string &required_action,
                             const std::string &public_key_hex,
                             uint64_t current_logical_time = 0);

// Revoke a capability by fingerprint.
// Adds to revocation set and logs the event.
void caps_revoke(const std::string &fingerprint);

// Check if a fingerprint has been revoked.
bool caps_is_revoked(const std::string &fingerprint);

// Get the revocation set.
std::set<std::string> caps_revocation_set();

// Clear revocation set (for testing only).
void caps_clear_revocations();

} // namespace requiem
