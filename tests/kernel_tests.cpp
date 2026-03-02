// tests/kernel_tests.cpp — Vertical slice kernel tests.
//
// Tests for: envelope, event_log, caps, policy_vm, plan, receipt.
// Each test is a self-contained function that returns true on pass.
// No external test framework dependency.

#include "requiem/caps.hpp"
#include "requiem/envelope.hpp"
#include "requiem/event_log.hpp"
#include "requiem/hash.hpp"

#include "requiem/plan.hpp"
#include "requiem/policy_vm.hpp"
#include "requiem/receipt.hpp"

#include <cassert>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <set>
#include <string>

namespace fs = std::filesystem;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

static int g_pass = 0;
static int g_fail = 0;

#define TEST(name)                                                             \
  do {                                                                         \
    std::cout << "  " << #name << " ... " << std::flush;                       \
    try {                                                                      \
      if (test_##name()) {                                                     \
        std::cout << "PASS" << std::endl;                                      \
        ++g_pass;                                                              \
      } else {                                                                 \
        std::cout << "FAIL" << std::endl;                                      \
        ++g_fail;                                                              \
      }                                                                        \
    } catch (const std::exception &e) {                                        \
      std::cout << "CRASH (" << e.what() << ")" << std::endl;                  \
      ++g_fail;                                                                \
    }                                                                          \
  } while (0)

// Temp directory helper.
static std::string make_temp_dir(const std::string &prefix) {
  auto p = fs::temp_directory_path() / (prefix + "_kernel_test");
  fs::create_directories(p);
  return p.string();
}

// ---------------------------------------------------------------------------
// §3 Envelope Tests
// ---------------------------------------------------------------------------

static bool test_envelope_success() {
  auto env = requiem::make_envelope("exec.result", "{\"ok\":true}");
  auto json = requiem::envelope_to_json(env);

  // Must contain version, kind, data, error=null.
  if (json.find("\"v\":1") == std::string::npos)
    return false;
  if (json.find("\"kind\":\"exec.result\"") == std::string::npos)
    return false;
  if (json.find("\"data\":{\"ok\":true}") == std::string::npos)
    return false;
  if (json.find("\"error\":null") == std::string::npos)
    return false;
  return true;
}

static bool test_envelope_error() {
  auto env =
      requiem::make_error_envelope("quota_exceeded", "Budget limit hit", false);
  auto json = requiem::envelope_to_json(env);

  if (json.find("\"kind\":\"error\"") == std::string::npos)
    return false;
  if (json.find("\"code\":\"quota_exceeded\"") == std::string::npos)
    return false;
  if (json.find("\"data\":null") == std::string::npos)
    return false;
  if (json.find("\"retryable\":false") == std::string::npos)
    return false;
  return true;
}

static bool test_envelope_determinism() {
  auto env1 = requiem::make_envelope("test.kind", "{\"a\":1}");
  auto env2 = requiem::make_envelope("test.kind", "{\"a\":1}");
  return requiem::envelope_to_json(env1) == requiem::envelope_to_json(env2);
}

// ---------------------------------------------------------------------------
// §4 EventLog Tests
// ---------------------------------------------------------------------------

static bool test_event_log_append_and_read() {
  auto dir = make_temp_dir("evlog");
  auto path = dir + "/events.ndjson";

  // Clean up any previous test file.
  fs::remove(path);

  {
    requiem::EventLog log(path);

    requiem::EventRecord r1;
    r1.event_type = "exec.complete";
    r1.tenant_id = "tenant-alpha";
    r1.ok = true;
    auto seq1 = log.append(r1);
    if (seq1 != 1)
      return false;

    requiem::EventRecord r2;
    r2.event_type = "cap.mint";
    r2.tenant_id = "tenant-alpha";
    r2.ok = true;
    auto seq2 = log.append(r2);
    if (seq2 != 2)
      return false;
  }

  // Re-open and read.
  requiem::EventLog log2(path);
  auto events = log2.read_all();
  if (events.size() != 2)
    return false;
  if (events[0].event_type != "exec.complete")
    return false;
  if (events[1].event_type != "cap.mint")
    return false;

  fs::remove_all(dir);
  return true;
}

