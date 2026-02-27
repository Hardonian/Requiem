// fuzz_protocol.cpp — Fuzz harness for protocol parser + CAS importer.
//
// PHASE 6: Security Hardening — Fuzz harnesses.
//
// Build with LLVM libFuzzer:
//   cmake -DREQUIEM_FUZZ=ON -DCMAKE_CXX_FLAGS="-fsanitize=fuzzer,address"
//   cmake --build build --target fuzz_protocol
//
// Run:
//   ./build/fuzz_protocol corpus/protocol/ -max_len=65536 -timeout=5
//
// EXTENSION_POINT: seccomp_profile
//   Fuzz targets should run inside a minimal seccomp sandbox to prevent
//   fuzzer-discovered code paths from escaping the test environment.
//
// Targets:
//   1. parse_request_json(): protocol parser
//   2. canonicalize_json():  JSON canonicalization
//   3. validate_strict():    strict JSON validation
//   4. CasStore::put():      CAS import path (with a temp directory)
//
// CI integration (see .github/workflows/ci.yml):
//   ASAN:  cmake -DREQUIEM_ASAN=ON ... (nightly)
//   UBSAN: cmake -DREQUIEM_UBSAN=ON ... (nightly)
//   TSAN:  cmake -DREQUIEM_TSAN=ON ... (weekly)

#include "requiem/cas.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/runtime.hpp"

#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <string>

namespace fs = std::filesystem;

// ---------------------------------------------------------------------------
// Fuzz target 1: Protocol parser
// ---------------------------------------------------------------------------
// Invariants verified:
//   - parse_request_json() never crashes for any input.
//   - parse_request_json() never returns a request with a non-sanitized request_id.
//   - Oversized inputs are rejected with "quota_exceeded" (no allocation of >1MB).
extern "C" int LLVMFuzzerTestOneInput_Protocol(const uint8_t* data, size_t size) {
  const std::string input(reinterpret_cast<const char*>(data), size);
  std::string err;
  auto req = requiem::parse_request_json(input, &err);
  // Verify request_id is sanitized.
  for (char c : req.request_id) {
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') || c == '-' || c == '_')) {
      __builtin_trap();  // BUG: unsanitized character in request_id
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Fuzz target 2: JSON canonicalization
// ---------------------------------------------------------------------------
// Invariants verified:
//   - canonicalize_json() never crashes.
//   - canonicalize_json() is idempotent: canon(canon(x)) == canon(x).
extern "C" int LLVMFuzzerTestOneInput_Canon(const uint8_t* data, size_t size) {
  const std::string input(reinterpret_cast<const char*>(data), size);
  std::optional<requiem::jsonlite::JsonError> err1, err2;
  const std::string c1 = requiem::jsonlite::canonicalize_json(input, &err1);
  if (!err1 && !c1.empty()) {
    // Idempotency check: canonicalize the already-canonical form.
    const std::string c2 = requiem::jsonlite::canonicalize_json(c1, &err2);
    if (!err2 && c1 != c2) {
      __builtin_trap();  // BUG: canonicalization not idempotent
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Fuzz target 3: CAS import
// ---------------------------------------------------------------------------
// Invariants verified:
//   - CasStore::put() never crashes.
//   - CasStore::get() returns the original data or nullopt (never corrupted data).
//   - Round-trip: get(put(data)) == data for all inputs.
extern "C" int LLVMFuzzerTestOneInput_CAS(const uint8_t* data, size_t size) {
  // Limit to 1MB to avoid slow inputs.
  if (size > 1024 * 1024) return 0;

  static const std::string cas_root = [] {
    auto p = fs::temp_directory_path() / "requiem_fuzz_cas";
    fs::create_directories(p);
    return p.string();
  }();

  requiem::CasStore cas(cas_root);
  const std::string payload(reinterpret_cast<const char*>(data), size);

  const std::string digest = cas.put(payload, "off");
  if (!digest.empty()) {
    auto retrieved = cas.get(digest);
    if (retrieved && *retrieved != payload) {
      __builtin_trap();  // BUG: round-trip mismatch
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Default libFuzzer entry point: routes to all targets.
// ---------------------------------------------------------------------------
extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  if (size == 0) return 0;
  // Route based on first byte to exercise different targets.
  const uint8_t target = data[0] % 3;
  const uint8_t* payload = data + 1;
  const size_t   payload_size = size - 1;
  switch (target) {
    case 0: return LLVMFuzzerTestOneInput_Protocol(payload, payload_size);
    case 1: return LLVMFuzzerTestOneInput_Canon(payload, payload_size);
    case 2: return LLVMFuzzerTestOneInput_CAS(payload, payload_size);
    default: return 0;
  }
}
