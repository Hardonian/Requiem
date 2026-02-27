#include <atomic>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

#ifndef REQUIEM_NO_C_API
#include "requiem/c_api.h"
#endif
#include "requiem/audit.hpp"
#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/metering.hpp"
#include "requiem/observability.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"
#include "requiem/version.hpp"
#include "requiem/worker.hpp"

namespace fs = std::filesystem;

namespace {
int g_tests_run = 0;
int g_tests_passed = 0;

void expect(bool condition, const std::string& message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << "\n";
    std::exit(1);
  }
}

void run_test(const std::string& name, void (*fn)()) {
  std::cout << "  " << name << "...";
  fn();
  std::cout << " PASSED\n";
  g_tests_run++;
  g_tests_passed++;
}

// ============================================================================
// Phase 1: Hash Unification & Fingerprint Authority
// ============================================================================

void test_blake3_known_vectors() {
  // Empty string — official BLAKE3 test vector
  expect(requiem::blake3_hex("") == "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
         "BLAKE3 empty vector");
  // "hello" — official test vector
  expect(requiem::blake3_hex("hello") == "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f",
         "BLAKE3 hello vector");
}

void test_canonical_request_digest() {
  // Canonical request with known fields → expected digest must be stable.
  requiem::ExecutionRequest req;
  req.request_id = "test-vec-1";
  req.command = "/bin/echo";
  req.argv = {"hello"};
  req.workspace_root = ".";
  req.policy.scheduler_mode = "turbo";
  req.nonce = 0;

  const std::string canon = requiem::canonicalize_request(req);
  const std::string digest = requiem::deterministic_digest(canon);
  expect(digest.size() == 64, "request digest must be 64 hex chars");

  // Same request → same digest (determinism)
  const std::string digest2 = requiem::deterministic_digest(requiem::canonicalize_request(req));
  expect(digest == digest2, "request digest must be deterministic");
}

void test_canonical_result_digest() {
  requiem::ExecutionResult res;
  res.ok = true;
  res.exit_code = 0;
  res.request_digest = "a" + std::string(63, '0');
  res.stdout_digest = "b" + std::string(63, '0');
  res.stderr_digest = "c" + std::string(63, '0');
  res.trace_digest = "d" + std::string(63, '0');
  res.termination_reason = "";

  const std::string canon = requiem::canonicalize_result(res);
  const std::string digest = requiem::deterministic_digest(canon);
  expect(digest.size() == 64, "result digest must be 64 hex chars");

  const std::string digest2 = requiem::deterministic_digest(requiem::canonicalize_result(res));
  expect(digest == digest2, "result digest must be deterministic");
}

void test_hash_runtime_info() {
  const auto info = requiem::hash_runtime_info();
  expect(info.blake3_available, "BLAKE3 must be available");
  expect(info.primitive == "blake3", "primitive must be blake3");
  expect(info.backend == "vendored", "backend must be vendored");
  expect(!info.compat_warning, "no compat warning with vendored BLAKE3");
  expect(!info.fallback_allowed, "fallback must be permanently disabled");
  expect(!info.version.empty(), "version must be reported");
}

void test_domain_separation() {
  const std::string data = "test data";
  const std::string req_hash = requiem::hash_domain("req:", data);
  const std::string res_hash = requiem::hash_domain("res:", data);
  const std::string cas_hash = requiem::hash_domain("cas:", data);

  expect(req_hash != res_hash, "req and res domains must differ");
  expect(req_hash != cas_hash, "req and cas domains must differ");
  expect(res_hash != cas_hash, "res and cas domains must differ");
  expect(req_hash == requiem::hash_domain("req:", data), "domain hash must be deterministic");
}

void test_file_hashing() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_hash_test";
  fs::create_directories(tmp);

  const std::string content = "test content for file hashing";
  const fs::path test_file = tmp / "test_file.txt";
  { std::ofstream ofs(test_file, std::ios::binary); ofs << content; }

  const std::string file_hash = requiem::hash_file_blake3(test_file.string());
  const std::string bytes_hash = requiem::hash_bytes_blake3(content);
  expect(!file_hash.empty(), "file hash non-empty");
  expect(file_hash == bytes_hash, "file hash == bytes hash for same content");
  expect(requiem::hash_file_blake3("/nonexistent").empty(), "missing file returns empty");

  fs::remove_all(tmp);
}

void test_binary_hex_consistency() {
  const std::string data = "binary test data";
  const std::string binary_hash = requiem::hash_bytes_blake3(data);
  const std::string hex_hash = requiem::blake3_hex(data);
  expect(binary_hash.length() == 32, "binary hash = 32 bytes");
  expect(hex_hash.length() == 64, "hex hash = 64 chars");

  std::string manual_hex;
  const char* hc = "0123456789abcdef";
  for (unsigned char c : binary_hash) {
    manual_hex.push_back(hc[c >> 4]);
    manual_hex.push_back(hc[c & 0xf]);
  }
  expect(manual_hex == hex_hash, "binary→hex must match direct hex");
}

// ============================================================================
// Phase 3: Fixed-Point & Numeric Determinism
// ============================================================================

void test_json_canonicalization() {
  std::optional<requiem::jsonlite::JsonError> err;
  const auto c1 = requiem::jsonlite::canonicalize_json("{\"b\":1,\"a\":2}", &err);
  expect(!err.has_value(), "valid json canonicalizes");
  const auto c2 = requiem::jsonlite::canonicalize_json("{\"a\":2,\"b\":1}", &err);
  expect(c1 == c2, "key order variations canonicalize identically");

  auto dup = requiem::jsonlite::validate_strict("{\"a\":1,\"a\":2}");
  expect(dup.has_value() && dup->code == "json_duplicate_key", "duplicate keys rejected");
}

void test_json_double_parsing() {
  std::optional<requiem::jsonlite::JsonError> err;
  auto obj = requiem::jsonlite::parse("{\"value\": 3.14159}", &err);
  expect(!err.has_value(), "double parsing ok");
  double val = requiem::jsonlite::get_double(obj, "value", 0.0);
  expect(val > 3.14 && val < 3.15, "double value ~3.14159");

  obj = requiem::jsonlite::parse("{\"value\": -42}", &err);
  val = requiem::jsonlite::get_double(obj, "value", 0.0);
  expect(val == -42.0, "negative integer as double");

  obj = requiem::jsonlite::parse("{\"value\": 1.5e10}", &err);
  val = requiem::jsonlite::get_double(obj, "value", 0.0);
  expect(val == 1.5e10, "scientific notation");
}

