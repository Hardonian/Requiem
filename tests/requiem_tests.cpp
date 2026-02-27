#include <atomic>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <thread>
#include <vector>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/metering.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"

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

  // Run single reference first.
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

  std::cout << "\n=== " << g_tests_passed << "/" << g_tests_run << " tests passed ===\n";
  return g_tests_passed == g_tests_run ? 0 : 1;
}
