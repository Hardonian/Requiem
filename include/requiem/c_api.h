/*
 * requiem/c_api.h — Stable C ABI for embedding Requiem in any language.
 *
 * PHASE 5: Stable C ABI + Embedding Surface
 *
 * This header defines a versioned C ABI that allows embedding the Requiem
 * deterministic execution engine in Python, Go, Rust, Node.js, and other languages
 * without exposing any C++ types.
 *
 * OWNERSHIP CONTRACT:
 *   - Caller owns all INPUT strings. Requiem copies them internally as needed.
 *   - All OUTPUT strings returned by this API are heap-allocated C strings.
 *   - Caller MUST free output strings via requiem_free_string().
 *   - Do NOT free output strings with free() or delete[] — always use requiem_free_string().
 *   - requiem_ctx_t* is opaque. Never dereference or copy.
 *
 * THREAD SAFETY:
 *   - requiem_init() and requiem_shutdown() are NOT thread-safe.
 *   - requiem_execute(), requiem_replay(), requiem_stats() ARE thread-safe.
 *   - Multiple threads may call requiem_execute() concurrently on the same ctx.
 *
 * ABI VERSIONING:
 *   - REQUIEM_ABI_VERSION is the current ABI version.
 *   - Future breaking changes bump this version.
 *   - requiem_init() returns NULL if the requested ABI version is unsupported.
 *   - Callers should pass REQUIEM_ABI_VERSION to requiem_init().
 *
 * EXTENSION_POINT: language_bindings
 *   Current: C ABI only.
 *   Planned bindings:
 *     - Python: ctypes or cffi wrapper (reach-python)
 *     - Go:     cgo wrapper (reach-go)
 *     - Rust:   bindgen (reach-rs)
 *     - Node.js: N-API native addon (ready-layer server)
 *   Invariant: no C++ types, no exceptions, no STL containers cross this boundary.
 *   All output is JSON strings. Callers parse JSON in their own language.
 *
 * EXAMPLE (C):
 *   requiem_ctx_t* ctx = requiem_init("{}", REQUIEM_ABI_VERSION);
 *   char* result = requiem_execute(ctx, request_json);
 *   printf("%s\n", result);
 *   requiem_free_string(result);
 *   requiem_shutdown(ctx);
 */

#pragma once

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Current C ABI version. Bump on any breaking change. */
#define REQUIEM_ABI_VERSION 1

/* Opaque engine context. Never dereference. */
typedef struct requiem_ctx requiem_ctx_t;

/*
 * requiem_init — Initialize the Requiem engine.
 *
 * config_json: Engine configuration as a JSON object. Pass "{}" for defaults.
 *   Keys (all optional):
 *     "event_log_path": path for JSONL execution event log (default: no log)
 *     "cas_root":       CAS storage root directory (default: ".requiem/cas/v2")
 *
 * abi_version: Pass REQUIEM_ABI_VERSION. Returns NULL if version mismatch.
 *
 * Returns: Allocated context pointer on success, NULL on failure.
 * Caller must call requiem_shutdown() when done.
 */
requiem_ctx_t* requiem_init(const char* config_json, uint32_t abi_version);

/*
 * requiem_execute — Execute a deterministic request.
 *
 * request_json: Serialized ExecutionRequest JSON (see requiem/types.hpp).
 *
 * Returns: Serialized ExecutionResult JSON (caller must free via requiem_free_string).
 *   Returns NULL only on catastrophic internal error (OOM, unrecoverable).
 *   On normal errors (path_escape, timeout, etc.), returns a valid JSON result
 *   with ok=false and the appropriate error_code.
 *
 * Thread-safe: yes.
 */
char* requiem_execute(requiem_ctx_t* ctx, const char* request_json);

/*
 * requiem_replay — Validate that a result matches a re-execution.
 *
 * request_json: Original request.
 * expected_result_json: Previously captured ExecutionResult JSON.
 *
 * Returns: JSON object with "ok" (bool) and "error" (string if not ok).
 *   Caller must free via requiem_free_string.
 *
 * Thread-safe: yes.
 */
char* requiem_replay(requiem_ctx_t* ctx,
                     const char* request_json,
                     const char* expected_result_json);

/*
 * requiem_stats — Get engine statistics as JSON.
 *
 * Returns: JSON object with engine metrics (see observability.hpp: EngineStats::to_json).
 *   Includes: total_executions, successful, failed, replay_divergences, latency percentiles.
 *   Caller must free via requiem_free_string.
 *
 * Thread-safe: yes.
 *
 * EXTENSION_POINT: anomaly_detection_layer
 *   Hook: Enterprise editions can call requiem_stats() periodically and forward
 *   metrics to Prometheus, Grafana, or a custom alerting pipeline.
 */
char* requiem_stats(requiem_ctx_t* ctx);

/*
 * requiem_free_string — Free a string returned by the Requiem C API.
 *
 * MUST be called for every non-NULL string returned by requiem_execute(),
 * requiem_replay(), and requiem_stats(). Do NOT use free() or delete[].
 */
void requiem_free_string(char* s);

/*
 * requiem_shutdown — Shutdown the engine and free all resources.
 *
 * After this call, ctx is invalid and must not be used.
 * Not thread-safe: ensure no concurrent execute/replay calls are in progress.
 */
void requiem_shutdown(requiem_ctx_t* ctx);

/*
 * requiem_abi_version — Return the compiled ABI version.
 * Use to verify compatibility at runtime.
 */
uint32_t requiem_abi_version(void);

#ifdef __cplusplus
}  /* extern "C" */
#endif