void test_no_float_in_digest_path() {
  // Ensure canonicalize_request uses integer nonce, not float.
  requiem::ExecutionRequest req;
  req.request_id = "fp-test";
  req.command = "/bin/true";
  req.nonce = 12345;
  req.workspace_root = ".";
  req.policy.scheduler_mode = "turbo";
  const std::string canon = requiem::canonicalize_request(req);
  // nonce must appear as integer literal, not floating point
  expect(canon.find("\"nonce\":12345") != std::string::npos, "nonce must be integer in canonical form");
  expect(canon.find("12345.") == std::string::npos, "nonce must not be float in canonical form");
}

// ============================================================================
// Phase 4: Security Hardening
// ============================================================================

void test_path_escape_blocked() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_escape_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest request;
  request.request_id = "escape-test";
  request.workspace_root = tmp.string();
  request.command = "/bin/sh";
  request.argv = {"-c", "echo nope"};
  request.cwd = "../../etc";  // Attempted escape

  const auto result = requiem::execute(request);
  expect(result.error_code == "path_escape", "traversal must be blocked");
  expect(result.exit_code == 2, "exit code 2 on path escape");

  fs::remove_all(tmp);
}

void test_secret_env_stripping() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_secret_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest request;
  request.request_id = "secret-test";
  request.workspace_root = tmp.string();
  request.command = "/bin/sh";
  request.argv = {"-c", "echo ok"};
  request.env["SAFE_VAR"] = "ok";
  request.env["MY_SECRET_TOKEN"] = "should-be-stripped";
  request.env["REACH_ENCRYPTION_KEY"] = "should-be-stripped";
  request.env["AUTH_COOKIE"] = "should-be-stripped";
  request.policy.mode = "permissive";

  const auto result = requiem::execute(request);

  // Verify secrets were denied
  bool safe_allowed = false;
  for (const auto& k : result.policy_applied.allowed_keys) {
    if (k == "SAFE_VAR") safe_allowed = true;
    expect(k != "MY_SECRET_TOKEN", "secret token must not be allowed");
    expect(k != "REACH_ENCRYPTION_KEY", "encryption key must not be allowed");
    expect(k != "AUTH_COOKIE", "auth cookie must not be allowed");
  }
  expect(safe_allowed, "non-secret var must pass through");

  fs::remove_all(tmp);
}

void test_request_id_sanitization() {
  std::string err;
  auto req = requiem::parse_request_json(
      "{\"request_id\":\"../../../etc/passwd\",\"command\":\"/bin/true\"}", &err);
  // Slashes must be stripped
  expect(req.request_id.find('/') == std::string::npos, "request_id must not contain /");
  expect(req.request_id.find("..") == std::string::npos, "request_id must not contain ..");
}

// ============================================================================
// Phase 5: Daemon & Resource Stability
// ============================================================================

void test_request_size_cap() {
  // A payload exceeding 1MB should be rejected.
  std::string huge(2 * 1024 * 1024, 'x');
  std::string err;
  auto req = requiem::parse_request_json(huge, &err);
  expect(err == "quota_exceeded", "oversized payload must be rejected");
}

// ============================================================================
// Phase 6: CAS Scale Readiness
// ============================================================================

void test_cas_put_get_integrity() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_test";
  fs::remove_all(tmp);
  fs::create_directories(tmp);

  requiem::CasStore cas(tmp.string());
  const std::string data = "artifact data for CAS test";
  const std::string d1 = cas.put(data, "off");
  expect(!d1.empty(), "CAS put returns digest");

  // Dedup: same data returns same digest.
  const std::string d2 = cas.put(data, "off");
  expect(d1 == d2, "CAS key is content-derived");

  // Get returns original data.
  auto retrieved = cas.get(d1);
  expect(retrieved.has_value(), "CAS get succeeds");
  expect(*retrieved == data, "CAS round-trip matches");

  // Info works.
  auto info = cas.info(d1);
  expect(info.has_value(), "CAS info available");
  expect(info->original_size == data.size(), "CAS info size matches");

  fs::remove_all(tmp);
}

void test_cas_corruption_detection() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_corrupt_test";
  fs::remove_all(tmp);
  fs::create_directories(tmp);

  requiem::CasStore cas(tmp.string());
  const std::string data = "test data for corruption check";
  const std::string digest = cas.put(data, "off");
  expect(!digest.empty(), "CAS put returns digest");

  // Corrupt the stored file.
  std::string obj_path = (fs::path(tmp) / "objects" / digest.substr(0, 2) / digest.substr(2, 2) / digest).string();
  {
    std::fstream file(obj_path, std::ios::in | std::ios::out | std::ios::binary);
    expect(file.good(), "can open object file");
    char byte;
    file.read(&byte, 1);
    byte ^= 0xFF;
    file.seekp(0);
    file.write(&byte, 1);
  }

  auto corrupted = cas.get(digest);
  expect(!corrupted.has_value(), "CAS detects corruption → nullopt");

  fs::remove_all(tmp);
}

void test_cas_invalid_digest_rejected() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_invalid_test";
  fs::remove_all(tmp);
  requiem::CasStore cas(tmp.string());

  // Invalid digest (too short)
  expect(!cas.contains("abc"), "invalid digest: too short");
  expect(!cas.get("abc").has_value(), "get with invalid digest returns nullopt");
  expect(!cas.info("abc").has_value(), "info with invalid digest returns nullopt");

  // Invalid digest (right length, wrong chars)
  std::string bad(64, 'x');
  expect(!cas.contains(bad), "invalid digest: non-hex chars");

  fs::remove_all(tmp);
}

void test_cas_bulk_insert() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_bulk_test";
  fs::remove_all(tmp);
  requiem::CasStore cas(tmp.string());

  for (int i = 0; i < 100; ++i) {
    std::string data = "bulk-test-item-" + std::to_string(i);
    std::string d = cas.put(data, "off");
    expect(!d.empty(), "bulk put must succeed");
    auto got = cas.get(d);
    expect(got.has_value() && *got == data, "bulk round-trip must match");
  }

  auto objects = cas.scan_objects();
  expect(objects.size() == 100, "scan must find 100 objects");

  fs::remove_all(tmp);
}

// ============================================================================
// Execution & Replay
// ============================================================================

void test_determinism_repeat() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_det_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest request;
  request.request_id = "det-test";
  request.workspace_root = tmp.string();
  request.command = "/bin/sh";
  request.argv = {"-c", "echo deterministic_output"};
  request.policy.deterministic = true;

  const int N = 20;
  std::string first_result_digest;
  std::string first_stdout_digest;

  for (int i = 0; i < N; ++i) {
    auto result = requiem::execute(request);
    expect(result.ok, "execution must succeed");
    if (i == 0) {
      first_result_digest = result.result_digest;
      first_stdout_digest = result.stdout_digest;
    } else {
      expect(result.result_digest == first_result_digest, "result_digest deterministic");
      expect(result.stdout_digest == first_stdout_digest, "stdout_digest deterministic");
    }
  }

  fs::remove_all(tmp);
}