static bool test_event_log_chain_verification() {
  auto dir = make_temp_dir("evlog_chain");
  auto path = dir + "/events.ndjson";
  fs::remove(path);

  {
    requiem::EventLog log(path);

    for (int i = 0; i < 5; ++i) {
      requiem::EventRecord r;
      r.event_type = "exec.complete";
      r.tenant_id = "tenant-" + std::to_string(i);
      r.ok = true;
      log.append(r);
    }

    // Verify chain integrity.
    auto result = log.verify();
    if (!result.ok)
      return false;
    if (result.total_events != 5)
      return false;
    if (result.verified_events != 5)
      return false;
  }

  fs::remove_all(dir);
  return true;
}

static bool test_event_log_genesis_prev() {
  auto dir = make_temp_dir("evlog_genesis");
  auto path = dir + "/events.ndjson";
  fs::remove(path);

  {
    requiem::EventLog log(path);

    requiem::EventRecord r;
    r.event_type = "first";
    log.append(r);

    auto events = log.read_all();
    if (events.empty())
      return false;
    // Genesis record should have 64 zero chars as prev.
    if (events[0].prev != std::string(64, '0'))
      return false;
  }

  fs::remove_all(dir);
  return true;
}

static bool test_event_log_tamper_detection() {
  auto dir = make_temp_dir("evlog_tamper");
  auto path = dir + "/events.ndjson";
  fs::remove(path);

  // Write valid events.
  {
    requiem::EventLog log(path);
    for (int i = 0; i < 3; ++i) {
      requiem::EventRecord r;
      r.event_type = "step_" + std::to_string(i);
      r.ok = true;
      log.append(r);
    }
  }

  // Tamper with the file: modify the second line.
  {
    std::ifstream ifs(path);
    std::string lines;
    std::string line;
    int line_num = 0;
    while (std::getline(ifs, line)) {
      if (line_num == 1) {
        // Corrupt the event_type field.
        auto pos = line.find("step_1");
        if (pos != std::string::npos) {
          line.replace(pos, 6, "TAMPER");
        }
      }
      lines += line + "\n";
      ++line_num;
    }
    ifs.close();
    std::ofstream ofs(path, std::ios::trunc);
    ofs << lines;
  }

  // Verify should fail.
  {
    requiem::EventLog log2(path);
    auto result = log2.verify();
    if (result.ok)
      return false; // Should have detected tampering.
    if (result.failures.empty())
      return false;
  }

  fs::remove_all(dir);
  return true;
}

static bool test_event_log_logical_time() {
  auto dir = make_temp_dir("evlog_lt");
  auto path = dir + "/events.ndjson";
  fs::remove(path);

  {
    requiem::EventLog log(path);

    for (int i = 0; i < 3; ++i) {
      requiem::EventRecord r;
      r.event_type = "test";
      log.append(r);
    }

    if (log.logical_time() != 3)
      return false;

    auto events = log.read_all();
    if (events[0].ts_logical != 1)
      return false;
    if (events[1].ts_logical != 2)
      return false;
    if (events[2].ts_logical != 3)
      return false;
  }

  fs::remove_all(dir);
  return true;
}

// ---------------------------------------------------------------------------
// §6 Capabilities Tests
// ---------------------------------------------------------------------------

static bool test_caps_mint_and_verify() {
  auto kp = requiem::caps_generate_keypair();
  if (kp.public_key_hex.empty() || kp.secret_key_hex.empty())
    return false;

  auto token = requiem::caps_mint({"exec.run", "cas.put"}, "tenant-alpha",
                                  kp.secret_key_hex, kp.public_key_hex);

  if (token.fingerprint.empty())
    return false;
  if (token.signature.empty())
    return false;

  // Verify with correct action.
  auto result = requiem::caps_verify(token, "exec.run", kp.public_key_hex);
  if (!result.ok)
    return false;

  // Verify with wrong action.
  auto result2 = requiem::caps_verify(token, "admin.delete", kp.public_key_hex);
  if (result2.ok)
    return false;
  if (result2.error.find("missing_permission") == std::string::npos)
    return false;

  return true;
}

