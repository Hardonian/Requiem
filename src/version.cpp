#include "requiem/version.hpp"

#include <sstream>

namespace requiem {
namespace version {

VersionManifest current_manifest(const std::string& engine_semver) {
  VersionManifest m;
  m.engine_semver   = engine_semver.empty() ? "0.8.0" : engine_semver;
  m.hash_primitive  = "blake3";
  // Build timestamp from preprocessor macros — deterministic within a single build.
  m.build_timestamp = std::string(__DATE__) + "T" + std::string(__TIME__);
  return m;
}

std::string manifest_to_json(const VersionManifest& m) {
  std::ostringstream o;
  o << "{"
    << "\"engine_abi\":" << m.engine_abi
    << ",\"hash_algorithm\":" << m.hash_algorithm
    << ",\"cas_format\":" << m.cas_format
    << ",\"protocol_framing\":" << m.protocol_framing
    << ",\"replay_log\":" << m.replay_log
    << ",\"audit_log\":" << m.audit_log
    << ",\"engine_semver\":\"" << m.engine_semver << "\""
    << ",\"hash_primitive\":\"" << m.hash_primitive << "\""
    << ",\"build_timestamp\":\"" << m.build_timestamp << "\""
    << "}";
  return o.str();
}

CompatibilityResult check_compatibility(uint32_t caller_abi_version) {
  CompatibilityResult r;
  if (caller_abi_version != ENGINE_ABI_VERSION) {
    r.ok          = false;
    r.error_code  = "abi_version_mismatch";
    r.description = "Caller ABI version " + std::to_string(caller_abi_version) +
                    " != engine ABI version " + std::to_string(ENGINE_ABI_VERSION) +
                    ". Rebuild the caller against the current engine headers.";
    r.required_abi = ENGINE_ABI_VERSION;
    r.actual_abi   = caller_abi_version;
  }
  return r;
}

}  // namespace version
}  // namespace requiem