void test_stdout_truncation() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_trunc_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest request;
  request.request_id = "trunc-test";
  request.workspace_root = tmp.string();
  request.command = "/bin/sh";
  request.argv = {"-c", "printf 'ABCDEFGHIJ'"};
  request.max_output_bytes = 4;

  const auto result = requiem::execute(request);
  expect(result.stdout_truncated, "stdout must truncate at max_output_bytes");

  fs::remove_all(tmp);
}

void test_timeout() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_timeout_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest request;
  request.request_id = "timeout-test";
  request.workspace_root = tmp.string();
  request.command = "/bin/sh";
  request.argv = {"-c", "sleep 10"};
  request.timeout_ms = 50;

  const auto result = requiem::execute(request);
  expect(result.exit_code == 124, "timeout exit code = 124");
  expect(result.termination_reason == "timeout", "termination_reason = timeout");

  fs::remove_all(tmp);
}

void test_replay_validation() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_replay_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest request;
  request.request_id = "replay-test";
  request.workspace_root = tmp.string();
  request.command = "/bin/sh";
  request.argv = {"-c", "echo ok > out.txt"};
  request.outputs = {"out.txt"};

  const auto result = requiem::execute(request);
  expect(result.ok, "execution must succeed");
  expect(requiem::validate_replay(request, result), "replay validation must pass");

  fs::remove_all(tmp);
}

}  // namespace

// ============================================================================
// Production Hardening: Multi-tenant isolation
// ============================================================================

void test_multitenant_cas_isolation() {
  // Each tenant gets its own CAS root — digests from tenant A must not be
  // readable from tenant B's CAS store.
  const fs::path tmp = fs::temp_directory_path() / "rq_mt_cas_test";
  fs::remove_all(tmp);

  requiem::CasStore cas_a((tmp / "tenant-a").string());
  requiem::CasStore cas_b((tmp / "tenant-b").string());

  const std::string data_a = "tenant-a-private-content-unique";
  const std::string digest  = cas_a.put(data_a, "off");
  expect(!digest.empty(), "tenant-a: put must succeed");

  // tenant-b must not see tenant-a's digest.
  expect(!cas_b.contains(digest), "cross-tenant CAS read must be blocked");
  expect(!cas_b.get(digest).has_value(), "cross-tenant CAS get must return nullopt");

  fs::remove_all(tmp);
}

void test_multitenant_fingerprint_determinism() {
  // Identical requests across different tenants must produce IDENTICAL
  // request_digest values (request_digest is policy-canonical, not tenant-specific).
  // result_digest may differ only if tenant_id is included in canonicalization;
  // currently tenant_id is not part of the canonical request, so it must be identical.
  const fs::path tmp = fs::temp_directory_path() / "rq_mt_fp_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest req_a;
  req_a.request_id      = "mt-fp-001";
  req_a.tenant_id       = "tenant-alpha";
  req_a.workspace_root  = tmp.string();
  req_a.command         = "/bin/sh";
  req_a.argv            = {"-c", "echo deterministic"};
  req_a.policy.deterministic = true;
  req_a.nonce           = 42;

  requiem::ExecutionRequest req_b = req_a;
  req_b.tenant_id = "tenant-beta";  // different tenant, same everything else

  const std::string canon_a = requiem::canonicalize_request(req_a);
  const std::string canon_b = requiem::canonicalize_request(req_b);
  // Canonicalization must not include tenant_id (tenant isolation is at infra layer).
  expect(canon_a == canon_b, "canonical request must not include tenant_id");

  const std::string dig_a = requiem::deterministic_digest(canon_a);
  const std::string dig_b = requiem::deterministic_digest(canon_b);
  expect(dig_a == dig_b, "request_digest must be identical across tenants for same request");

  fs::remove_all(tmp);
}

void test_multitenant_concurrent_isolation() {
  // 10 tenants run concurrently — no cross-tenant result bleed.
  const fs::path tmp = fs::temp_directory_path() / "rq_mt_conc_test";
  fs::create_directories(tmp);

  constexpr int kTenants = 10;
  std::vector<std::string> digests(kTenants);
  std::atomic<int> fail_count{0};

  std::vector<std::thread> threads;
  for (int i = 0; i < kTenants; ++i) {
    threads.emplace_back([&, i]() {
      requiem::ExecutionRequest req;
      req.request_id      = "mt-conc-" + std::to_string(i);
      req.tenant_id       = "tenant-" + std::to_string(i);
      req.workspace_root  = tmp.string();
      req.command         = "/bin/sh";
      req.argv            = {"-c", "echo tenant_" + std::to_string(i)};
      req.policy.deterministic = true;

      const auto result = requiem::execute(req);
      digests[i] = result.stdout_text;
      // Each tenant's stdout must contain its own identifier.
      if (result.stdout_text.find("tenant_" + std::to_string(i)) == std::string::npos) {
        ++fail_count;
      }
    });
  }
  for (auto& t : threads) t.join();

  expect(fail_count.load() == 0, "no cross-tenant stdout bleed in concurrent execution");
  // All digests must be distinct (different commands).
  for (int i = 0; i < kTenants; ++i) {
    for (int j = i + 1; j < kTenants; ++j) {
      expect(digests[i] != digests[j], "tenant outputs must be distinct");
    }
  }

  fs::remove_all(tmp);
}

// ============================================================================
// Production Hardening: Metering / billing
// ============================================================================

void test_metering_exactly_once() {
  requiem::MeterLog meter;

  // Emit 10 events for distinct request_digests.
  for (int i = 0; i < 10; ++i) {
    auto ev = requiem::make_meter_event(
        "tenant-1", "req-" + std::to_string(i),
        requiem::blake3_hex("digest-" + std::to_string(i)),
        /*success=*/true, "", /*is_shadow=*/false);
    meter.emit(ev);
  }

  expect(meter.count_primary_success() == 10, "meter: 10 primary success events");
  expect(meter.count_shadow() == 0, "meter: zero shadow events");
  expect(meter.verify_parity(10).empty(), "meter: parity check passes for 10");
}

void test_metering_shadow_zero() {
  requiem::MeterLog meter;

  // Shadow events must never enter the log.
  for (int i = 0; i < 50; ++i) {
    auto ev = requiem::make_meter_event(
        "shadow-tenant", "shadow-" + std::to_string(i),
        requiem::blake3_hex("s" + std::to_string(i)),
        /*success=*/true, "", /*is_shadow=*/true);
    meter.emit(ev);  // must be no-op
  }

  expect(meter.count_primary_success() == 0, "shadow: no primary events emitted");
  expect(meter.count_shadow() == 0, "shadow: shadow events not stored");
  expect(meter.verify_parity(0).empty(), "shadow: parity passes with 0 expected");
}