static bool test_caps_fingerprint_determinism() {
  auto kp = requiem::caps_generate_keypair();

  auto token1 = requiem::caps_mint({"exec.run"}, "tenant-alpha",
                                   kp.secret_key_hex, kp.public_key_hex);

  auto token2 = requiem::caps_mint({"exec.run"}, "tenant-alpha",
                                   kp.secret_key_hex, kp.public_key_hex);

  // Same inputs → same fingerprint.
  return token1.fingerprint == token2.fingerprint;
}

static bool test_caps_revocation() {
  requiem::caps_clear_revocations();

  auto kp = requiem::caps_generate_keypair();
  auto token = requiem::caps_mint({"exec.run"}, "tenant-alpha",
                                  kp.secret_key_hex, kp.public_key_hex);

  // Should verify before revocation.
  auto r1 = requiem::caps_verify(token, "exec.run", kp.public_key_hex);
  if (!r1.ok)
    return false;

  // Revoke.
  requiem::caps_revoke(token.fingerprint);
  if (!requiem::caps_is_revoked(token.fingerprint))
    return false;

  // Should fail after revocation.
  auto r2 = requiem::caps_verify(token, "exec.run", kp.public_key_hex);
  if (r2.ok)
    return false;
  if (r2.error != "capability_revoked")
    return false;

  requiem::caps_clear_revocations();
  return true;
}

static bool test_caps_wrong_key_fails() {
  auto kp1 = requiem::caps_generate_keypair();
  auto kp2 = requiem::caps_generate_keypair();

  auto token = requiem::caps_mint({"exec.run"}, "tenant-alpha",
                                  kp1.secret_key_hex, kp1.public_key_hex);

  // Verify with wrong public key should fail.
  auto result = requiem::caps_verify(token, "exec.run", kp2.public_key_hex);
  if (result.ok)
    return false;
  if (result.error != "signature_invalid")
    return false;

  return true;
}

static bool test_caps_time_bounds() {
  requiem::caps_clear_revocations();

  auto kp = requiem::caps_generate_keypair();
  auto token = requiem::caps_mint({"exec.run"}, "tenant-alpha",
                                  kp.secret_key_hex, kp.public_key_hex,
                                  "",   // issuer
                                  10,   // not_before
                                  100); // not_after

  // Before validity window.
  auto r1 = requiem::caps_verify(token, "exec.run", kp.public_key_hex, 5);
  if (r1.ok)
    return false;
  if (r1.error != "capability_not_yet_valid")
    return false;

  // Within window.
  auto r2 = requiem::caps_verify(token, "exec.run", kp.public_key_hex, 50);
  if (!r2.ok)
    return false;

  // After window.
  auto r3 = requiem::caps_verify(token, "exec.run", kp.public_key_hex, 200);
  if (r3.ok)
    return false;
  if (r3.error != "capability_expired")
    return false;

  return true;
}

static bool test_caps_serialization_roundtrip() {
  auto kp = requiem::caps_generate_keypair();
  auto token = requiem::caps_mint({"exec.run", "cas.put"}, "tenant-beta",
                                  kp.secret_key_hex, kp.public_key_hex);

  auto json = requiem::caps_token_to_json(token);
  auto restored = requiem::caps_token_from_json(json);

  if (restored.fingerprint != token.fingerprint)
    return false;
  if (restored.signature != token.signature)
    return false;
  if (restored.subject != token.subject)
    return false;
  if (restored.permissions.size() != token.permissions.size())
    return false;

  return true;
}

// ---------------------------------------------------------------------------
// §7 PolicyVM Tests
// ---------------------------------------------------------------------------

static bool test_policy_eval_allow() {
  std::vector<requiem::PolicyRule> rules;
  requiem::PolicyRule r;
  r.rule_id = "R001";
  r.condition.field = "tenant_id";
  r.condition.op = "eq";
  r.condition.value = "tenant-alpha";
  r.effect = "allow";
  r.priority = 100;
  rules.push_back(r);

  auto decision =
      requiem::policy_eval(rules, "{\"tenant_id\":\"tenant-alpha\"}", 0);

  if (decision.decision != "allow")
    return false;
  if (decision.matched_rule_id != "R001")
    return false;
  if (decision.proof_hash.empty())
    return false;
  return true;
}

