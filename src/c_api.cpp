#include "requiem/c_api.h"

// PHASE 5: Stable C ABI implementation.
//
// This file wraps the C++ API (runtime.hpp, observability.hpp) behind a pure-C
// boundary. Key invariants:
//   - No C++ types cross the ABI boundary.
//   - All output strings are strdup'd heap allocations, freed via requiem_free_string().
//   - All exceptions are caught internally; callers never see C++ exceptions.
//   - ctx is a heap-allocated opaque struct; never freed by the caller directly.

#include <cstring>
#include <string>

#include "requiem/jsonlite.hpp"
#include "requiem/observability.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"

// ---------------------------------------------------------------------------
// Opaque context struct
// ---------------------------------------------------------------------------
// EXTENSION_POINT: language_bindings
//   Future fields: per-context CAS root, event log path, worker pool reference.
//   Invariant: ctx must be fully independent; two ctx instances must not share state
//   (except the global EngineStats singleton, which is intentionally shared).
struct requiem_ctx {
  uint32_t    abi_version{REQUIEM_ABI_VERSION};
  std::string cas_root{".requiem/cas/v2"};
  std::string event_log_path;
  // EXTENSION_POINT: allocator_strategy
  // Future: per-ctx arena allocator reference injected here.
};

extern "C" {

uint32_t requiem_abi_version(void) {
  return REQUIEM_ABI_VERSION;
}

requiem_ctx_t* requiem_init(const char* config_json, uint32_t abi_version) {
  // Version check — fail fast on incompatible ABI.
  if (abi_version != REQUIEM_ABI_VERSION) {
    return nullptr;
  }

  try {
    auto* ctx = new requiem_ctx();

    // Parse optional config (best-effort — ignore unknown keys).
    if (config_json && config_json[0]) {
      std::string cfg(config_json);
      // Parse cas_root
      std::optional<requiem::jsonlite::JsonError> err;
      auto obj = requiem::jsonlite::parse(cfg, &err);
      if (!err) {
        ctx->cas_root = requiem::jsonlite::get_string(obj, "cas_root", ctx->cas_root);
        ctx->event_log_path = requiem::jsonlite::get_string(obj, "event_log_path", "");
      }
    }

    return ctx;
  } catch (...) {
    return nullptr;
  }
}

char* requiem_execute(requiem_ctx_t* ctx, const char* request_json) {
  if (!ctx || !request_json) return nullptr;

  try {
    std::string err;
    auto req = requiem::parse_request_json(std::string(request_json), &err);
    if (!err.empty()) {
      std::string result = "{\"ok\":false,\"error_code\":\"" + err + "\","
                           "\"result_digest\":\"\",\"request_digest\":\"\"}";
      return strdup(result.c_str());
    }

    auto result = requiem::execute(req);
    std::string json = requiem::result_to_json(result);
    return strdup(json.c_str());
  } catch (...) {
    return nullptr;
  }
}

char* requiem_replay(requiem_ctx_t* ctx,
                     const char* request_json,
                     const char* expected_result_json) {
  if (!ctx || !request_json || !expected_result_json) return nullptr;

  try {
    std::string req_err;
    auto req = requiem::parse_request_json(std::string(request_json), &req_err);
    if (!req_err.empty()) {
      std::string r = "{\"ok\":false,\"error\":\"invalid_request: " + req_err + "\"}";
      return strdup(r.c_str());
    }

    // Re-execute and compare result_digest.
    auto result = requiem::execute(req);

    // Extract expected result_digest from provided JSON.
    const std::string expected_digest =
        requiem::jsonlite::get_string(std::string(expected_result_json), "result_digest", "");

    bool match = !expected_digest.empty() && (result.result_digest == expected_digest);

    // Update replay divergence counter.
    if (!match) {
      requiem::global_engine_stats().replay_divergences.fetch_add(
          1, std::memory_order_relaxed);
    } else {
      requiem::global_engine_stats().replay_verifications.fetch_add(
          1, std::memory_order_relaxed);
    }

    std::string r = "{\"ok\":";
    r += match ? "true" : "false";
    r += ",\"expected_digest\":\"";
    r += expected_digest;
    r += "\",\"actual_digest\":\"";
    r += result.result_digest;
    r += "\"}";
    return strdup(r.c_str());
  } catch (...) {
    return nullptr;
  }
}

char* requiem_stats(requiem_ctx_t* ctx) {
  if (!ctx) return nullptr;
  try {
    std::string json = requiem::global_engine_stats().to_json();
    return strdup(json.c_str());
  } catch (...) {
    return nullptr;
  }
}

void requiem_free_string(char* s) {
  // OWNERSHIP: s was allocated via strdup() in this compilation unit.
  // Must NOT be freed by calling free() or delete[] from caller code.
  free(s);  // NOLINT: intentional — strdup allocates with malloc
}

void requiem_shutdown(requiem_ctx_t* ctx) {
  delete ctx;
}

}  // extern "C"
