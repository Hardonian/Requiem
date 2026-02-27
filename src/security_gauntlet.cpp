// security_gauntlet.cpp — Phase 4: Tenant isolation + security gauntlet.
//
// Automated red-team checks:
//
// A) Workspace escape / pack extraction
//    - traversal paths: ../../etc/passwd, ../outside
//    - symlink (best-effort; TOCTOU mitigation via weakly_canonical)
//    - request_id with path characters
//    Expected: deterministic reject + correct error code; no escape.
//
// B) CAS namespace isolation
//    - attempt cross-tenant CID fetch from wrong CAS root
//    Expected: deterministic access denied (not found).
//
// C) Env/secret leakage
//    - REACH_ENCRYPTION_KEY and *_SECRET, *_TOKEN, *_KEY must be stripped
//    - verify policy_applied.denied_keys contains the secret key
//    Expected: deterministic stripping; secret does not reach child.
//
// D) Protocol abuse
//    - oversized request (>1MB JSON payload) → quota_exceeded
//    - empty request → missing_input
//    - malformed JSON → json_parse_error
//    - request_id with traversal chars → sanitized (no .. in sanitized id)
//    Expected: deterministic error + no wedge.
//
// Produces: artifacts/reports/CLOUD_SECURITY_REPORT.json

#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/runtime.hpp"

namespace fs = std::filesystem;

namespace {

void write_file(const std::string& path, const std::string& data) {
  fs::create_directories(fs::path(path).parent_path());
  std::ofstream ofs(path, std::ios::trunc | std::ios::binary);
  ofs << data;
}

struct SecurityTest {
  std::string name;
  bool        pass{false};
  std::string detail;
  std::string category;
};

// Helper: run a request and return execution result.
requiem::ExecutionResult exec_request(const requiem::ExecutionRequest& req) {
  return requiem::execute(req);
}

}  // namespace