static bool test_policy_eval_default_deny() {
  std::vector<requiem::PolicyRule> rules;
  requiem::PolicyRule r;
  r.rule_id = "R001";
  r.condition.field = "tenant_id";
  r.condition.op = "eq";
  r.condition.value = "tenant-alpha";
  r.effect = "allow";
  r.priority = 100;
  rules.push_back(r);

  auto decision =
      requiem::policy_eval(rules, "{\"tenant_id\":\"tenant-beta\"}", 0);

  if (decision.decision != "deny")
    return false;
  if (!decision.matched_rule_id.empty())
    return false;
  return true;
}

static bool test_policy_eval_priority_order() {
  std::vector<requiem::PolicyRule> rules;

  requiem::PolicyRule deny_rule;
  deny_rule.rule_id = "DENY_ALL";
  deny_rule.condition.field = "tenant_id";
  deny_rule.condition.op = "exists";
  deny_rule.effect = "deny";
  deny_rule.priority = 50;
  rules.push_back(deny_rule);

  requiem::PolicyRule allow_rule;
  allow_rule.rule_id = "ALLOW_ALPHA";
  allow_rule.condition.field = "tenant_id";
  allow_rule.condition.op = "eq";
  allow_rule.condition.value = "tenant-alpha";
  allow_rule.effect = "allow";
  allow_rule.priority = 100; // Higher priority.
  rules.push_back(allow_rule);

  auto decision =
      requiem::policy_eval(rules, "{\"tenant_id\":\"tenant-alpha\"}", 0);

  // Higher priority allow rule should win.
  if (decision.decision != "allow")
    return false;
  if (decision.matched_rule_id != "ALLOW_ALPHA")
    return false;
  return true;
}

static bool test_policy_eval_determinism() {
  std::vector<requiem::PolicyRule> rules;
  requiem::PolicyRule r;
  r.rule_id = "R001";
  r.condition.field = "tenant_id";
  r.condition.op = "eq";
  r.condition.value = "tenant-alpha";
  r.effect = "allow";
  r.priority = 100;
  rules.push_back(r);

  auto d1 = requiem::policy_eval(rules, "{\"tenant_id\":\"tenant-alpha\"}", 42);
  auto d2 = requiem::policy_eval(rules, "{\"tenant_id\":\"tenant-alpha\"}", 42);

  // Same inputs → same proof hash.
  if (d1.proof_hash != d2.proof_hash)
    return false;
  if (d1.context_hash != d2.context_hash)
    return false;
  if (d1.rules_hash != d2.rules_hash)
    return false;
  return true;
}

static bool test_policy_condition_operators() {
  requiem::PolicyCondition c;

  // eq
  c.op = "eq";
  c.value = "alpha";
  if (!requiem::policy_condition_matches(c, "alpha"))
    return false;
  if (requiem::policy_condition_matches(c, "beta"))
    return false;

  // neq
  c.op = "neq";
  c.value = "alpha";
  if (requiem::policy_condition_matches(c, "alpha"))
    return false;
  if (!requiem::policy_condition_matches(c, "beta"))
    return false;

  // in
  c.op = "in";
  c.value = "alpha,beta,gamma";
  if (!requiem::policy_condition_matches(c, "beta"))
    return false;
  if (requiem::policy_condition_matches(c, "delta"))
    return false;

  // not_in
  c.op = "not_in";
  c.value = "alpha,beta";
  if (requiem::policy_condition_matches(c, "alpha"))
    return false;
  if (!requiem::policy_condition_matches(c, "gamma"))
    return false;

  // gt
  c.op = "gt";
  c.value = "10";
  if (!requiem::policy_condition_matches(c, "15"))
    return false;
  if (requiem::policy_condition_matches(c, "5"))
    return false;

  // exists
  c.op = "exists";
  c.value = "";
  if (!requiem::policy_condition_matches(c, "anything"))
    return false;
  if (requiem::policy_condition_matches(c, ""))
    return false;

  return true;
}

// ---------------------------------------------------------------------------
// §10 Plan Tests
// ---------------------------------------------------------------------------

