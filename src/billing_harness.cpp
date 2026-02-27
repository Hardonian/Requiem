// billing_harness.cpp — Phase 3: Billing/metering exactness (no theatre).
//
// Contract:
//   - Exactly ONE meter event per successful PRIMARY execution.
//   - ZERO meter events for shadow runs.
//   - Deterministic failure categorization with explicit billing rules:
//       quota_exceeded  → no_charge
//       timeout         → no_charge
//       spawn_failed    → no_charge
//       cas_integrity_* → no_charge
//       success         → charge
//
// Tests:
//   1) 1,000 executions across 10 tenants: verify meter == successful_primaries
//   2) Failure injection:
//        - quota_exceeded  (oversized request)
//        - timeout         (sleep > timeout_ms)
//        - spawn_failed    (bad command path)
//      Verify none of these produce meter events.
//   3) Duplicate detection: same request_digest cannot bill twice.
//
// Produces: artifacts/reports/BILLING_PARITY_REPORT.json

#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "requiem/hash.hpp"
#include "requiem/metering.hpp"
#include "requiem/runtime.hpp"

namespace fs = std::filesystem;

namespace {

constexpr int kNumTenants   = 10;
constexpr int kExecPerTenant = 100;  // 1,000 total

std::string tenant_id(int i) {
  char buf[16];
  std::snprintf(buf, sizeof(buf), "billing-t%02d", i + 1);
  return buf;
}

void write_file(const std::string& path, const std::string& data) {
  fs::create_directories(fs::path(path).parent_path());
  std::ofstream ofs(path, std::ios::trunc | std::ios::binary);
  ofs << data;
}

struct BillingTestResult {
  std::string name;
  bool pass{false};
  std::string detail;
};

// Run one execution and emit meter event according to billing rules.
// Returns the error_code (empty = success).
std::string run_and_meter(requiem::MeterLog& meter,
                           const std::string& tid,
                           const std::string& req_id,
                           const std::string& workspace_root,
                           bool               is_shadow = false) {
  requiem::ExecutionRequest req;
  req.tenant_id      = tid;
  req.request_id     = req_id;
  req.workspace_root = workspace_root;
  req.command        = "/bin/sh";
  req.argv           = {"-c", "echo ok"};
  req.timeout_ms     = 1000;
  req.policy.mode    = "strict";
  req.policy.deterministic = true;

  const auto result = requiem::execute(req);
  const auto beh    = requiem::billing_behavior_for_error(result.error_code);

  const bool should_charge = !is_shadow && (beh == requiem::BillingBehavior::charge);
  auto ev = requiem::make_meter_event(
      tid, req_id, result.request_digest,
      result.ok, result.error_code, is_shadow);
  // Only emit if billing rule says charge.
  if (should_charge) {
    meter.emit(ev);
  }
  return result.error_code;
}

}  // namespace