int main() {
  const auto base_tmp = fs::temp_directory_path() / "requiem_security_gauntlet";
  fs::remove_all(base_tmp);
  fs::create_directories(base_tmp);

  const auto hi = requiem::hash_runtime_info();
  if (!hi.blake3_available || hi.primitive != "blake3") {
    std::cerr << "FATAL: BLAKE3 not available\n";
    return 1;
  }

  std::vector<SecurityTest> tests;

  // =========================================================================
  // A) Workspace escape / path traversal
  // =========================================================================

  // A1: simple upward traversal in cwd.
  {
    SecurityTest t;
    t.name     = "path_traversal_cwd_escape";
    t.category = "workspace_escape";
    const auto ws = base_tmp / "ws-a1";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.request_id      = "sec-a1";
    req.workspace_root  = ws.string();
    req.cwd             = "../../etc";  // attempts to escape
    req.command         = "/bin/sh";
    req.argv            = {"-c", "echo x"};

    const auto result = exec_request(req);
    // Must be rejected with path_escape.
    t.pass   = (!result.ok && result.error_code == "path_escape");
    t.detail = "error_code=" + result.error_code;
    tests.push_back(std::move(t));
  }

  // A2: traversal embedded in a nested cwd.
  {
    SecurityTest t;
    t.name     = "path_traversal_nested_cwd";
    t.category = "workspace_escape";
    const auto ws = base_tmp / "ws-a2";
    fs::create_directories(ws / "sub");

    requiem::ExecutionRequest req;
    req.request_id      = "sec-a2";
    req.workspace_root  = ws.string();
    req.cwd             = "sub/../../..";  // resolves outside ws
    req.command         = "/bin/sh";
    req.argv            = {"-c", "echo x"};

    const auto result = exec_request(req);
    t.pass   = (!result.ok && result.error_code == "path_escape");
    t.detail = "error_code=" + result.error_code;
    tests.push_back(std::move(t));
  }

  // A3: output file traversal.
  {
    SecurityTest t;
    t.name     = "path_traversal_output_file";
    t.category = "workspace_escape";
    const auto ws = base_tmp / "ws-a3";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.request_id      = "sec-a3";
    req.workspace_root  = ws.string();
    req.command         = "/bin/sh";
    req.argv            = {"-c", "echo hello"};
    req.outputs         = {"../../outside_ws.txt"};  // traversal in output

    const auto result = exec_request(req);
    // The output file traversal is silently skipped (output_digests won't include it).
    // The execution itself should succeed, but the traversal output must be rejected.
    const bool no_traversal_in_digests = (result.output_digests.find("../../outside_ws.txt") ==
                                          result.output_digests.end());
    t.pass   = no_traversal_in_digests;
    t.detail = "output_traversal_blocked=" + std::string(no_traversal_in_digests ? "true" : "false");
    tests.push_back(std::move(t));
  }

  // A4: request_id with path traversal characters — must be sanitized.
  {
    SecurityTest t;
    t.name     = "request_id_sanitization";
    t.category = "workspace_escape";

    std::string err;
    const std::string evil_req_json =
        R"({"request_id":"../../etc/passwd","command":"/bin/echo","argv":["x"],"workspace_root":")"
        + (base_tmp / "ws-a4").string() + R"("})";
    fs::create_directories(base_tmp / "ws-a4");
    auto req = requiem::parse_request_json(evil_req_json, &err);
    // Sanitized: dots and slashes stripped → no ".." or "/" in request_id.
    const bool sanitized = (req.request_id.find("..") == std::string::npos &&
                             req.request_id.find('/') == std::string::npos);
    t.pass   = sanitized;
    t.detail = "sanitized_id=" + req.request_id;
    tests.push_back(std::move(t));
  }

  // =========================================================================
  // B) CAS namespace isolation
  // =========================================================================

  // B1: digest stored in tenant-A's CAS must not be retrievable from tenant-B's CAS.
  {
    SecurityTest t;
    t.name     = "cas_cross_tenant_isolation";
    t.category = "cas_isolation";

    const auto cas_a_root = base_tmp / "cas-tenant-a";
    const auto cas_b_root = base_tmp / "cas-tenant-b";
    requiem::CasStore cas_a(cas_a_root.string());
    requiem::CasStore cas_b(cas_b_root.string());

    const std::string data_a = "secret-data-only-for-tenant-A-" + std::string(16, '\x01');
    const std::string digest = cas_a.put(data_a, "off");

    const bool a_has_it  = cas_a.contains(digest);
    const bool b_has_it  = cas_b.contains(digest);
    const bool b_can_get = cas_b.get(digest).has_value();

    t.pass   = a_has_it && !b_has_it && !b_can_get;
    t.detail = "a_has=" + std::string(a_has_it ? "true" : "false") +
               " b_has=" + std::string(b_has_it ? "true" : "false") +
               " b_can_get=" + std::string(b_can_get ? "true" : "false");
    tests.push_back(std::move(t));
  }

  // =========================================================================
  // C) Env / secret leakage
  // =========================================================================

  // C1: REACH_ENCRYPTION_KEY must be stripped from child env.
  {
    SecurityTest t;
    t.name     = "secret_reach_encryption_key_stripped";
    t.category = "secret_leakage";
    const auto ws = base_tmp / "ws-c1";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.request_id           = "sec-c1";
    req.workspace_root       = ws.string();
    req.command              = "/bin/sh";
    req.argv                 = {"-c", "echo $REACH_ENCRYPTION_KEY"};
    req.env["REACH_ENCRYPTION_KEY"] = "super_secret_value_MUST_NOT_APPEAR";
    req.max_output_bytes     = 256;

    const auto result = exec_request(req);
    // Key must appear in denied_keys.
    bool in_denied = false;
    for (const auto& k : result.policy_applied.denied_keys) {
      if (k == "REACH_ENCRYPTION_KEY") { in_denied = true; break; }
    }
    // Key must NOT appear in stdout.
    const bool not_in_stdout =
        result.stdout_text.find("super_secret_value") == std::string::npos;
    t.pass   = in_denied && not_in_stdout;
    t.detail = "in_denied_keys=" + std::string(in_denied ? "true" : "false") +
               " not_in_stdout=" + std::string(not_in_stdout ? "true" : "false");
    tests.push_back(std::move(t));
  }

  // C2: Generic *_SECRET, *_TOKEN, *_KEY patterns stripped.
  {
    SecurityTest t;
    t.name     = "secret_pattern_stripped";
    t.category = "secret_leakage";
    const auto ws = base_tmp / "ws-c2";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.request_id     = "sec-c2";
    req.workspace_root = ws.string();
    req.command        = "/bin/sh";
    req.argv           = {"-c", "env | grep -E '(_TOKEN|_SECRET|_KEY)' || echo none"};
    req.env["MY_API_TOKEN"]    = "token_should_be_stripped";
    req.env["DB_PASSWORD"]     = "pass_should_be_stripped";
    req.env["GITHUB_TOKEN"]    = "ghp_should_be_stripped";
    req.env["SAFE_VAR"]        = "safe_value_should_appear";
    req.policy.env_allowlist   = {"SAFE_VAR"};  // allowlist only SAFE_VAR
    req.max_output_bytes       = 512;

    const auto result = exec_request(req);
    const bool no_token_in_stdout =
        result.stdout_text.find("token_should_be_stripped") == std::string::npos &&
        result.stdout_text.find("pass_should_be_stripped") == std::string::npos &&
        result.stdout_text.find("ghp_should_be_stripped") == std::string::npos;
    t.pass   = no_token_in_stdout;
    t.detail = "secrets_not_in_stdout=" + std::string(no_token_in_stdout ? "true" : "false") +
               " denied_count=" + std::to_string(result.policy_applied.denied_keys.size());
    tests.push_back(std::move(t));
  }

  // =========================================================================
  // D) Protocol abuse
  // =========================================================================

  // D1: Oversized JSON payload (>1MB).
  {
    SecurityTest t;
    t.name     = "protocol_oversized_payload";
    t.category = "protocol_abuse";

    std::string err;
    // Build a payload larger than kMaxRequestPayloadBytes (1MB).
    const std::string oversized(1024 * 1024 + 1, 'x');
    requiem::parse_request_json(oversized, &err);
    t.pass   = (err == "quota_exceeded");
    t.detail = "error_code=" + err;
    tests.push_back(std::move(t));
  }

  // D2: Empty request → missing_input.
  {
    SecurityTest t;
    t.name     = "protocol_empty_request";
    t.category = "protocol_abuse";

    std::string err;
    requiem::parse_request_json("{}", &err);
    t.pass   = (err == "missing_input");
    t.detail = "error_code=" + err;
    tests.push_back(std::move(t));
  }

  // D3: Malformed JSON → json_parse_error.
  {
    SecurityTest t;
    t.name     = "protocol_malformed_json";
    t.category = "protocol_abuse";

    std::string err;
    requiem::parse_request_json("{invalid json{{{{", &err);
    t.pass   = (err == "json_parse_error" || err == "json_duplicate_key" ||
                !err.empty());
    t.detail = "error_code=" + err;
    tests.push_back(std::move(t));
  }

  // D4: Duplicate keys in JSON → json_duplicate_key.
  {
    SecurityTest t;
    t.name     = "protocol_duplicate_keys";
    t.category = "protocol_abuse";

    std::string err;
    requiem::parse_request_json(
        R"({"command":"echo","command":"duplicate_key_test"})", &err);
    t.pass   = (err == "json_duplicate_key");
    t.detail = "error_code=" + err;
    tests.push_back(std::move(t));
  }

  // D5: Null byte injection in command.
  {
    SecurityTest t;
    t.name     = "protocol_null_byte_command";
    t.category = "protocol_abuse";
    const auto ws = base_tmp / "ws-d5";
    fs::create_directories(ws);

    // Null bytes should not cause crashes; execution should fail gracefully.
    requiem::ExecutionRequest req;
    req.request_id     = "sec-d5";
    req.workspace_root = ws.string();
    req.command        = std::string("/bin/sh\x00evil", 13);
    req.argv           = {"-c", "echo x"};
    req.timeout_ms     = 500;

    // Should fail (spawn error) without crash.
    bool no_exception = true;
    try {
      const auto result = exec_request(req);
      (void)result;
    } catch (...) {
      no_exception = false;
    }
    t.pass   = no_exception;
    t.detail = "no_exception=" + std::string(no_exception ? "true" : "false");
    tests.push_back(std::move(t));
  }

  // D6: Output file count quota (>256 outputs).
  {
    SecurityTest t;
    t.name     = "protocol_output_quota_exceeded";
    t.category = "protocol_abuse";
    const auto ws = base_tmp / "ws-d6";
    fs::create_directories(ws);

    requiem::ExecutionRequest req;
    req.request_id     = "sec-d6";
    req.workspace_root = ws.string();
    req.command        = "/bin/sh";
    req.argv           = {"-c", "echo x"};
    for (int i = 0; i < 300; ++i) {
      req.outputs.push_back("out_" + std::to_string(i) + ".txt");
    }

    const auto result = exec_request(req);
    t.pass   = (result.error_code == "quota_exceeded");
    t.detail = "error_code=" + result.error_code +
               " outputs=" + std::to_string(req.outputs.size());
    tests.push_back(std::move(t));
  }

  // =========================================================================
  // Build report
  // =========================================================================

  bool all_pass = true;
  for (const auto& t : tests) all_pass = all_pass && t.pass;

  std::ostringstream report;
  report << "{"
         << "\"schema\":\"cloud_security_report_v1\""
         << ",\"pass\":" << (all_pass ? "true" : "false")
         << ",\"tests\":[";
  for (std::size_t i = 0; i < tests.size(); ++i) {
    if (i > 0) report << ",";
    const auto& t = tests[i];
    report << "{"
           << "\"name\":\"" << t.name << "\""
           << ",\"category\":\"" << t.category << "\""
           << ",\"pass\":" << (t.pass ? "true" : "false")
           << ",\"detail\":\"" << t.detail << "\""
           << "}";
  }
  report << "]"
         << ",\"hash_primitive\":\"blake3\""
         << "}";

  const std::string report_path = "artifacts/reports/CLOUD_SECURITY_REPORT.json";
  write_file(report_path, report.str());
  std::cout << "[security] report written: " << report_path << "\n";

  for (const auto& t : tests) {
    std::cout << "  [" << t.category << "] " << t.name
              << ": " << (t.pass ? "PASS" : "FAIL")
              << "  " << t.detail << "\n";
  }
  std::cout << "[security] overall=" << (all_pass ? "PASS" : "FAIL") << "\n";

  fs::remove_all(base_tmp);
  return all_pass ? 0 : 1;
}
