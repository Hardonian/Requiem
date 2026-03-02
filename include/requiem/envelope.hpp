#pragma once

// requiem/envelope.hpp — Versioned schema envelope for all kernel I/O.
//
// KERNEL_SPEC §3: Every CLI response and API response is wrapped in a typed
// envelope with version, kind, data, and error fields.
//
// INVARIANT: INV-ENVELOPE — All CLI/API output MUST use this envelope.

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace requiem {

// Error envelope (nested inside the main envelope on failure).
struct ErrorEnvelope {
  std::string code;       // Machine-readable ErrorCode string
  std::string message;    // Human-readable description
  std::map<std::string, std::string> details;
  bool retryable{false};
};

// Versioned schema envelope wrapping all kernel output.
struct Envelope {
  uint32_t v{1};                   // Envelope schema version
  std::string kind;                // Dot-separated type identifier
  std::string data_json;           // Success payload as canonical JSON (or empty)
  bool has_error{false};
  ErrorEnvelope error;             // Error payload (valid only when has_error)
};

// Serialize an envelope to canonical JSON.
std::string envelope_to_json(const Envelope& env);

// Convenience: wrap a successful data payload.
Envelope make_envelope(const std::string& kind, const std::string& data_json);

// Convenience: wrap an error.
Envelope make_error_envelope(const std::string& code, const std::string& message,
                             bool retryable = false);

}  // namespace requiem