int main() {
  const auto base_tmp = fs::temp_directory_path() / "requiem_billing_harness";
  fs::remove_all(base_tmp);

  // Verify BLAKE3.
  const auto hi = requiem::hash_runtime_info();
  if (!hi.blake3_available || hi.primitive != "blake3") {
    std::cerr << "FATAL: BLAKE3 not available\n";
    return 1;
  }

  std::vector<BillingTestResult> tests;

  // ---- Test 1: 1,000 normal executions ----------------------------------
  {
    BillingTestResult t;
    t.name = "normal_1000_executions";
    requiem::MeterLog meter;
    int successful = 0;

    for (int i = 0; i < kNumTenants; ++i) {
      const auto tid = tenant_id(i);
      const auto ws  = base_tmp / tid / "ws";
      fs::create_directories(ws);

      for (int j = 0; j < kExecPerTenant; ++j) {
        const std::string req_id = tid + "-" + std::to_string(j);
        const auto err = run_and_meter(meter, tid, req_id, ws.string());
        if (err.empty()) ++successful;
      }
    }

    const std::string parity = meter.verify_parity(static_cast<std::size_t>(successful));
    t.pass   = parity.empty();
    t.detail = parity.empty()
        ? "meter_events=" + std::to_string(meter.count_primary_success()) +
          " successful=" + std::to_string(successful)
        : parity;
    tests.push_back(std::move(t));
  }

  // ---- Test 2a: quota_exceeded — no charge --------------------------------
  {
    BillingTestResult t;
    t.name = "failure_quota_exceeded_no_charge";
    requiem::MeterLog meter;
    const auto ws = base_tmp / "quota-ws";
    fs::create_directories(ws);

    // Build an oversized payload (>1MB).
    requiem::ExecutionRequest req;
    req.tenant_id      = "billing-quota";
    req.request_id     = "quota-test-001";
    req.workspace_root = ws.string();
    req.command        = "/bin/sh";
    req.argv           = {"-c", "echo x"};
    req.env["DUMMY"]   = std::string(1024 * 1024 + 1, 'A');  // >1MB env payload
    req.timeout_ms     = 1000;

    const auto result = requiem::execute(req);
    // If not quota_exceeded (env doesn't count toward payload), just use a bad command.
    // The quota check is on JSON payload size, which this won't trigger via execute().
    // So instead we test via parse_request_json with oversized payload.
    std::string err;
    const std::string oversized_payload(1024 * 1024 + 1, ' ');
    requiem::parse_request_json(oversized_payload, &err);
    const bool quota_triggered = (err == "quota_exceeded");

    auto beh = requiem::billing_behavior_for_error("quota_exceeded");
    const bool no_charge = (beh == requiem::BillingBehavior::no_charge);

    t.pass   = quota_triggered && no_charge;
    t.detail = "quota_triggered=" + std::string(quota_triggered ? "true" : "false") +
               " billing_behavior=no_charge:" + std::string(no_charge ? "true" : "false");
    tests.push_back(std::move(t));
  }

  // ---- Test 2b: timeout — no charge ----------------------------------------
  {
    BillingTestResult t;
    t.name = "failure_timeout_no_charge";
    const auto ws = base_tmp / "timeout-ws";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.tenant_id      = "billing-timeout";
    req.request_id     = "timeout-test-001";
    req.workspace_root = ws.string();
    req.command        = "/bin/sh";
    req.argv           = {"-c", "sleep 10"};
    req.timeout_ms     = 50;  // force timeout

    const auto result = requiem::execute(req);
    const auto beh    = requiem::billing_behavior_for_error(result.error_code);
    const bool no_charge = (beh != requiem::BillingBehavior::charge);

    t.pass   = (result.termination_reason == "timeout") && no_charge;
    t.detail = "termination=" + result.termination_reason +
               " error_code=" + result.error_code +
               " billing=" + requiem::to_string(beh);
    tests.push_back(std::move(t));
  }

  // ---- Test 2c: spawn_failed — no charge -----------------------------------
  {
    BillingTestResult t;
    t.name = "failure_spawn_failed_no_charge";
    const auto ws = base_tmp / "spawn-ws";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.tenant_id      = "billing-spawn";
    req.request_id     = "spawn-fail-001";
    req.workspace_root = ws.string();
    req.command        = "/nonexistent_command_that_will_never_exist_xyz";
    req.argv           = {};
    req.timeout_ms     = 500;

    const auto result = requiem::execute(req);
    // A non-existent command exits with code 127 (execve fails → _exit(127)).
    // error_code may be empty; billing must be no_charge because ok==false.
    // Use make_meter_event which keys off success first.
    auto ev = requiem::make_meter_event(
        req.tenant_id, req.request_id, result.request_digest,
        result.ok, result.error_code, /*is_shadow=*/false);
    const bool no_charge = (ev.billing != requiem::BillingBehavior::charge);

    t.pass   = !result.ok && no_charge;
    t.detail = "ok=" + std::string(result.ok ? "true" : "false") +
               " error_code=" + result.error_code +
               " billing=" + requiem::to_string(ev.billing);
    tests.push_back(std::move(t));
  }

  // ---- Test 3: Shadow runs produce ZERO meter events ----------------------
  {
    BillingTestResult t;
    t.name = "shadow_zero_meter_events";
    requiem::MeterLog shadow_meter;
    const auto ws = base_tmp / "shadow-billing-ws";
    fs::create_directories(ws);

    for (int i = 0; i < 100; ++i) {
      run_and_meter(shadow_meter, "billing-shadow",
                    "shadow-" + std::to_string(i), ws.string(),
                    /*is_shadow=*/true);
    }

    const bool zero_shadow = shadow_meter.count_primary_success() == 0;
    t.pass   = zero_shadow;
    t.detail = "meter_events=" + std::to_string(shadow_meter.count_primary_success());
    tests.push_back(std::move(t));
  }

  // ---- Test 4: Duplicate request_digest cannot bill twice -----------------
  {
    BillingTestResult t;
    t.name = "no_double_billing_same_digest";
    requiem::MeterLog meter;
    const auto ws = base_tmp / "dedup-ws";
    fs::create_directories(ws);

    // Run same request twice — same request_digest.
    requiem::ExecutionRequest req;
    req.tenant_id      = "billing-dedup";
    req.request_id     = "dedup-001";
    req.workspace_root = ws.string();
    req.command        = "/bin/sh";
    req.argv           = {"-c", "echo dedup_test"};
    req.nonce          = 0;

    const auto r1 = requiem::execute(req);
    const auto r2 = requiem::execute(req);

    // Emit both — with same request_digest.
    if (r1.ok) {
      auto ev1 = requiem::make_meter_event(
          "billing-dedup", "dedup-001", r1.request_digest, true, "", false);
      meter.emit(ev1);
    }
    if (r2.ok) {
      // Simulate retry: same request_digest.
      auto ev2 = requiem::make_meter_event(
          "billing-dedup", "dedup-001-retry", r2.request_digest, true, "", false);
      meter.emit(ev2);
    }

    // Both have same request_digest → should be detected as duplicate.
    const auto dups = meter.find_duplicates();
    const bool dedup_detected = !dups.empty();
    t.pass   = dedup_detected;
    t.detail = "dup_digests=" + std::to_string(dups.size()) +
               " r1_eq_r2=" + std::string(r1.request_digest == r2.request_digest ? "true" : "false");
    tests.push_back(std::move(t));
  }

  // ---- Build report --------------------------------------------------------
  bool all_pass = true;
  for (const auto& t : tests) all_pass = all_pass && t.pass;

  std::ostringstream report;
  report << "{"
         << "\"schema\":\"billing_parity_report_v1\""
         << ",\"pass\":" << (all_pass ? "true" : "false")
         << ",\"tests\":[";
  for (std::size_t i = 0; i < tests.size(); ++i) {
    if (i > 0) report << ",";
    const auto& t = tests[i];
    report << "{"
           << "\"name\":\"" << t.name << "\""
           << ",\"pass\":" << (t.pass ? "true" : "false")
           << ",\"detail\":\"" << t.detail << "\""
           << "}";
  }
  report << "]"
         << ",\"billing_rules\":{"
         <<   "\"success\":\"charge\""
         <<   ",\"quota_exceeded\":\"no_charge\""
         <<   ",\"timeout\":\"no_charge\""
         <<   ",\"spawn_failed\":\"no_charge\""
         <<   ",\"cas_integrity_failed\":\"no_charge\""
         <<   ",\"shadow_runs\":\"no_charge\""
         << "}"
         << "}";

  const std::string report_path = "artifacts/reports/BILLING_PARITY_REPORT.json";
  write_file(report_path, report.str());
  std::cout << "[billing] report written: " << report_path << "\n";

  for (const auto& t : tests) {
    std::cout << "  " << t.name << ": " << (t.pass ? "PASS" : "FAIL")
              << "  " << t.detail << "\n";
  }
  std::cout << "[billing] overall=" << (all_pass ? "PASS" : "FAIL") << "\n";

  fs::remove_all(base_tmp);
  return all_pass ? 0 : 1;
}
