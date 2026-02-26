#include "requiem/types.hpp"

namespace requiem {

std::string to_string(ErrorCode code) {
  switch (code) {
    case ErrorCode::none: return "";
    case ErrorCode::json_parse_error: return "json_parse_error";
    case ErrorCode::json_duplicate_key: return "json_duplicate_key";
    case ErrorCode::path_escape: return "path_escape";
    case ErrorCode::missing_input: return "missing_input";
    case ErrorCode::spawn_failed: return "spawn_failed";
    case ErrorCode::timeout: return "timeout";
    case ErrorCode::cas_integrity_failed: return "cas_integrity_failed";
    case ErrorCode::replay_failed: return "replay_failed";
    case ErrorCode::drift_detected: return "drift_detected";
  }
  return "";
}

}  // namespace requiem