void test_metering_duplicate_detection() {
  requiem::MeterLog meter;

  const std::string shared_digest = requiem::blake3_hex("shared_request_input");
  // Emit two events with the same request_digest (simulates double-billing retry).
  auto ev1 = requiem::make_meter_event("t", "req-1", shared_digest, true, "", false);
  auto ev2 = requiem::make_meter_event("t", "req-2", shared_digest, true, "", false);
  meter.emit(ev1);
  meter.emit(ev2);

  const auto dups = meter.find_duplicates();
  expect(!dups.empty(), "meter: duplicate request_digest detected");
}

void test_billing_no_charge_on_failure() {
  // Verify explicit billing rules: failed executions do not charge.
  expect(requiem::billing_behavior_for_error("") == requiem::BillingBehavior::charge,
         "billing: empty error = charge");
  expect(requiem::billing_behavior_for_error("timeout") == requiem::BillingBehavior::no_charge,
         "billing: timeout = no_charge");
  expect(requiem::billing_behavior_for_error("quota_exceeded") == requiem::BillingBehavior::no_charge,
         "billing: quota_exceeded = no_charge");
  expect(requiem::billing_behavior_for_error("spawn_failed") == requiem::BillingBehavior::no_charge,
         "billing: spawn_failed = no_charge");
  expect(requiem::billing_behavior_for_error("cas_integrity_failed") == requiem::BillingBehavior::no_charge,
         "billing: cas_integrity_failed = no_charge");
  expect(requiem::billing_behavior_for_error("path_escape") == requiem::BillingBehavior::no_charge,
         "billing: path_escape = no_charge");
}

// ============================================================================
// Production Hardening: Determinism under concurrency (mini shadow run)
// ============================================================================

void test_determinism_concurrent_20_threads() {
  const fs::path tmp = fs::temp_directory_path() / "rq_det_conc_test";
  fs::create_directories(tmp);

  constexpr int kThreads = 20;
  requiem::ExecutionRequest req;
  req.request_id      = "det-conc-001";
  req.workspace_root  = tmp.string();
  req.command         = "/bin/sh";
  req.argv            = {"-c", "echo concurrent_determinism_check"};
  req.policy.deterministic = true;
  req.nonce           = 0;

  std::string expected_digest;
  std::atomic<int> drift_count{0};

  {
    const auto r = requiem::execute(req);
    expected_digest = r.result_digest;
    expect(!expected_digest.empty(), "reference result_digest must be non-empty");
  }

  std::vector<std::thread> threads;
  for (int i = 0; i < kThreads; ++i) {
    threads.emplace_back([&]() {
      const auto r = requiem::execute(req);
      if (r.result_digest != expected_digest) ++drift_count;
    });
  }
  for (auto& t : threads) t.join();

  expect(drift_count.load() == 0,
         "no determinism drift across " + std::to_string(kThreads) + " concurrent threads");

  fs::remove_all(tmp);
}

// ============================================================================
// Phase 2: HashEnvelope — versioned hash schema
// ============================================================================

void test_hash_envelope_roundtrip() {
  const std::string hex = requiem::blake3_hex("test envelope data");
  expect(hex.size() == 64, "blake3_hex must be 64 chars");

  requiem::HashEnvelope env{};
  expect(requiem::hash_envelope_from_hex(env, hex), "hash_envelope_from_hex must succeed");
  expect(env.hash_version == 1, "hash_version must be 1");
  expect(std::string(env.algorithm) == "blake3", "algorithm must be blake3");
  expect(std::string(env.engine_version).size() > 0, "engine_version must be populated");

  const std::string roundtrip = requiem::hash_envelope_to_hex(env);
  expect(roundtrip == hex, "hash_envelope round-trip must produce same hex");
}

void test_hash_envelope_rejects_invalid() {
  requiem::HashEnvelope env{};
  // Too short
  expect(!requiem::hash_envelope_from_hex(env, "abc"), "short hex rejected");
  // Non-hex characters
  std::string bad(64, 'g');
  expect(!requiem::hash_envelope_from_hex(env, bad), "non-hex chars rejected");
  // Uppercase hex should be accepted
  const std::string upper_hex(64, 'A');  // All 'A' = valid hex
  expect(requiem::hash_envelope_from_hex(env, upper_hex), "uppercase hex accepted");
}

// ============================================================================
// Phase 4: Observability — ExecutionEvent + EngineStats
// ============================================================================

void test_engine_stats_accumulation() {
  // Use a local EngineStats to avoid polluting global state.
  requiem::EngineStats stats;
  expect(stats.total_executions.load() == 0, "fresh stats: zero executions");

  requiem::ExecutionEvent ev;
  ev.execution_id = "test-ev-1";
  ev.ok = true;
  ev.duration_ns = 5'000'000;  // 5ms

  stats.record_execution(ev);
  expect(stats.total_executions.load() == 1, "record_execution increments total");
  expect(stats.successful_executions.load() == 1, "record_execution increments successful");
  expect(stats.failed_executions.load() == 0, "no failed increments for ok=true");

  ev.ok = false;
  ev.error_code = "timeout";
  stats.record_execution(ev);
  expect(stats.total_executions.load() == 2, "second record increments total");
  expect(stats.failed_executions.load() == 1, "failed increments for ok=false");
}

void test_engine_stats_to_json() {
  requiem::EngineStats stats;
  requiem::ExecutionEvent ev;
  ev.ok = true;
  ev.duration_ns = 10'000'000;  // 10ms
  stats.record_execution(ev);

  const std::string json = stats.to_json();
  expect(!json.empty(), "to_json must return non-empty string");
  expect(json.find("total_executions") != std::string::npos, "to_json contains total_executions");
  expect(json.find("latency") != std::string::npos, "to_json contains latency histogram");
  expect(json.find("replay_divergences") != std::string::npos, "to_json contains replay_divergences");
  expect(json.find("cache_metrics") != std::string::npos, "to_json contains cache_metrics");
  expect(json.front() == '{' && json.back() == '}', "to_json is a JSON object");
}

void test_latency_histogram_percentile() {
  requiem::LatencyHistogram hist;
  // Insert 100 samples at 1ms each.
  for (int i = 0; i < 100; ++i) {
    hist.record(1'000'000);  // 1ms = 1000us
  }
  expect(hist.count() == 100, "histogram count must be 100");
  const double p50 = hist.percentile(0.50);
  const double p99 = hist.percentile(0.99);
  expect(p50 > 0.0, "p50 must be > 0");
  expect(p99 >= p50, "p99 must be >= p50");
}

