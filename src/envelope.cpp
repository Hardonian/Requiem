#include "requiem/envelope.hpp"
#include "requiem/jsonlite.hpp"

namespace requiem {

std::string envelope_to_json(const Envelope &env) {
  std::string out;
  out.reserve(256);
  out += "{\"v\":";
  out += std::to_string(env.v);
  out += ",\"kind\":\"";
  out += jsonlite::escape(env.kind);
  out += "\"";

  if (env.has_error) {
    out += ",\"data\":null";
    out += ",\"error\":{\"code\":\"";
    out += jsonlite::escape(env.error.code);
    out += "\",\"message\":\"";
    out += jsonlite::escape(env.error.message);
    out += "\",\"details\":{";
    bool first = true;
    for (const auto &[k, v] : env.error.details) {
      if (!first)
        out += ',';
      first = false;
      out += "\"";
      out += jsonlite::escape(k);
      out += "\":\"";
      out += jsonlite::escape(v);
      out += "\"";
    }
    out += "},\"retryable\":";
    out += env.error.retryable ? "true" : "false";
    out += "}";
  } else {
    out += ",\"data\":";
    if (env.data_json.empty()) {
      out += "null";
    } else {
      out += env.data_json;
    }
    out += ",\"error\":null";
  }

  out += "}";
  return out;
}

Envelope make_envelope(const std::string &kind, const std::string &data_json) {
  Envelope env;
  env.kind = kind;
  env.data_json = data_json;
  env.has_error = false;
  return env;
}

Envelope make_error_envelope(const std::string &code,
                             const std::string &message, bool retryable) {
  Envelope env;
  env.kind = "error";
  env.has_error = true;
  env.error.code = code;
  env.error.message = message;
  env.error.retryable = retryable;
  return env;
}

} // namespace requiem