static bool test_plan_validate_ok() {
  requiem::Plan plan;
  plan.plan_id = "test-plan";

  requiem::PlanStep s1;
  s1.step_id = "step-1";
  s1.kind = "exec";
  plan.steps.push_back(s1);

  requiem::PlanStep s2;
  s2.step_id = "step-2";
  s2.kind = "exec";
  s2.depends_on = {"step-1"};
  plan.steps.push_back(s2);

  auto result = requiem::plan_validate(plan);
  if (!result.ok)
    return false;
  return true;
}

static bool test_plan_validate_cycle() {
  requiem::Plan plan;
  plan.plan_id = "cyclic-plan";

  requiem::PlanStep s1;
  s1.step_id = "a";
  s1.kind = "exec";
  s1.depends_on = {"b"};
  plan.steps.push_back(s1);

  requiem::PlanStep s2;
  s2.step_id = "b";
  s2.kind = "exec";
  s2.depends_on = {"a"};
  plan.steps.push_back(s2);

  auto result = requiem::plan_validate(plan);
  if (result.ok)
    return false; // Should detect cycle.
  return true;
}

static bool test_plan_validate_missing_dep() {
  requiem::Plan plan;
  plan.plan_id = "missing-dep";

  requiem::PlanStep s1;
  s1.step_id = "step-1";
  s1.kind = "exec";
  s1.depends_on = {"nonexistent"};
  plan.steps.push_back(s1);

  auto result = requiem::plan_validate(plan);
  if (result.ok)
    return false;
  return true;
}

static bool test_plan_topological_order() {
  requiem::Plan plan;

  // Diamond: A -> B, A -> C, B -> D, C -> D
  requiem::PlanStep a, b, c, d;
  a.step_id = "A";
  a.kind = "exec";
  b.step_id = "B";
  b.kind = "exec";
  b.depends_on = {"A"};
  c.step_id = "C";
  c.kind = "exec";
  c.depends_on = {"A"};
  d.step_id = "D";
  d.kind = "exec";
  d.depends_on = {"B", "C"};

  plan.steps = {d, b, a, c}; // Intentionally unordered.

  auto order = requiem::plan_topological_order(plan);
  if (order.size() != 4)
    return false;

  // A must come first.
  if (order[0] != "A")
    return false;

  // B and C come after A, in lexicographic order.
  if (order[1] != "B")
    return false;
  if (order[2] != "C")
    return false;

  // D comes last.
  if (order[3] != "D")
    return false;

  return true;
}

static bool test_plan_hash_determinism() {
  requiem::Plan plan;
  plan.plan_id = "hash-test";

  requiem::PlanStep s;
  s.step_id = "s1";
  s.kind = "exec";
  s.config.command = "/bin/echo";
  s.config.argv = {"hello"};
  plan.steps.push_back(s);

  auto h1 = requiem::plan_compute_hash(plan);
  auto h2 = requiem::plan_compute_hash(plan);

  if (h1.empty())
    return false;
  if (h1 != h2)
    return false;
  return true;
}

// ---------------------------------------------------------------------------
// §11 Receipt Tests
// ---------------------------------------------------------------------------

static bool test_receipt_generate_and_verify() {
  std::map<std::string, std::string> step_digests;
  step_digests["step-1"] = "aabb" + std::string(60, '0');
  step_digests["step-2"] = "ccdd" + std::string(60, '0');

  auto receipt = requiem::receipt_generate("run-001", "plan-hash-001",
                                           "req-digest-001", "res-digest-001",
                                           step_digests, 42, "prev-digest-001");

  if (receipt.receipt_hash.empty())
    return false;

  auto vr = requiem::receipt_verify(receipt);
  if (!vr.ok)
    return false;
  return true;
}

static bool test_receipt_tamper_detection() {
  std::map<std::string, std::string> step_digests;
  step_digests["step-1"] = "aabb" + std::string(60, '0');

  auto receipt =
      requiem::receipt_generate("run-002", "plan-hash-002", "req-digest-002",
                                "res-digest-002", step_digests, 10, "prev");

  // Tamper with the result_digest.
  receipt.result_digest = "TAMPERED";

  auto vr = requiem::receipt_verify(receipt);
  if (vr.ok)
    return false; // Should detect tampering.
  if (vr.error.find("receipt_hash_mismatch") == std::string::npos)
    return false;
  return true;
}