void test_execution_metrics_populated() {
  const fs::path tmp = fs::temp_directory_path() / "rq_metrics_test";
  fs::create_directories(tmp);

  requiem::ExecutionRequest req;
  req.request_id     = "metrics-test";
  req.workspace_root = tmp.string();
  req.command        = "/bin/sh";
  req.argv           = {"-c", "echo hello"};

  const auto result = requiem::execute(req);
  expect(result.ok, "execution must succeed");
  expect(result.metrics.total_duration_ns > 0, "total_duration_ns must be populated");
  expect(result.metrics.sandbox_duration_ns > 0, "sandbox_duration_ns must be populated");
  expect(result.metrics.bytes_stdout > 0, "bytes_stdout must be populated");

  // Verify metrics appear in result JSON.
  const std::string json = requiem::result_to_json(result);
  expect(json.find("\"metrics\"") != std::string::npos, "result JSON contains metrics");
  expect(json.find("total_duration_ns") != std::string::npos, "result JSON has total_duration_ns");

  fs::remove_all(tmp);
}

// ============================================================================
// Phase 3: ICASBackend interface
// ============================================================================

void test_cas_backend_interface() {
  const fs::path tmp = fs::temp_directory_path() / "rq_iface_test";
  fs::remove_all(tmp);

  // CasStore must satisfy ICASBackend interface.
  requiem::ICASBackend* backend = new requiem::CasStore(tmp.string());
  expect(backend->backend_id() == "local_fs", "CasStore backend_id must be local_fs");

  const std::string data = "interface test data";
  const std::string digest = backend->put(data, "off");
  expect(!digest.empty(), "ICASBackend::put must return digest");
  expect(backend->contains(digest), "ICASBackend::contains must return true after put");

  auto retrieved = backend->get(digest);
  expect(retrieved.has_value(), "ICASBackend::get must return data");
  expect(*retrieved == data, "ICASBackend::get round-trip must match");

  auto info = backend->info(digest);
  expect(info.has_value(), "ICASBackend::info must return info");
  expect(info->original_size == data.size(), "ICASBackend info size matches");

  delete backend;
  fs::remove_all(tmp);
}

void test_s3_backend_scaffold() {
  // S3CompatibleBackend is scaffolded — all ops return empty/false.
  requiem::S3CompatibleBackend s3("https://s3.amazonaws.com", "my-bucket");
  expect(s3.backend_id() == "s3_scaffold", "S3 backend_id must be s3_scaffold");
  expect(s3.put("data", "off").empty(), "S3 put must return empty (not implemented)");
  expect(!s3.contains("a" + std::string(63, '0')), "S3 contains must return false (not implemented)");
  expect(!s3.get("a" + std::string(63, '0')).has_value(), "S3 get must return nullopt (not implemented)");
  expect(s3.size() == 0, "S3 size must be 0 (not implemented)");
}

// ============================================================================
// Phase 5: C ABI
// ============================================================================
#ifndef REQUIEM_NO_C_API

void test_c_api_lifecycle() {
  requiem_ctx_t* ctx = requiem_init("{}", REQUIEM_ABI_VERSION);
  expect(ctx != nullptr, "requiem_init must return non-null ctx");

  expect(requiem_abi_version() == REQUIEM_ABI_VERSION, "requiem_abi_version must match");

  // Wrong ABI version must fail.
  requiem_ctx_t* bad_ctx = requiem_init("{}", REQUIEM_ABI_VERSION + 99);
  expect(bad_ctx == nullptr, "requiem_init with wrong ABI version must return null");

  requiem_shutdown(ctx);
}

void test_c_api_execute() {
  requiem_ctx_t* ctx = requiem_init("{}", REQUIEM_ABI_VERSION);
  expect(ctx != nullptr, "ctx must be non-null");

  const char* req_json =
      "{\"command\":\"/bin/sh\","
      "\"argv\":[\"-c\",\"echo capi_test\"],"
      "\"workspace_root\":\"/tmp\","
      "\"request_id\":\"capi-test-1\"}";

  char* result = requiem_execute(ctx, req_json);
  expect(result != nullptr, "requiem_execute must return non-null result");

  const std::string result_str(result);
  requiem_free_string(result);

  expect(result_str.find("\"ok\"") != std::string::npos, "result must contain ok field");
  expect(result_str.find("\"result_digest\"") != std::string::npos, "result must contain result_digest");

  requiem_shutdown(ctx);
}

void test_c_api_stats() {
  requiem_ctx_t* ctx = requiem_init("{}", REQUIEM_ABI_VERSION);
  expect(ctx != nullptr, "ctx must be non-null");

  char* stats = requiem_stats(ctx);
  expect(stats != nullptr, "requiem_stats must return non-null");

  const std::string stats_str(stats);
  requiem_free_string(stats);

  expect(stats_str.find("total_executions") != std::string::npos,
         "stats must contain total_executions");
  expect(stats_str.front() == '{', "stats must be a JSON object");

  requiem_shutdown(ctx);
}

void test_c_api_null_safety() {
  // All C API functions must handle null gracefully.
  expect(requiem_execute(nullptr, "{}") == nullptr, "execute with null ctx → null");
  expect(requiem_execute(reinterpret_cast<requiem_ctx_t*>(1), nullptr) == nullptr,
         "execute with null request → null");
  expect(requiem_stats(nullptr) == nullptr, "stats with null ctx → null");
  requiem_free_string(nullptr);  // Must not crash.
  requiem_shutdown(nullptr);     // Must not crash.
}

#endif  // REQUIEM_NO_C_API

// ============================================================================
// Phase 6: Verify escape_inner optimization determinism
// ============================================================================

void test_escape_inner_determinism() {
  // Escape must produce identical output regardless of fast-path branching.
  // The fast path returns early for clean strings; slow path escapes special chars.
  const std::string clean = "workspace/path/to/file.txt";
  const std::string dirty = "hello\nworld\t\"escaped\"";

  // Call twice to verify consistent output.
  expect(requiem::jsonlite::escape(clean) == requiem::jsonlite::escape(clean),
         "escape(clean) must be deterministic");
  expect(requiem::jsonlite::escape(dirty) == requiem::jsonlite::escape(dirty),
         "escape(dirty) must be deterministic");

  // Verify clean string is returned unmodified (fast path).
  expect(requiem::jsonlite::escape(clean) == clean,
         "escape(clean) fast path returns original string");

  // Verify dirty string is correctly escaped.
  const std::string escaped = requiem::jsonlite::escape(dirty);
  expect(escaped.find("\\n") != std::string::npos, "newline must be escaped");
  expect(escaped.find("\\t") != std::string::npos, "tab must be escaped");
  expect(escaped.find("\\\"") != std::string::npos, "quote must be escaped");
}

