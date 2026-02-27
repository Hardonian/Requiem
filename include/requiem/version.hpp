#pragma once

// requiem/version.hpp — Explicit version manifest for every protocol surface.
//
// PURPOSE:
//   Prevent silent format drift across engine, CAS, protocol, and ABI layers.
//   Every component that reads or writes a versioned format must check its
//   corresponding constant here before processing data.
//
// INVARIANT:
//   All version constants are compile-time. Runtime checks call
//   requiem::version::check_compatibility() on startup, which fails fast
//   with a structured error if any constraint is violated.
//
// EXTENSION_POINT: version_negotiation
//   Current: hard-fail on mismatch.
//   Upgrade path: add a negotiation handshake for multi-version clusters where
//   different nodes may run different engine builds. Implement a VersionSet
//   that tracks the intersection of supported versions across the cluster.
//   Invariant: never silently accept data from a newer format version than
//   the engine was compiled against. Explicit downgrade-safe paths only.

#include <cstdint>
#include <string>

namespace requiem {
namespace version {

// ---------------------------------------------------------------------------
// ENGINE_ABI_VERSION
// Increment when the C API (c_api.h) binary interface changes.
// Consumers must pass this value to requiem_init() and it is checked at
// runtime. Mismatches cause requiem_init() to return nullptr.
// ---------------------------------------------------------------------------
constexpr uint32_t ENGINE_ABI_VERSION = 2;

// ---------------------------------------------------------------------------
// HASH_ALGORITHM_VERSION
// Tracks the hash algorithm in use for all content-addressed objects.
// Version 1 = BLAKE3 (BLAKE3_OUT_LEN=32 bytes, hex-encoded to 64 chars).
// Bump when migrating to a new algorithm (e.g., BLAKE3 XOF with longer output).
// ALL digest comparisons must first verify HASH_ALGORITHM_VERSION matches.
// ---------------------------------------------------------------------------
constexpr uint32_t HASH_ALGORITHM_VERSION = 1;

// ---------------------------------------------------------------------------
// CAS_FORMAT_VERSION
// Tracks the on-disk layout of CAS object files and their .meta sidecars.
// Version 2 = current: AB/CD/<64-char-digest> sharding with JSON .meta files.
// Changing the shard depth, digest encoding, or meta format requires a bump.
// ---------------------------------------------------------------------------
constexpr uint32_t CAS_FORMAT_VERSION = 2;

// ---------------------------------------------------------------------------
// PROTOCOL_FRAMING_VERSION
// Tracks the NDJSON protocol frame schema for exec stream and replay stream.
// Version 1 = current: {type, ...} frames (start/event/end/result/error).
// Adding or removing required fields in any frame type requires a bump.
// ---------------------------------------------------------------------------
constexpr uint32_t PROTOCOL_FRAMING_VERSION = 1;

// ---------------------------------------------------------------------------
// REPLAY_LOG_VERSION
// Tracks the format of replay log files stored in CAS.
// Version 1 = current: JSON array of TraceEvent objects.
// ---------------------------------------------------------------------------
constexpr uint32_t REPLAY_LOG_VERSION = 1;

// ---------------------------------------------------------------------------
// AUDIT_LOG_VERSION
// Tracks the format of append-only audit log entries.
// Version 1 = current: NDJSON with provenance fields.
// ---------------------------------------------------------------------------
constexpr uint32_t AUDIT_LOG_VERSION = 1;

// ---------------------------------------------------------------------------
// Structured version manifest (runtime-accessible)
// ---------------------------------------------------------------------------
struct VersionManifest {
  uint32_t engine_abi{ENGINE_ABI_VERSION};
  uint32_t hash_algorithm{HASH_ALGORITHM_VERSION};
  uint32_t cas_format{CAS_FORMAT_VERSION};
  uint32_t protocol_framing{PROTOCOL_FRAMING_VERSION};
  uint32_t replay_log{REPLAY_LOG_VERSION};
  uint32_t audit_log{AUDIT_LOG_VERSION};
  std::string engine_semver;      // e.g. "0.8.0" from CMake project version
  std::string hash_primitive;     // e.g. "blake3"
  std::string build_timestamp;    // ISO-8601 build timestamp (from __DATE__/__TIME__)
};

// Returns the current version manifest populated at compile time.
VersionManifest current_manifest(const std::string& engine_semver = "");

// Serialize to compact JSON.
std::string manifest_to_json(const VersionManifest& m);

// ---------------------------------------------------------------------------
// Compatibility check — call on engine startup.
// Returns true if all version constraints are satisfied.
// On failure: writes a structured error to *error and returns false.
// Never throws.
//
// EXTENSION_POINT: version_negotiation
//   Add a min_peer_version parameter for cluster mode, where the engine
//   validates it can interoperate with peers running an older build.
// ---------------------------------------------------------------------------
struct CompatibilityResult {
  bool ok{true};
  std::string error_code;    // Empty if ok
  std::string description;   // Human-readable failure description
  uint32_t required_abi{ENGINE_ABI_VERSION};
  uint32_t actual_abi{ENGINE_ABI_VERSION};
};

CompatibilityResult check_compatibility(uint32_t caller_abi_version = ENGINE_ABI_VERSION);

}  // namespace version
}  // namespace requiem