static bool test_receipt_serialization_roundtrip() {
  std::map<std::string, std::string> step_digests;
  step_digests["s1"] = std::string(64, 'a');

  auto receipt = requiem::receipt_generate(
      "run-rt", "plan-rt", "req-rt", "res-rt", step_digests, 5, "prev-rt");

  auto json = requiem::receipt_to_json(receipt);
  auto restored = requiem::receipt_from_json(json);

  if (restored.receipt_hash != receipt.receipt_hash)
    return false;
  if (restored.run_id != receipt.run_id)
    return false;
  if (restored.event_log_seq != receipt.event_log_seq)
    return false;
  return true;
}

static bool test_receipt_determinism() {
  std::map<std::string, std::string> digests;
  digests["s1"] = std::string(64, 'b');

  auto r1 = requiem::receipt_generate("run-det", "plan-det", "req-det",
                                      "res-det", digests, 1, "prev-det");
  auto r2 = requiem::receipt_generate("run-det", "plan-det", "req-det",
                                      "res-det", digests, 1, "prev-det");

  if (r1.receipt_hash != r2.receipt_hash)
    return false;
  return true;
}

// ---------------------------------------------------------------------------
// Domain Separation Tests (cross-cutting)
// ---------------------------------------------------------------------------

static bool test_domain_separation_no_collision() {
  const std::string data = "identical-payload";

  auto req_hash = requiem::hash_domain("req:", data);
  auto res_hash = requiem::hash_domain("res:", data);
  auto cas_hash = requiem::hash_domain("cas:", data);
  auto evt_hash = requiem::hash_domain("evt:", data);
  auto cap_hash = requiem::hash_domain("cap:", data);
  auto pol_hash = requiem::hash_domain("pol:", data);
  auto rcpt_hash = requiem::hash_domain("rcpt:", data);
  auto plan_hash = requiem::hash_domain("plan:", data);

  // All must be different despite identical payload.
  std::set<std::string> hashes = {req_hash, res_hash, cas_hash,  evt_hash,
                                  cap_hash, pol_hash, rcpt_hash, plan_hash};

  if (hashes.size() != 8)
    return false;
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

int main() {
  std::cout << "\n=== Requiem Kernel Tests ===" << std::endl;

  std::cout << "\n[Envelope §3]" << std::endl;
  TEST(envelope_success);
  TEST(envelope_error);
  TEST(envelope_determinism);

  std::cout << "\n[EventLog §4]" << std::endl;
  TEST(event_log_append_and_read);
  TEST(event_log_chain_verification);
  TEST(event_log_genesis_prev);
  TEST(event_log_tamper_detection);
  TEST(event_log_logical_time);

  std::cout << "\n[Capabilities §6]" << std::endl;
  TEST(caps_mint_and_verify);
  TEST(caps_fingerprint_determinism);
  TEST(caps_revocation);
  TEST(caps_wrong_key_fails);
  TEST(caps_time_bounds);
  TEST(caps_serialization_roundtrip);

  std::cout << "\n[PolicyVM §7]" << std::endl;
  TEST(policy_eval_allow);
  TEST(policy_eval_default_deny);
  TEST(policy_eval_priority_order);
  TEST(policy_eval_determinism);
  TEST(policy_condition_operators);

  std::cout << "\n[Plan §10]" << std::endl;
  TEST(plan_validate_ok);
  TEST(plan_validate_cycle);
  TEST(plan_validate_missing_dep);
  TEST(plan_topological_order);
  TEST(plan_hash_determinism);

  std::cout << "\n[Receipt §11]" << std::endl;
  TEST(receipt_generate_and_verify);
  TEST(receipt_tamper_detection);
  TEST(receipt_serialization_roundtrip);
  TEST(receipt_determinism);

  std::cout << "\n[Domain Separation]" << std::endl;
  TEST(domain_separation_no_collision);

  std::cout << "\n=== Results: " << g_pass << " passed, " << g_fail
            << " failed ===" << std::endl;

  return g_fail > 0 ? 1 : 0;
}