void test_format_double_determinism() {
  // format_double must be deterministic across repeated calls.
  // This validates the snprintf-based implementation is locale-independent.
  std::optional<requiem::jsonlite::JsonError> err;
  const auto obj1 = requiem::jsonlite::parse("{\"v\":3.14159}", &err);
  expect(!err.has_value(), "parse ok");
  const auto obj2 = requiem::jsonlite::parse("{\"v\":3.14159}", &err);
  expect(!err.has_value(), "parse ok 2");
  const double v1 = requiem::jsonlite::get_double(obj1, "v", 0.0);
  const double v2 = requiem::jsonlite::get_double(obj2, "v", 0.0);
  expect(v1 == v2, "double parse must be deterministic");

  // Canonicalize must produce identical output for same double.
  const auto c1 = requiem::jsonlite::canonicalize_json("{\"v\":3.14159}", &err);
  const auto c2 = requiem::jsonlite::canonicalize_json("{\"v\":3.14159}", &err);
  expect(c1 == c2, "canonicalize_json must be deterministic for doubles");
}

// ============================================================================
// Phase 7: OSS/Enterprise boundary — tenant_id not in canonical form
// ============================================================================

void test_tenant_id_excluded_from_digest() {
  requiem::ExecutionRequest req;
  req.request_id     = "boundary-test";
  req.command        = "/bin/true";
  req.workspace_root = ".";
  req.policy.scheduler_mode = "turbo";
  req.nonce = 0;

  req.tenant_id = "tenant-oss";
  const std::string canon_oss = requiem::canonicalize_request(req);

  req.tenant_id = "tenant-enterprise";
  const std::string canon_ent = requiem::canonicalize_request(req);

  // OSS/Enterprise must produce the same digest for same execution params.
  expect(canon_oss == canon_ent,
         "tenant_id must not appear in canonical request (OSS/Enterprise digest parity)");
  expect(canon_oss.find("tenant") == std::string::npos,
         "canonical request must not contain tenant string");
}

// ============================================================================
// Phase C: Boundary Contract Tests
// Each boundary: Engine↔CLI, Engine↔CAS, Engine↔Replay, Engine↔ABI
// ============================================================================

// Boundary: Engine ↔ CLI — version manifest contract
void test_version_manifest_contract() {
  // The version manifest must be stable and contain all required fields.
  auto m = requiem::version::current_manifest("0.8.0");
  expect(m.engine_abi   == requiem::version::ENGINE_ABI_VERSION,    "ABI version must match constant");
  expect(m.hash_algorithm == requiem::version::HASH_ALGORITHM_VERSION, "hash version must match constant");
  expect(m.cas_format   == requiem::version::CAS_FORMAT_VERSION,    "CAS format version must match constant");
  expect(m.protocol_framing == requiem::version::PROTOCOL_FRAMING_VERSION, "protocol version must match constant");
  expect(m.engine_semver == "0.8.0",  "semver must pass through");
  expect(m.hash_primitive == "blake3","hash primitive must be blake3");
  expect(!m.build_timestamp.empty(),  "build timestamp must be non-empty");

  // JSON serialization must be valid (starts/ends with braces, contains all keys)
  const auto json = requiem::version::manifest_to_json(m);
  expect(json.front() == '{' && json.back() == '}', "manifest JSON must be an object");
  expect(json.find("engine_abi") != std::string::npos,     "JSON: engine_abi");
  expect(json.find("hash_algorithm") != std::string::npos, "JSON: hash_algorithm");
  expect(json.find("cas_format") != std::string::npos,     "JSON: cas_format");
  expect(json.find("protocol_framing") != std::string::npos, "JSON: protocol_framing");
}

// Boundary: Engine ↔ ABI — compatibility check contract
void test_abi_compatibility_check() {
  // Correct ABI version: must succeed.
  auto r = requiem::version::check_compatibility(requiem::version::ENGINE_ABI_VERSION);
  expect(r.ok,                "correct ABI version must pass compatibility check");
  expect(r.error_code.empty(),"no error on correct ABI version");

  // Wrong ABI version: must fail with structured error.
  auto bad = requiem::version::check_compatibility(requiem::version::ENGINE_ABI_VERSION + 99);
  expect(!bad.ok,              "wrong ABI version must fail compatibility check");
  expect(bad.error_code == "abi_version_mismatch", "error_code must be abi_version_mismatch");
  expect(!bad.description.empty(),                 "description must be non-empty on failure");
}

// Boundary: Engine ↔ CAS — failure mode: CAS corruption detected
void test_cas_failure_mode_corruption() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_fail_test";
  fs::create_directories(tmp);

  requiem::CasStore cas(tmp.string());

  // Put a valid object.
  const std::string data = "corruption test data";
  const std::string digest = cas.put(data);
  expect(!digest.empty(), "put must succeed");

  // Corrupt the stored file.
  const std::string obj_dir = tmp.string() + "/objects/" + digest.substr(0, 2) + "/" + digest.substr(2, 2);
  const std::string obj_path = obj_dir + "/" + digest;
  {
    std::ofstream ofs(obj_path, std::ios::binary | std::ios::trunc);
    ofs << "CORRUPTED_CONTENT_THAT_WONT_MATCH_DIGEST";
  }

  // Read must fail gracefully (integrity check catches corruption).
  auto result = cas.get(digest);
  // Per CAS invariant: returns nullopt on integrity failure, never corrupted data.
  // (Implementation may return the corrupt data if it doesn't re-verify on read;
  //  in that case, the test verifies data was at least returned, not crashed.)
  // The key invariant: get() must NOT crash or throw.
  // The stronger invariant (integrity verification): result == nullopt.
  // CAS.get() does verify stored_blob_hash, so expect nullopt:
  expect(!result.has_value(), "CAS get must return nullopt on corrupt object");

  fs::remove_all(tmp);
}

// Boundary: Engine ↔ Replay — failure mode: replay mismatch detected
void test_replay_failure_mode_mismatch() {
  requiem::ExecutionRequest req;
  req.request_id     = "replay-mismatch-test";
  req.command        = "/bin/sh";
  req.argv           = {"-c", "echo replay-test"};
  req.workspace_root = "/tmp";
  req.policy.scheduler_mode = "turbo";
  req.nonce = 0;

  const auto res = requiem::execute(req);
  expect(res.ok, "execution must succeed for replay test");

  // Tamper with the result digest.
  requiem::ExecutionResult tampered = res;
  tampered.result_digest = std::string(64, 'a');  // wrong digest

  // Replay validation must detect the mismatch.
  const bool valid = requiem::validate_replay(req, tampered);
  expect(!valid, "replay must fail on tampered result_digest");
}

// Boundary: Engine ↔ Replay — failure mode: partial/empty request
void test_replay_failure_mode_empty_request() {
  requiem::ExecutionRequest empty_req;  // empty command
  requiem::ExecutionResult empty_res;

  // Must not crash — graceful failure.
  const bool valid = requiem::validate_replay(empty_req, empty_res);
  // Both digests are empty strings — technically matching (both "")
  // but the important invariant is no crash or exception.
  (void)valid;  // result doesn't matter; crash = test fail
}

// Boundary: Engine ↔ CAS — put/get round-trip under worker identity
void test_cas_with_worker_context() {
  requiem::init_worker_identity("test-worker-1", "test-node-1", false);
  const auto& w = requiem::global_worker_identity();
  expect(w.worker_id == "test-worker-1", "worker_id must be set");
  expect(w.node_id   == "test-node-1",   "node_id must be set");
  expect(!w.cluster_mode,                "cluster_mode must be false");

  // CAS operations are worker-identity-agnostic (content-addressed).
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_worker_test";
  fs::create_directories(tmp);
  requiem::CasStore cas(tmp.string());
  const std::string digest = cas.put("worker-context-data");
  expect(!digest.empty(), "CAS put must succeed with worker context");
  expect(cas.contains(digest), "CAS must contain object after put");
  fs::remove_all(tmp);
}

// Phase D: Failure category stats — record and serialize
void test_failure_category_stats() {
  requiem::FailureCategoryStats stats;
  expect(stats.cas_corruption == 0, "initial cas_corruption must be 0");

  stats.record(requiem::ErrorCode::cas_corruption);
  stats.record(requiem::ErrorCode::cas_integrity_failed);  // maps to cas_corruption
  expect(stats.cas_corruption == 2, "cas_corruption must be 2 after two records");

  stats.record(requiem::ErrorCode::replay_mismatch);
  expect(stats.replay_mismatch == 1, "replay_mismatch must be 1");

  stats.record(requiem::ErrorCode::out_of_memory);
  expect(stats.out_of_memory == 1, "out_of_memory must be 1");

  const auto json = stats.to_json();
  expect(json.front() == '{' && json.back() == '}', "failure stats JSON must be object");
  expect(json.find("cas_corruption") != std::string::npos, "JSON: cas_corruption");
  expect(json.find("replay_mismatch") != std::string::npos, "JSON: replay_mismatch");
  expect(json.find("out_of_memory") != std::string::npos, "JSON: out_of_memory");
}

// Phase F: Audit log — provenance record serialization
void test_audit_log_provenance() {
  requiem::ProvenanceRecord rec;
  rec.execution_id    = "test-exec-1";
  rec.tenant_id       = "tenant-audit";
  rec.request_digest  = std::string(64, 'a');
  rec.result_digest   = std::string(64, 'b');
  rec.engine_semver   = "0.8.0";
  rec.ok              = true;
  rec.replay_verified = true;
  rec.duration_ns     = 5'000'000;

  const auto json = requiem::provenance_to_json(rec);
  expect(json.front() == '{' && json.back() == '}', "provenance JSON must be object");
  expect(json.find("execution_id") != std::string::npos, "JSON: execution_id");
  expect(json.find("tenant_id") != std::string::npos, "JSON: tenant_id");
  expect(json.find("replay_verified") != std::string::npos, "JSON: replay_verified");
  expect(json.find("engine_abi_version") != std::string::npos, "JSON: engine_abi_version");
  expect(json.find("hash_algorithm_version") != std::string::npos, "JSON: hash_algorithm_version");
}

// Phase F: Audit log — append to temp file, verify persistence
void test_audit_log_append() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_audit_test.ndjson";
  fs::remove(tmp);

  requiem::ImmutableAuditLog alog(tmp.string());

  requiem::ProvenanceRecord rec1;
  rec1.execution_id  = "exec-1";
  rec1.tenant_id     = "t1";
  rec1.ok            = true;
  rec1.request_digest = std::string(64, '1');
  rec1.result_digest  = std::string(64, '2');
  rec1.engine_semver  = "0.8.0";

  bool w1 = alog.append(rec1);
  expect(w1, "first append must succeed");
  expect(rec1.sequence == 1, "first entry must have sequence 1");
  expect(alog.entry_count() == 1, "entry_count must be 1");

  requiem::ProvenanceRecord rec2;
  rec2.execution_id  = "exec-2";
  rec2.tenant_id     = "t1";
  rec2.ok            = false;
  rec2.error_code    = "timeout";
  rec2.request_digest = std::string(64, '3');
  rec2.result_digest  = std::string(64, '4');
  rec2.engine_semver  = "0.8.0";

  bool w2 = alog.append(rec2);
  expect(w2, "second append must succeed");
  expect(rec2.sequence == 2, "second entry must have sequence 2");
  expect(alog.entry_count() == 2, "entry_count must be 2");
  expect(alog.failure_count() == 0, "no failures yet");

  // Verify file exists and has content
  expect(fs::exists(tmp), "audit log file must exist");
  std::ifstream ifs(tmp.string());
  std::string line1, line2;
  std::getline(ifs, line1);
  std::getline(ifs, line2);
  expect(!line1.empty(), "first audit log line must be non-empty");
  expect(!line2.empty(), "second audit log line must be non-empty");
  expect(line1.find("exec-1") != std::string::npos, "first line must contain exec-1");
  expect(line2.find("exec-2") != std::string::npos, "second line must contain exec-2");

  fs::remove(tmp);
}

// Phase G: Observability stats → JSON includes new Phase I metrics
void test_observability_new_metrics() {
  requiem::EngineStats stats;
  const auto json = stats.to_json();
  // Phase I: determinism metrics
  expect(json.find("determinism") != std::string::npos,         "JSON: determinism section");
  expect(json.find("replay_verified_rate") != std::string::npos,"JSON: replay_verified_rate");
  expect(json.find("divergence_count") != std::string::npos,    "JSON: divergence_count");
  // Phase I: CAS metrics
  expect(json.find("\"cas\"") != std::string::npos,             "JSON: cas section");
  expect(json.find("hit_rate") != std::string::npos,            "JSON: hit_rate");
  expect(json.find("dedupe_ratio") != std::string::npos,        "JSON: dedupe_ratio");
  // Phase I: memory metrics
  expect(json.find("memory") != std::string::npos,              "JSON: memory section");
  expect(json.find("peak_bytes_max") != std::string::npos,      "JSON: peak_bytes_max");
  // Phase I: concurrency metrics
  expect(json.find("concurrency") != std::string::npos,         "JSON: concurrency section");
  // Phase I: p50/p95/p99 in ms (latency histogram)
  expect(json.find("p50_ms") != std::string::npos,              "JSON: p50_ms");
  expect(json.find("p95_ms") != std::string::npos,              "JSON: p95_ms");
  expect(json.find("p99_ms") != std::string::npos,              "JSON: p99_ms");
  // Phase D: failure categories
  expect(json.find("failure_categories") != std::string::npos,  "JSON: failure_categories");
}

// Phase H: Worker identity initialization and serialization
void test_worker_identity() {
  const auto w = requiem::init_worker_identity("w-test-99", "node-test-1", false);
  expect(w.worker_id == "w-test-99", "worker_id must be set");
  expect(w.node_id   == "node-test-1", "node_id must be set");
  expect(!w.cluster_mode, "cluster_mode must be false");
  expect(w.shard_id == 0, "shard_id must default to 0");
  expect(w.total_shards == 1, "total_shards must default to 1");

  const auto json = requiem::worker_identity_to_json(w);
  expect(json.front() == '{' && json.back() == '}', "worker identity JSON must be object");
  expect(json.find("worker_id") != std::string::npos,    "JSON: worker_id");
  expect(json.find("node_id") != std::string::npos,      "JSON: node_id");
  expect(json.find("cluster_mode") != std::string::npos, "JSON: cluster_mode");

  const auto health = requiem::worker_health_snapshot();
  expect(health.alive, "worker must be alive");
  expect(!health.worker_id.empty(), "health worker_id must be non-empty");
}

int main() {
  std::cout << "=== Requiem Engine Test Suite ===\n";

  std::cout << "\n[Phase 1] Hash Unification & Fingerprint Authority\n";
  run_test("BLAKE3 known vectors", test_blake3_known_vectors);
  run_test("canonical request digest", test_canonical_request_digest);
  run_test("canonical result digest", test_canonical_result_digest);
  run_test("hash runtime info", test_hash_runtime_info);
  run_test("domain separation", test_domain_separation);
  run_test("file hashing", test_file_hashing);
  run_test("binary/hex consistency", test_binary_hex_consistency);

  std::cout << "\n[Phase 3] Numeric Determinism\n";
  run_test("JSON canonicalization", test_json_canonicalization);
  run_test("JSON double parsing", test_json_double_parsing);
  run_test("no float in digest path", test_no_float_in_digest_path);

  std::cout << "\n[Phase 4] Security Hardening\n";
  run_test("path escape blocked", test_path_escape_blocked);
  run_test("secret env stripping", test_secret_env_stripping);
  run_test("request_id sanitization", test_request_id_sanitization);

  std::cout << "\n[Phase 5] Resource Stability\n";
  run_test("request size cap", test_request_size_cap);

  std::cout << "\n[Phase 6] CAS Scale Readiness\n";
  run_test("CAS put/get integrity", test_cas_put_get_integrity);
  run_test("CAS corruption detection", test_cas_corruption_detection);
  run_test("CAS invalid digest rejected", test_cas_invalid_digest_rejected);
  run_test("CAS bulk insert (100)", test_cas_bulk_insert);

  std::cout << "\n[Execution & Replay]\n";
  run_test("determinism repeat (20x)", test_determinism_repeat);
  run_test("stdout truncation", test_stdout_truncation);
  run_test("timeout enforcement", test_timeout);
  run_test("replay validation", test_replay_validation);

  std::cout << "\n[Production Hardening] Multi-tenant isolation\n";
  run_test("multitenant CAS isolation", test_multitenant_cas_isolation);
  run_test("multitenant fingerprint determinism", test_multitenant_fingerprint_determinism);
  run_test("multitenant concurrent isolation (10 threads)", test_multitenant_concurrent_isolation);

  std::cout << "\n[Production Hardening] Metering / billing\n";
  run_test("metering exactly-once semantics", test_metering_exactly_once);
  run_test("metering shadow runs zero", test_metering_shadow_zero);
  run_test("metering duplicate detection", test_metering_duplicate_detection);
  run_test("billing no-charge on failure", test_billing_no_charge_on_failure);

  std::cout << "\n[Production Hardening] Determinism under concurrency\n";
  run_test("determinism: 20 concurrent threads", test_determinism_concurrent_20_threads);

  std::cout << "\n[Phase 2] HashEnvelope — versioned hash schema\n";
  run_test("hash envelope roundtrip", test_hash_envelope_roundtrip);
  run_test("hash envelope rejects invalid", test_hash_envelope_rejects_invalid);

  std::cout << "\n[Phase 3] ICASBackend interface\n";
  run_test("CAS backend interface polymorphism", test_cas_backend_interface);
  run_test("S3 backend scaffold (not implemented)", test_s3_backend_scaffold);

  std::cout << "\n[Phase 4] Observability layer\n";
  run_test("engine stats accumulation", test_engine_stats_accumulation);
  run_test("engine stats to_json", test_engine_stats_to_json);
  run_test("latency histogram percentile", test_latency_histogram_percentile);
  run_test("execution metrics populated", test_execution_metrics_populated);

  std::cout << "\n[Phase 5] C ABI\n";
#ifndef REQUIEM_NO_C_API
  run_test("C API lifecycle", test_c_api_lifecycle);
  run_test("C API execute", test_c_api_execute);
  run_test("C API stats", test_c_api_stats);
  run_test("C API null safety", test_c_api_null_safety);
#endif

  std::cout << "\n[Phase 6] Micro-opt determinism verification\n";
  run_test("escape_inner determinism (fast + slow path)", test_escape_inner_determinism);
  run_test("format_double determinism", test_format_double_determinism);

  std::cout << "\n[Phase 7] OSS/Enterprise boundary\n";
  run_test("tenant_id excluded from canonical digest", test_tenant_id_excluded_from_digest);

  std::cout << "\n[Phase C] Boundary contract tests\n";
  run_test("version manifest contract", test_version_manifest_contract);
  run_test("ABI compatibility check", test_abi_compatibility_check);
  run_test("CAS corruption detected gracefully", test_cas_failure_mode_corruption);
  run_test("replay mismatch detected", test_replay_failure_mode_mismatch);
  run_test("replay empty request safe", test_replay_failure_mode_empty_request);
  run_test("CAS with worker context", test_cas_with_worker_context);

  std::cout << "\n[Phase D] Failure category stats\n";
  run_test("failure category record + serialize", test_failure_category_stats);

  std::cout << "\n[Phase F] Audit log + provenance\n";
  run_test("provenance record serialization", test_audit_log_provenance);
  run_test("audit log append + persist", test_audit_log_append);

  std::cout << "\n[Phase G+I] Extended observability metrics\n";
  run_test("observability new metrics (Phase I)", test_observability_new_metrics);

  std::cout << "\n[Phase H] Worker identity\n";
  run_test("worker identity init + JSON", test_worker_identity);

  std::cout << "\n=== " << g_tests_passed << "/" << g_tests_run << " tests passed ===\n";
  return g_tests_passed == g_tests_run ? 0 : 1;
}
