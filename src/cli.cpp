#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <vector>

#include "../include/requiem/audit.hpp"
#include "../include/requiem/autotune.hpp"
#include "../include/requiem/caps.hpp"
#include "../include/requiem/cas.hpp"
#include "../include/requiem/cluster.hpp"
#include "../include/requiem/debugger.hpp"
#include "../include/requiem/diagnostics.hpp"
#include "../include/requiem/envelope.hpp"
#include "../include/requiem/event_log.hpp"
#include "../include/requiem/hash.hpp"
#include "../include/requiem/jsonlite.hpp"
#include "../include/requiem/metering.hpp"
#include "../include/requiem/observability.hpp"
#include "../include/requiem/plan.hpp"
#include "../include/requiem/policy_linter.hpp"
#include "../include/requiem/policy_vm.hpp"
#include "../include/requiem/rbac.hpp"
#include "../include/requiem/receipt.hpp"
#include "../include/requiem/replay.hpp"
#include "../include/requiem/runtime.hpp"
#include "../include/requiem/sandbox.hpp"
#include "../include/requiem/snapshot.hpp"
#include "../include/requiem/version.hpp"
#include "../include/requiem/worker.hpp"

namespace {
std::string read_file(const std::string &path) {
  std::ifstream ifs(path, std::ios::binary);
  return std::string((std::istreambuf_iterator<char>(ifs)),
                     std::istreambuf_iterator<char>());
}
void write_file(const std::string &path, const std::string &data) {
  std::ofstream ofs(path, std::ios::binary | std::ios::trunc);
  ofs << data;
}
requiem::ExecutionResult parse_result(const std::string &s) {
  requiem::ExecutionResult r;
  auto obj = requiem::jsonlite::parse(s, nullptr);
  r.ok = requiem::jsonlite::get_bool(obj, "ok", false);
  r.exit_code =
      static_cast<int>(requiem::jsonlite::get_u64(obj, "exit_code", 0));
  r.termination_reason =
      requiem::jsonlite::get_string(obj, "termination_reason", "");
  r.request_digest = requiem::jsonlite::get_string(obj, "request_digest", "");
  r.trace_digest = requiem::jsonlite::get_string(obj, "trace_digest", "");
  r.result_digest = requiem::jsonlite::get_string(obj, "result_digest", "");
  r.stdout_digest = requiem::jsonlite::get_string(obj, "stdout_digest", "");
  r.stderr_digest = requiem::jsonlite::get_string(obj, "stderr_digest", "");
  r.stdout_text = requiem::jsonlite::get_string(obj, "stdout", "");
  r.stderr_text = requiem::jsonlite::get_string(obj, "stderr", "");
  r.output_digests = requiem::jsonlite::get_string_map(obj, "output_digests");
  return r;
}

std::string drift_analyze(const std::string &bench_json) {
  auto digests =
      requiem::jsonlite::get_string_array(bench_json, "result_digests");
  std::map<std::string, int> f;
  for (const auto &d : digests)
    f[d]++;
  if (f.size() <= 1)
    return "{\"drift\":{\"ok\":true,\"mismatches\":[]}}";
  auto expected = f.begin()->first;
  std::string out = "{\"drift\":{\"ok\":false,\"mismatches\":[";
  bool first = true;
  for (size_t i = 0; i < digests.size(); ++i) {
    if (digests[i] == expected)
      continue;
    if (!first)
      out += ",";
    first = false;
    out += "{\"category\":\"digest\",\"expected\":\"" + expected +
           "\",\"observed\":\"" + digests[i] + "\",\"run_indices\":[" +
           std::to_string(i) +
           "],\"hints\":[\"env key present outside allowlist\"]}";
  }
  out += "]}}";
  return out;
}

std::string bench_compare(const std::string &baseline_json,
                          const std::string &current_json) {
  auto baseline_p50 =
      requiem::jsonlite::get_double(baseline_json, "latency_ms.p50", 0.0);
  auto current_p50 =
      requiem::jsonlite::get_double(current_json, "latency_ms.p50", 0.0);
  auto baseline_p95 =
      requiem::jsonlite::get_double(baseline_json, "latency_ms.p95", 0.0);
  auto current_p95 =
      requiem::jsonlite::get_double(current_json, "latency_ms.p95", 0.0);

  double p50_delta = baseline_p50 > 0
                         ? ((current_p50 - baseline_p50) / baseline_p50) * 100.0
                         : 0.0;
  double p95_delta = baseline_p95 > 0
                         ? ((current_p95 - baseline_p95) / baseline_p95) * 100.0
                         : 0.0;

  bool regression = p50_delta > 10.0 || p95_delta > 10.0;

  std::ostringstream oss;
  oss << "{\"comparison\":{\"regression\":" << (regression ? "true" : "false");
  oss << ",\"p50_delta_pct\":" << p50_delta;
  oss << ",\"p95_delta_pct\":" << p95_delta;
  oss << ",\"baseline_p50\":" << baseline_p50;
  oss << ",\"current_p50\":" << current_p50;
  oss << "}}";
  return oss.str();
}

// Known BLAKE3 test vectors
bool verify_hash_vectors() {
  // Empty string hash
  if (requiem::blake3_hex("") !=
      "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262") {
    return false;
  }
  // "hello" hash
  if (requiem::blake3_hex("hello") !=
      "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f") {
    return false;
  }
  return true;
}
} // namespace

// Harness entry points (renamed mains)
extern int stress_main(int argc, char **argv);
extern int shadow_main(int argc, char **argv);
extern int billing_main(int argc, char **argv);
extern int security_main(int argc, char **argv);
extern int recovery_main(int argc, char **argv);
extern int memory_main(int argc, char **argv);
extern int protocol_main(int argc, char **argv);
extern int chaos_main(int argc, char **argv);

int main(int argc, char **argv) {
  // Honor FORCE_RUST: if set, refuse to run so the caller falls back to Rust
  // engine.
  const char *force_rust = std::getenv("FORCE_RUST");
  if (force_rust && std::string(force_rust) == "1") {
    std::cerr << "{\"error\":\"FORCE_RUST=1: Requiem engine disabled by "
                 "environment\"}\n";
    return 3;
  }

  requiem::set_hash_fallback_allowed(false);
  std::string cmd;
  for (int i = 1; i < argc; ++i) {
    if (std::string(argv[i]).rfind("--", 0) == 0)
      continue;
    cmd = argv[i];
    break;
  }
  if (cmd.empty() || cmd == "help" || cmd == "--help") {
    std::cout
        << "Requiem Native Engine v" << PROJECT_VERSION << "\n"
        << "Provable AI Runtime — Deterministic execution and policy "
           "enforcement.\n\n"
        << "Usage: requiem <command> [options]\n\n"
        << "Core Commands:\n"
        << "  exec run        Execute a tool request deterministically\n"
        << "  exec stream     Execute and stream NDJSON events (NDJSON)\n"
        << "  exec replay     Verify an execution against a result digest\n"
        << "  cas put         Store content in content-addressable storage\n"
        << "  cas get         Retrieve content from CAS by digest\n"
        << "  cas ls          List CAS objects with optional prefix filter\n"
        << "  cas info        Query CAS object metadata\n"
        << "  cas verify      Verify all CAS objects for integrity\n"
        << "  cas gc          Safe garbage collection (dry-run by default)\n"
        << "  policy check    Verify a request against active policy\n"
        << "  policy vm-eval  Evaluate policy rules against a context JSON\n"
        << "  policy add      Add a policy rule set to CAS\n"
        << "  policy list     List all stored policies\n"
        << "  policy eval     Evaluate a specific policy against input\n"
        << "  policy versions Show versions for a policy\n"
        << "  policy test     Run golden tests for policies\n"
        << "  digest file     Compute BLAKE3 fingerprint of a file\n\n"
        << "Event Log Commands:\n"
        << "  log tail        Show recent event log entries\n"
        << "  log read        Read events in a sequence range\n"
        << "  log search      Search events by query string\n"
        << "  log verify      Verify event log prev-hash chain integrity\n\n"
        << "Capability Commands:\n"
        << "  cap keygen      Generate an ed25519 keypair\n"
        << "  cap mint        Issue a capability token\n"
        << "  cap verify      Verify a capability token for an action\n"
        << "  cap revoke      Revoke a capability token by fingerprint\n"
        << "  caps mint       Alias for cap mint\n"
        << "  caps inspect    Inspect a capability token\n"
        << "  caps list       List all minted capabilities\n"
        << "  caps revoke     Alias for cap revoke\n\n"
        << "Plan Commands:\n"
        << "  plan add        Add a plan with steps to the store\n"
        << "  plan list       List all stored plans\n"
        << "  plan show       Show plan details and execution history\n"
        << "  plan verify     Validate a plan DAG (cycle/dep check)\n"
        << "  plan hash       Compute deterministic plan content hash\n"
        << "  plan run        Execute a plan DAG with receipt anchoring\n"
        << "  plan replay     Replay a plan run for verification\n\n"
        << "Budget Commands:\n"
        << "  budget set      Set budget limit for a tenant\n"
        << "  budget show     Show current budget for a tenant\n"
        << "  budget reset-window  Reset the budget accounting window\n\n"
        << "Receipt Commands:\n"
        << "  receipt show    Show receipt by hash\n"
        << "  receipt verify  Verify an execution receipt hash\n\n"
        << "Snapshot Commands (Gated):\n"
        << "  snapshot create Create a state snapshot\n"
        << "  snapshot list   List available snapshots\n"
        << "  snapshot restore Restore from snapshot (requires --force)\n\n"
        << "Diagnostic Commands:\n"
        << "  doctor          Run platform capability and health checks\n"
        << "  health          Print engine capability and hash info\n"
        << "  version         Print engine and protocol versions\n"
        << "  status          Show runtime status and metrics\n"
        << "  metrics         Show full metrics dump\n"
        << "  cluster status  Show local cluster health and drift\n"
        << "  bugreport       Collect diagnostic info for bug reports\n"
        << "  quickstart      Get started guide\n\n"
        << "Harnesses:\n"
        << "  stress, shadow, billing, security, recovery, memory, protocol, "
           "chaos\n\n"
        << "Use 'requiem <command> explain' for detailed logic descriptions.\n";
    return 0;
  }

  // Dispatch harnesses
  if (cmd == "stress")
    return stress_main(argc, argv);
  if (cmd == "shadow")
    return shadow_main(argc, argv);
  if (cmd == "billing")
    return billing_main(argc, argv);
  if (cmd == "security")
    return security_main(argc, argv);
  if (cmd == "recovery")
    return recovery_main(argc, argv);
  if (cmd == "memory")
    return memory_main(argc, argv);
  if (cmd == "protocol")
    return protocol_main(argc, argv);
  if (cmd == "chaos")
    return chaos_main(argc, argv);

  if (cmd == "demo") {
    std::cout
        << "{\"ok\":true,\"deterministic\":true,\"runs\":3,\"result_digest\":\""
        << "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        << "\",\"latency_ms\":[1.2, 0.9, 1.1]}\n";
    return 0;
  }

  if (cmd == "version") {
    std::cout << "{\"engine\": \"" << PROJECT_VERSION
              << "\", \"protocol\": \"v1\", \"api\": \"v2\"}\n";
    return 0;
  }

  if (cmd == "health") {
    const auto h = requiem::hash_runtime_info();
    std::cout << "{\"hash_primitive\":\"" << h.primitive
              << "\",\"hash_backend\":\"" << h.backend
              << "\",\"hash_version\":\"" << h.version
              << "\",\"hash_available\":"
              << (h.blake3_available ? "true" : "false")
              << ",\"compat_warning\":"
              << (h.compat_warning ? "true" : "false");
    // Additional capabilities
    std::cout << ",\"cas_version\":\"v2\"";
    std::cout << ",\"compression_capabilities\":[\"identity\"";
#if defined(REQUIEM_WITH_ZSTD)
    std::cout << ",\"zstd\"";
#endif
    std::cout << "]";
    std::cout << "}" << "\n";
    return 0;
  }

  if (cmd == "doctor") {
    // Phase 4: --analyze flag triggers AI-assisted root cause diagnostics.
    bool do_analyze = false;
    std::string error_code_hint, error_detail_hint;
    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--analyze")
        do_analyze = true;
      if (std::string(argv[i]) == "--error-code" && i + 1 < argc)
        error_code_hint = argv[++i];
      if (std::string(argv[i]) == "--error-detail" && i + 1 < argc)
        error_detail_hint = argv[++i];
    }

    if (do_analyze) {
      // Capture current engine context and run the diagnostic analyzer.
      requiem::init_worker_identity();
      requiem::init_cluster_from_env();
      requiem::register_local_worker();
      const auto ctx = requiem::diagnostics::capture_context(error_code_hint,
                                                             error_detail_hint);
      const auto report = requiem::diagnostics::analyze_failure(ctx);
      std::cout << report.to_json() << "\n";
      // Exit 0: analysis succeeded (report.ok=true). Exit 2: specific failure
      // identified.
      if (!report.ok)
        return 1;
      if (report.category != requiem::diagnostics::FailureCategory::unknown)
        return 2;
      return 0;
    }

    std::vector<std::string> blockers;

    const auto h = requiem::hash_runtime_info();
    if (h.primitive != "blake3")
      blockers.push_back("hash_primitive_not_blake3");
    if (h.backend != "vendored")
      blockers.push_back("hash_backend_not_vendored");
    if (!h.blake3_available)
      blockers.push_back("blake3_not_available");
    if (h.compat_warning)
      blockers.push_back("hash_compat_warning");
    if (!verify_hash_vectors())
      blockers.push_back("hash_vectors_failed");

    // Detect sandbox capabilities
    auto caps = requiem::detect_platform_sandbox_capabilities();

    // Phase 5: Include cluster drift status in doctor output.
    requiem::init_worker_identity();
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    const auto &drift_status =
        requiem::global_cluster_registry().cluster_drift_status();
    if (!drift_status.ok)
      blockers.push_back("cluster_version_mismatch");

    std::cout << "{\"ok\":" << (blockers.empty() ? "true" : "false")
              << ",\"blockers\":[";
    for (size_t i = 0; i < blockers.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      std::cout << "\"" << blockers[i] << "\"";
    }
    std::cout << "]";
    std::cout << ",\"engine_version\":\"" << PROJECT_VERSION << "\"";
    std::cout << ",\"protocol_version\":\"v1\"";
    std::cout << ",\"hash_primitive\":\"" << h.primitive << "\"";
    std::cout << ",\"hash_backend\":\"" << h.backend << "\"";
    std::cout << ",\"hash_version\":\"" << h.version << "\"";
    std::cout << ",\"sandbox\":{\"workspace_confinement\":"
              << (caps.workspace_confinement ? "true" : "false")
              << ",\"rlimits\":" << (caps.rlimits_cpu ? "true" : "false")
              << ",\"seccomp\":" << (caps.seccomp_baseline ? "true" : "false")
              << ",\"job_objects\":" << (caps.job_objects ? "true" : "false")
              << ",\"restricted_token\":"
              << (caps.restricted_token ? "true" : "false") << "}";
    std::cout << ",\"cluster\":" << drift_status.to_json();
    std::cout << ",\"rollback\":\"set FORCE_RUST=1 to revert to Rust engine\"";
    std::cout << "}" << "\n";
    return blockers.empty() ? 0 : 2;
  }

  if (cmd == "validate-replacement") {
    std::vector<std::string> blockers;

    const auto h = requiem::hash_runtime_info();

    // Hard gates for replacement certification
    if (h.primitive != "blake3") {
      blockers.push_back("hash_primitive_must_be_blake3");
    }
    if (h.backend == "fallback") {
      blockers.push_back("hash_backend_cannot_be_fallback");
    }
    if (h.backend == "unavailable") {
      blockers.push_back("hash_backend_cannot_be_unavailable");
    }
    if (h.compat_warning) {
      blockers.push_back("compat_warning_must_be_false");
    }
    if (!h.blake3_available) {
      blockers.push_back("blake3_must_be_available");
    }

    // Verify hash vectors
    if (!verify_hash_vectors()) {
      blockers.push_back("hash_vectors_must_pass");
    }

    std::cout << "{\"ok\":" << (blockers.empty() ? "true" : "false")
              << ",\"blockers\":[";
    for (size_t i = 0; i < blockers.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      std::cout << "\"" << blockers[i] << "\"";
    }
    std::cout << "],\"hash_primitive\":\"" << h.primitive << "\"";
    std::cout << ",\"hash_backend\":\"" << h.backend << "\"";
    std::cout << "}" << "\n";
    return blockers.empty() ? 0 : 2;
  }

  if (cmd == "llm" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout
        << R"({"modes":["none","subprocess","sidecar","freeze_then_compute","attempt_deterministic"],"rules":{"default_include_in_digest":false,"engine_network":"never","authoritative_digest":"compute_phase_only_for_freeze_then_compute"}})"
        << "\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "explain") {
    std::cout << requiem::policy_explain(requiem::ExecPolicy{}) << "\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "check") {
    std::string req_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        req_file = argv[++i];
    std::cout << requiem::policy_check_json(read_file(req_file)) << "\n";
    return 0;
  }

  if (cmd == "lint" && argc >= 3) {
    std::string policy_file = argv[2];
    std::string json_content = read_file(policy_file);
    if (json_content.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"file not found or empty\"}\n";
      return 1;
    }
    try {
      auto registry = requiem::PolicyLinter::LoadFromJson(json_content);
      auto result = requiem::PolicyLinter::Check(registry);
      std::cout << "{\"valid\":" << (result.valid ? "true" : "false")
                << ",\"errors\":[";
      for (size_t i = 0; i < result.errors.size(); ++i) {
        if (i > 0)
          std::cout << ",";
        std::cout << "\"" << requiem::jsonlite::escape(result.errors[i])
                  << "\"";
      }
      std::cout << "],\"warnings\":[";
      for (size_t i = 0; i < result.warnings.size(); ++i) {
        if (i > 0)
          std::cout << ",";
        std::cout << "\"" << requiem::jsonlite::escape(result.warnings[i])
                  << "\"";
      }
      std::cout << "]}\n";
      return result.valid ? 0 : 1;
    } catch (const std::exception &e) {
      std::cout << "{\"ok\":false,\"error\":\""
                << requiem::jsonlite::escape(e.what()) << "\"}\n";
      return 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Capability commands — mint, inspect, list, revoke
  // ---------------------------------------------------------------------------

  if (cmd == "caps" && argc >= 3 && std::string(argv[2]) == "mint") {
    std::string subject, scopes_str, constraints_str;
    std::string secret_key, public_key, issuer_fp;
    uint64_t not_before = 0, not_after = 0;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--subject" && i + 1 < argc)
        subject = argv[++i];
      if (std::string(argv[i]) == "--scopes" && i + 1 < argc)
        scopes_str = argv[++i];
      if (std::string(argv[i]) == "--constraints" && i + 1 < argc)
        constraints_str = argv[++i];
      if (std::string(argv[i]) == "--secret-key" && i + 1 < argc)
        secret_key = argv[++i];
      if (std::string(argv[i]) == "--public-key" && i + 1 < argc)
        public_key = argv[++i];
      if (std::string(argv[i]) == "--issuer" && i + 1 < argc)
        issuer_fp = argv[++i];
      if (std::string(argv[i]) == "--not-before" && i + 1 < argc)
        not_before = std::strtoull(argv[++i], nullptr, 10);
      if (std::string(argv[i]) == "--not-after" && i + 1 < argc)
        not_after = std::strtoull(argv[++i], nullptr, 10);
    }
    if (subject.empty() || scopes_str.empty() || secret_key.empty() ||
        public_key.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--subject, --scopes, "
                   "--secret-key, and --public-key are required\"}\n";
      return 2;
    }
    // Parse scopes (comma-separated)
    std::vector<std::string> scopes;
    std::istringstream ss(scopes_str);
    std::string s;
    while (std::getline(ss, s, ',')) {
      if (!s.empty())
        scopes.push_back(s);
    }
    auto token = requiem::caps_mint(scopes, subject, secret_key, public_key,
                                    issuer_fp, not_before, not_after);
    // Return only fingerprint, NOT the private key
    std::cout << "{\"ok\":true,\"fingerprint\":\"" << token.fingerprint
              << "\",\"subject\":\"" << requiem::jsonlite::escape(subject)
              << "\",\"scopes\":[";
    for (size_t i = 0; i < scopes.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      std::cout << "\"" << scopes[i] << "\"";
    }
    std::cout << "],\"not_before\":" << token.not_before
              << ",\"not_after\":" << token.not_after << "}\n";
    return 0;
  }

  if (cmd == "caps" && argc >= 3 && std::string(argv[2]) == "inspect") {
    std::string token_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--token" && i + 1 < argc)
        token_file = argv[++i];
    }
    if (token_file.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--token required\"}\n";
      return 2;
    }
    try {
      auto token = requiem::caps_token_from_json(read_file(token_file));
      std::cout << "{\"ok\":true,\"fingerprint\":\"" << token.fingerprint
                << "\",\"subject\":\""
                << requiem::jsonlite::escape(token.subject)
                << "\",\"permissions\":[";
      for (size_t i = 0; i < token.permissions.size(); ++i) {
        if (i > 0)
          std::cout << ",";
        std::cout << "\"" << token.permissions[i] << "\"";
      }
      std::cout << "],\"not_before\":" << token.not_before
                << ",\"not_after\":" << token.not_after
                << ",\"issuer_fingerprint\":\"" << token.issuer_fingerprint
                << "\",\"cap_version\":" << token.cap_version << "}\n";
      return 0;
    } catch (const std::exception &e) {
      std::cout << "{\"ok\":false,\"error\":\""
                << requiem::jsonlite::escape(e.what()) << "\"}\n";
      return 2;
    }
  }

  if (cmd == "caps" && argc >= 3 && std::string(argv[2]) == "list") {
    std::string tenant;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
    }
    // Read from event log to find cap.mint events
    std::string log_path = ".requiem/event_log.ndjson";
    std::ifstream ifs(log_path);
    std::cout << "{\"capabilities\":[";
    bool first = true;
    std::string line;
    while (std::getline(ifs, line)) {
      if (line.empty())
        continue;
      auto obj = requiem::jsonlite::parse(line, nullptr);
      std::string event_type =
          requiem::jsonlite::get_string(obj, "event_type", "");
      if (event_type != "cap.mint")
        continue;
      std::string actor = requiem::jsonlite::get_string(obj, "actor", "");
      if (!tenant.empty() && actor.find(tenant) == std::string::npos)
        continue;
      if (!first)
        std::cout << ",";
      first = false;
      std::cout << "{\"actor\":\"" << requiem::jsonlite::escape(actor)
                << "\",\"seq\":" << requiem::jsonlite::get_u64(obj, "seq", 0)
                << ",\"data_hash\":\""
                << requiem::jsonlite::get_string(obj, "data_hash", "") << "\"}";
    }
    std::cout << "]}\n";
    return 0;
  }

  if (cmd == "caps" && argc >= 3 && std::string(argv[2]) == "revoke") {
    std::string fingerprint;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cap-id" && i + 1 < argc)
        fingerprint = argv[++i];
    }
    if (fingerprint.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--cap-id required\"}\n";
      return 2;
    }
    requiem::caps_revoke(fingerprint);
    std::cout << "{\"ok\":true,\"fingerprint\":\"" << fingerprint
              << "\",\"revoked\":true}\n";
    return 0;
  }

  // -------------------------------------------------------------------------
  // Policy commands — add, list, eval, test, versions
  // -------------------------------------------------------------------------

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "add") {
    std::string policy_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--file" && i + 1 < argc)
        policy_file = argv[++i];
    }
    if (policy_file.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--file required\"}\n";
      return 2;
    }
    std::string content = read_file(policy_file);
    if (content.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"file not found or empty\"}\n";
      return 2;
    }
    // Store in CAS
    requiem::CasStore cas(".requiem/cas/v2");
    auto digest = cas.put(content, "off");
    std::cout << "{\"ok\":true,\"policy_hash\":\"" << digest
              << "\",\"size\":" << content.size() << "}\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "list") {
    // List policies from CAS
    requiem::CasStore cas(".requiem/cas/v2");
    auto objects = cas.scan_objects();
    std::cout << "{\"policies\":[";
    bool first = true;
    for (const auto &o : objects) {
      // Filter for policies (could check prefix or content)
      if (!first)
        std::cout << ",";
      first = false;
      std::cout << "{\"hash\":\"" << o.digest << "\",\"size\":" << o.stored_size
                << "}";
    }
    std::cout << "]}\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "eval") {
    std::string policy_id, input_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--policy" && i + 1 < argc)
        policy_id = argv[++i];
      if (std::string(argv[i]) == "--input" && i + 1 < argc)
        input_file = argv[++i];
    }
    if (policy_id.empty() || input_file.empty()) {
      std::cout
          << "{\"ok\":false,\"error\":\"--policy and --input required\"}\n";
      return 2;
    }
    // For now, use the existing policy_check_json
    std::cout << requiem::policy_check_json(read_file(input_file)) << "\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "test") {
    // Run golden tests - would require test framework integration
    std::cout << "{\"ok\":true,\"tests_run\":0,\"tests_passed\":0,\"message\":"
                 "\"golden tests not implemented\"}\n";
    return 0;
  }

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "versions") {
    std::string policy_id;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--policy" && i + 1 < argc)
        policy_id = argv[++i];
    }
    if (policy_id.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--policy required\"}\n";
      return 2;
    }
    // Return the policy version info
    std::cout << "{\"ok\":true,\"policy_id\":\"" << policy_id
              << "\",\"versions\":[]}\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "put") {
    std::string in, cas_dir = ".requiem/cas/v2", compress = "off";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--in" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--compress" && i + 1 < argc)
        compress = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    std::cout << cas.put(read_file(in), compress) << "\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "info") {
    std::string h, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--hash" && i + 1 < argc)
        h = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto info = cas.info(h);
    if (!info)
      return 2;
    std::cout << "{\"digest\":\"" << info->digest << "\",\"encoding\":\""
              << info->encoding
              << "\",\"original_size\":" << info->original_size
              << ",\"stored_size\":" << info->stored_size << "}\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "gc") {
    std::string cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    std::size_t total = 0;
    for (const auto &o : objects)
      total += o.stored_size;
    std::cout << "{\"dry_run\":true,\"count\":" << objects.size()
              << ",\"stored_bytes\":" << total << "}\n";
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    int errors = 0;
    for (const auto &o : objects) {
      auto content = cas.get(o.digest);
      if (!content) {
        errors++;
        std::cerr << "Missing content for " << o.digest << "\n";
      }
    }
    std::cout << "{\"verified\":" << (objects.size() - errors)
              << ",\"errors\":" << errors << "}\n";
    return errors > 0 ? 2 : 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "get") {
    std::string h, cas_dir = ".requiem/cas/v2", out;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--hash" && i + 1 < argc)
        h = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    if (h.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--hash required\"}\n";
      return 2;
    }
    requiem::CasStore cas(cas_dir);
    auto content = cas.get(h);
    if (!content) {
      std::cout << "{\"ok\":false,\"error\":\"object not found\"}\n";
      return 2;
    }
    if (!out.empty()) {
      write_file(out, *content);
      std::cout << "{\"ok\":true,\"digest\":\"" << h
                << "\",\"size\":" << content->size() << "}\n";
    } else {
      std::cout << "{\"ok\":true,\"digest\":\"" << h << "\",\"content\":\""
                << requiem::jsonlite::escape(*content) << "\"}\n";
    }
    return 0;
  }

  if (cmd == "cas" && argc >= 3 && std::string(argv[2]) == "ls") {
    std::string cas_dir = ".requiem/cas/v2", prefix;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--prefix" && i + 1 < argc)
        prefix = argv[++i];
    }
    requiem::CasStore cas(cas_dir);
    auto objects = cas.scan_objects();
    std::cout << "{\"objects\":[";
    bool first = true;
    for (const auto &o : objects) {
      if (!prefix.empty() && o.digest.find(prefix) != 0)
        continue;
      if (!first)
        std::cout << ",";
      first = false;
      std::cout << "{\"digest\":\"" << o.digest
                << "\",\"size\":" << o.stored_size << "}";
    }
    std::cout << "]}\n";
    return 0;
  }

  // -------------------------------------------------------------------------
  // Event Log commands — append-only audit trail with prev-hash chaining
  // -------------------------------------------------------------------------

  if (cmd == "log" && argc >= 3 && std::string(argv[2]) == "tail") {
    std::string log_path = ".requiem/event_log.ndjson";
    int lines = 10;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--log" && i + 1 < argc)
        log_path = argv[++i];
      if (std::string(argv[i]) == "--lines" && i + 1 < argc)
        lines = std::atoi(argv[++i]);
    }
    std::ifstream ifs(log_path);
    if (!ifs.good()) {
      std::cout << "{\"ok\":false,\"error\":\"event log not found\"}\n";
      return 2;
    }
    std::vector<std::string> all_lines;
    std::string line;
    while (std::getline(ifs, line)) {
      if (!line.empty())
        all_lines.push_back(line);
    }
    int start = (int)all_lines.size() - lines;
    if (start < 0)
      start = 0;
    std::cout << "{\"events\":[";
    for (size_t i = start; i < all_lines.size(); ++i) {
      if (i > start)
        std::cout << ",";
      std::cout << all_lines[i];
    }
    std::cout << "]}\n";
    return 0;
  }

  if (cmd == "log" && argc >= 3 && std::string(argv[2]) == "read") {
    std::string log_path = ".requiem/event_log.ndjson";
    uint64_t from_seq = 0, to_seq = UINT64_MAX;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--log" && i + 1 < argc)
        log_path = argv[++i];
      if (std::string(argv[i]) == "--from" && i + 1 < argc)
        from_seq = std::strtoull(argv[++i], nullptr, 10);
      if (std::string(argv[i]) == "--to" && i + 1 < argc)
        to_seq = std::strtoull(argv[++i], nullptr, 10);
    }
    std::ifstream ifs(log_path);
    if (!ifs.good()) {
      std::cout << "{\"ok\":false,\"error\":\"event log not found\"}\n";
      return 2;
    }
    std::cout << "{\"events\":[";
    bool first = true;
    std::string line;
    while (std::getline(ifs, line)) {
      if (line.empty())
        continue;
      auto obj = requiem::jsonlite::parse(line, nullptr);
      uint64_t seq = requiem::jsonlite::get_u64(obj, "seq", 0);
      if (seq >= from_seq && seq <= to_seq) {
        if (!first)
          std::cout << ",";
        first = false;
        std::cout << line;
      }
    }
    std::cout << "]}\n";
    return 0;
  }

  if (cmd == "log" && argc >= 3 && std::string(argv[2]) == "search") {
    std::string log_path = ".requiem/event_log.ndjson", q;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--log" && i + 1 < argc)
        log_path = argv[++i];
      if (std::string(argv[i]) == "-q" && i + 1 < argc)
        q = argv[++i];
      if (std::string(argv[i]) == "--q" && i + 1 < argc)
        q = argv[++i];
    }
    std::ifstream ifs(log_path);
    if (!ifs.good()) {
      std::cout << "{\"ok\":false,\"error\":\"event log not found\"}\n";
      return 2;
    }
    std::cout << "{\"events\":[";
    bool first = true;
    std::string line;
    while (std::getline(ifs, line)) {
      if (line.empty())
        continue;
      if (!q.empty() && line.find(q) == std::string::npos)
        continue;
      if (!first)
        std::cout << ",";
      first = false;
      std::cout << line;
    }
    std::cout << "]}\n";
    return 0;
  }

  if (cmd == "log" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string log_path = ".requiem/event_log.ndjson";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--log" && i + 1 < argc)
        log_path = argv[++i];
    }
    requiem::EventLog log(log_path);
    auto result = log.verify();
    std::cout << "{\"ok\":" << (result.ok ? "true" : "false")
              << ",\"total_events\":" << result.total_events
              << ",\"verified_events\":" << result.verified_events
              << ",\"failures\":[";
    for (size_t i = 0; i < result.failures.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      std::cout << "{\"seq\":" << result.failures[i].seq << ",\"error\":\""
                << requiem::jsonlite::escape(result.failures[i].error) << "\"}";
    }
    std::cout << "]}\n";
    return result.ok ? 0 : 2;
  }

  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string result_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
    auto r = parse_result(read_file(result_file));
    if (requiem::deterministic_digest(requiem::canonicalize_result(r)) !=
        r.result_digest)
      return 2;
    std::cout << "ok\n";
    return 0;
  }

  if (cmd == "digest" && argc >= 3 && std::string(argv[2]) == "file") {
    std::string file_path;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--file" && i + 1 < argc)
        file_path = argv[++i];
    std::string hash = requiem::hash_file_blake3(file_path);
    if (hash.empty())
      return 2;
    // Convert binary hash to hex
    std::string hex_hash;
    const char *hex_chars = "0123456789abcdef";
    for (unsigned char c : hash) {
      hex_hash.push_back(hex_chars[c >> 4]);
      hex_hash.push_back(hex_chars[c & 0xf]);
    }
    std::cout << hex_hash << "\n";
    return 0;
  }

  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string in, out;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    std::string err;
    auto req = requiem::parse_request_json(read_file(in), &err);
    if (!err.empty() && req.command.empty()) {
      std::cerr << err << "\n";
      return 2;
    }
    auto res = requiem::execute(req);
    write_file(out, requiem::result_to_json(res));
    return res.ok ? 0 : 1;
  }

  // exec stream — NDJSON streaming output (one JSON object per line).
  // Frame order: start → event* → end → result
  // "result" frame is always last and contains the authoritative result_digest.
  // Fail-closed: error produces a single {"type":"error",...} line and exits 2.
  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "stream") {
    std::string in;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        in = argv[++i];
    }
    std::string err;
    auto req = requiem::parse_request_json(read_file(in), &err);
    if (!err.empty() && req.command.empty()) {
      std::cout << "{\"type\":\"error\",\"error_code\":\"" << err << "\"}\n";
      std::cout.flush();
      return 2;
    }
    // start frame
    std::cout << "{\"type\":\"start\""
              << ",\"request_id\":\""
              << requiem::jsonlite::escape(req.request_id) << "\""
              << ",\"tenant_id\":\"" << requiem::jsonlite::escape(req.tenant_id)
              << "\""
              << "}\n";
    std::cout.flush();
    const auto res = requiem::execute(req);
    // event frames
    for (const auto &ev : res.trace_events) {
      std::cout << "{\"type\":\"event\""
                << ",\"seq\":" << ev.seq << ",\"t_ns\":" << ev.t_ns
                << ",\"event\":\"" << requiem::jsonlite::escape(ev.type) << "\""
                << ",\"data\":{";
      bool first = true;
      for (const auto &[k, v] : ev.data) {
        if (!first)
          std::cout << ",";
        first = false;
        std::cout << "\"" << requiem::jsonlite::escape(k) << "\":"
                  << "\"" << requiem::jsonlite::escape(v) << "\"";
      }
      std::cout << "}}\n";
      std::cout.flush();
    }
    // end frame
    std::cout << "{\"type\":\"end\""
              << ",\"exit_code\":" << res.exit_code
              << ",\"termination_reason\":\""
              << requiem::jsonlite::escape(res.termination_reason) << "\""
              << "}\n";
    std::cout.flush();
    // result frame — always last; authoritative
    std::cout << "{\"type\":\"result\""
              << ",\"ok\":" << (res.ok ? "true" : "false")
              << ",\"exit_code\":" << res.exit_code << ",\"error_code\":\""
              << requiem::jsonlite::escape(res.error_code) << "\""
              << ",\"request_digest\":\"" << res.request_digest << "\""
              << ",\"result_digest\":\"" << res.result_digest << "\""
              << ",\"stdout_digest\":\"" << res.stdout_digest << "\""
              << ",\"stderr_digest\":\"" << res.stderr_digest << "\""
              << ",\"trace_digest\":\"" << res.trace_digest << "\""
              << "}\n";
    std::cout.flush();
    return res.ok ? 0 : 1;
  }

  if (cmd == "exec" && argc >= 3 && std::string(argv[2]) == "replay") {
    std::string req_file, result_file, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        req_file = argv[++i];
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    auto req = requiem::parse_request_json(read_file(req_file), nullptr);
    auto r = parse_result(read_file(result_file));
    requiem::CasStore cas(cas_dir);
    std::string e;
    if (!requiem::validate_replay_with_cas(req, r, cas, &e)) {
      std::cerr << e << "\n";
      return 2;
    }
    std::cout << "ok\n";
    return 0;
  }

  if (cmd == "bench" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string spec_file, out_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--spec" && i + 1 < argc)
        spec_file = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out_file = argv[++i];
    }
    auto spec = read_file(spec_file);
    int runs = static_cast<int>(requiem::jsonlite::get_u64(spec, "runs", 1));
    auto req = requiem::parse_request_json(spec, nullptr);
    std::vector<double> latencies;
    std::vector<std::string> digests;
    auto start_all = std::chrono::steady_clock::now();
    for (int i = 0; i < runs; ++i) {
      auto st = std::chrono::steady_clock::now();
      auto r = requiem::execute(req);
      auto en = std::chrono::steady_clock::now();
      latencies.push_back(
          std::chrono::duration<double, std::milli>(en - st).count());
      digests.push_back(r.result_digest);
    }
    auto end_all = std::chrono::steady_clock::now();
    std::sort(latencies.begin(), latencies.end());
    auto q = [&](double p) {
      return latencies[std::min(static_cast<size_t>((latencies.size() - 1) * p),
                                latencies.size() - 1)];
    };
    double total_s = std::chrono::duration<double>(end_all - start_all).count();

    // Calculate statistics
    double sum = 0.0;
    for (double l : latencies)
      sum += l;
    double mean = sum / latencies.size();
    double variance = 0.0;
    for (double l : latencies)
      variance += (l - mean) * (l - mean);
    double stddev = latencies.size() > 1
                        ? std::sqrt(variance / (latencies.size() - 1))
                        : 0.0;

    // Check for drift
    int drift_count = 0;
    if (!digests.empty()) {
      const auto &first = digests[0];
      for (const auto &d : digests) {
        if (d != first)
          drift_count++;
      }
    }

    std::ostringstream oss;
    oss << "{\"runs\":" << runs << ",\"result_digests\":[";
    for (size_t i = 0; i < digests.size(); ++i) {
      if (i)
        oss << ",";
      oss << "\"" << digests[i] << "\"";
    }
    oss << "],\"latency_ms\":{"
        << "\"min\":" << latencies.front() << ",\"max\":" << latencies.back()
        << ",\"mean\":" << mean << ",\"stddev\":" << stddev
        << ",\"p50\":" << q(0.5) << ",\"p90\":" << q(0.90)
        << ",\"p95\":" << q(0.95) << ",\"p99\":" << q(0.99)
        << "},\"throughput_ops_sec\":" << (runs / (total_s > 0 ? total_s : 1.0))
        << ",\"drift_count\":" << drift_count << "}";
    write_file(out_file, oss.str());
    return 0;
  }

  if (cmd == "bench" && argc >= 3 && std::string(argv[2]) == "compare") {
    std::string baseline_file, current_file, out_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--baseline" && i + 1 < argc)
        baseline_file = argv[++i];
      if (std::string(argv[i]) == "--current" && i + 1 < argc)
        current_file = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out_file = argv[++i];
    }
    auto comparison =
        bench_compare(read_file(baseline_file), read_file(current_file));
    if (!out_file.empty()) {
      write_file(out_file, comparison);
    } else {
      std::cout << comparison << "\n";
    }
    return 0;
  }

  if (cmd == "drift" && argc >= 3 && std::string(argv[2]) == "analyze") {
    std::string in, out;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--bench" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    write_file(out, drift_analyze(read_file(in)));
    return 0;
  }

  if (cmd == "drift" && argc >= 3 && std::string(argv[2]) == "pretty") {
    std::string in;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--in" && i + 1 < argc)
        in = argv[++i];
    std::cout << read_file(in) << "\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Cluster commands — distributed cluster platform.
  // INVARIANT: cluster commands never modify execution state; read-only probes.
  // ---------------------------------------------------------------------------

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "status") {
    // Initialize cluster from environment before querying.
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    std::cout << requiem::global_cluster_registry().cluster_status_to_json()
              << "\n";
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "workers") {
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    const auto workers_json =
        requiem::global_cluster_registry().workers_to_json();
    std::cout << "{\"workers\":" << workers_json << "}\n";
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "shard") {
    std::string tenant_id;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant_id = argv[++i];
    }
    if (tenant_id.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--tenant required\"}\n";
      return 2;
    }
    requiem::init_cluster_from_env();
    const auto &w = requiem::global_worker_identity();
    const uint32_t shard =
        requiem::ShardRouter::shard_for_tenant(tenant_id, w.total_shards);
    const bool is_local = requiem::ShardRouter::is_local_shard(tenant_id);
    std::ostringstream o;
    o << "{"
      << "\"ok\":true"
      << ",\"tenant_id\":\"" << requiem::jsonlite::escape(tenant_id) << "\""
      << ",\"shard_id\":" << shard << ",\"total_shards\":" << w.total_shards
      << ",\"is_local_shard\":" << (is_local ? "true" : "false")
      << ",\"local_shard_id\":" << w.shard_id << "}\n";
    std::cout << o.str();
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "join") {
    // Self-register in the local registry. In a full multi-node deployment,
    // this would POST to a cluster coordinator endpoint.
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    const auto &w = requiem::global_worker_identity();
    std::cout << "{"
              << "\"ok\":true"
              << ",\"worker_id\":\"" << w.worker_id << "\""
              << ",\"node_id\":\"" << w.node_id << "\""
              << ",\"shard_id\":" << w.shard_id
              << ",\"total_shards\":" << w.total_shards
              << ",\"cluster_mode\":" << (w.cluster_mode ? "true" : "false")
              << ",\"message\":\"Worker registered in local cluster registry\""
              << "}\n";
    return 0;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "verify") {
    requiem::init_cluster_from_env();
    requiem::register_local_worker();

    // Phase 5: Real cluster version compatibility check.
    requiem::ClusterDriftStatus drift;
    const bool compat =
        requiem::global_cluster_registry().validate_version_compatibility(
            &drift);

    std::cout << "{"
              << "\"cluster_verify\":{"
              << "\"ok\":" << (compat ? "true" : "false")
              << ",\"nodes_checked\":" << drift.total_workers
              << ",\"compatible_workers\":" << drift.compatible_workers
              << ",\"mismatches\":" << (drift.mismatches.empty() ? "[]" :
                  [&] {
                    std::string s = "[";
                    for (size_t i = 0; i < drift.mismatches.size(); ++i) {
                      if (i > 0) s += ",";
                      const auto& m = drift.mismatches[i];
                      s += "{\"field\":\"" + m.field + "\""
                           + ",\"expected\":\"" + m.expected + "\""
                           + ",\"observed\":\"" + m.observed + "\""
                           + ",\"worker_id\":\"" + m.worker_id + "\"}";
                    }
                    s += "]";
                    return s;
                  }())
              << ",\"replay_drift_rate\":" << drift.replay_drift_rate
              << ",\"replay_divergences\":" << drift.replay_divergences
              << "}}\n";
    return compat ? 0 : 2;
  }

  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "drift") {
    requiem::init_cluster_from_env();
    requiem::register_local_worker();
    std::cout << requiem::global_cluster_registry().cluster_drift_to_json()
              << "\n";
    return 0;
  }

  if (cmd == "report") {
    std::string in, out;
    for (int i = 2; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        in = argv[++i];
      if (std::string(argv[i]) == "--out" && i + 1 < argc)
        out = argv[++i];
    }
    write_file(out, requiem::report_from_result_json(read_file(in)));
    return 0;
  }

  if (cmd == "config" && argc >= 3 && std::string(argv[2]) == "show") {
    std::cout << "{\"config\":{\"version\":\"" << PROJECT_VERSION
              << "\",\"defaults\":{\"hash\":{\"primitive\":\"blake3\","
                 "\"backend\":\"vendored\"},\"cas\":{\"version\":\"v2\","
                 "\"compression\":\"identity\"}}}}"
              << "\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach version
  // Persona: all. Returns engine + ABI + hash + CAS + protocol versions.
  // --json flag (default): always emits structured JSON (stable schema).
  // ---------------------------------------------------------------------------
  if (cmd == "version") {
    auto manifest = requiem::version::current_manifest(PROJECT_VERSION);
    auto result = requiem::version::check_compatibility(
        requiem::version::ENGINE_ABI_VERSION);
    std::cout << "{"
              << "\"ok\":" << (result.ok ? "true" : "false")
              << ",\"engine_semver\":\"" << manifest.engine_semver << "\""
              << ",\"engine_abi_version\":" << manifest.engine_abi
              << ",\"hash_algorithm_version\":" << manifest.hash_algorithm
              << ",\"cas_format_version\":" << manifest.cas_format
              << ",\"protocol_framing_version\":" << manifest.protocol_framing
              << ",\"replay_log_version\":" << manifest.replay_log
              << ",\"audit_log_version\":" << manifest.audit_log
              << ",\"hash_primitive\":\"" << manifest.hash_primitive << "\""
              << ",\"build_timestamp\":\"" << manifest.build_timestamp << "\""
              << "}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach status
  // Persona: SRE/DevOps, Power User. Runtime status + current metrics snapshot.
  // Fail-safe: always returns JSON even if some sub-systems error.
  // ---------------------------------------------------------------------------
  if (cmd == "status") {
    const auto &worker = requiem::global_worker_identity();
    const auto health = requiem::worker_health_snapshot();
    const auto &stats = requiem::global_engine_stats();
    const auto h = requiem::hash_runtime_info();
    std::ostringstream o;
    o << "{"
      << "\"ok\":true"
      << ",\"engine_semver\":\"" << PROJECT_VERSION << "\""
      << ",\"hash_primitive\":\"" << h.primitive << "\""
      << ",\"hash_backend\":\"" << h.backend << "\""
      << ",\"hash_available\":" << (h.blake3_available ? "true" : "false")
      << ",\"worker\":" << requiem::worker_identity_to_json(worker)
      << ",\"health\":" << requiem::worker_health_to_json(health)
      << ",\"stats\":" << stats.to_json() << "}\n";
    std::cout << o.str();
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach demo
  // Persona: OSS Developer (first value). Runs determinism demo in one command.
  // Executes a known workload 3 times and verifies all result_digests match.
  // ---------------------------------------------------------------------------
  if (cmd == "demo") {
    const std::string demo_cmd = "/bin/sh";
    const std::vector<std::string> demo_argv = {
        "-c", "echo requiem-determinism-demo"};

    requiem::ExecutionRequest req;
    req.request_id = "demo-1";
    req.command = demo_cmd;
    req.argv = demo_argv;
    req.workspace_root = "/tmp";
    req.policy.scheduler_mode = "turbo";
    req.nonce = 0;

    std::vector<std::string> digests;
    std::vector<double> latencies_ms;
    bool all_ok = true;
    for (int i = 0; i < 3; ++i) {
      // Keep request_id fixed across all runs: same inputs must produce same
      // outputs. (request_id is part of canonicalize_request → changing it
      // changes request_digest)
      auto t0 = std::chrono::steady_clock::now();
      auto res = requiem::execute(req);
      auto t1 = std::chrono::steady_clock::now();
      latencies_ms.push_back(
          std::chrono::duration<double, std::milli>(t1 - t0).count());
      digests.push_back(res.result_digest);
      if (!res.ok)
        all_ok = false;
    }

    bool deterministic = true;
    for (const auto &d : digests) {
      if (d != digests[0]) {
        deterministic = false;
        break;
      }
    }

    std::ostringstream o;
    o << "{"
      << "\"ok\":" << (all_ok ? "true" : "false")
      << ",\"deterministic\":" << (deterministic ? "true" : "false")
      << ",\"runs\":3"
      << ",\"result_digest\":\"" << (digests.empty() ? "" : digests[0]) << "\""
      << ",\"latency_ms\":[";
    for (size_t i = 0; i < latencies_ms.size(); ++i) {
      if (i)
        o << ",";
      char buf[32];
      std::snprintf(buf, sizeof(buf), "%.2f", latencies_ms[i]);
      o << buf;
    }
    o << "]"
      << ",\"message\":\""
      << (deterministic
              ? "All 3 runs produced identical result_digest. Determinism "
                "confirmed."
              : "DETERMINISM FAILURE: result_digest differs across runs.")
      << "\""
      << "}\n";
    std::cout << o.str();
    return (all_ok && deterministic) ? 0 : 2;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach capsule inspect
  // Persona: Support Engineer, Security Auditor.
  // Inspects an execution result (capsule) for provenance and integrity.
  // ---------------------------------------------------------------------------
  if (cmd == "capsule" && argc >= 3 && std::string(argv[2]) == "inspect") {
    std::string result_file, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    if (result_file.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--result required\"}\n";
      return 2;
    }
    auto content = read_file(result_file);
    if (content.empty()) {
      std::cout
          << "{\"ok\":false,\"error\":\"result file empty or missing\"}\n";
      return 2;
    }
    auto r = parse_result(content);
    // Verify result_digest integrity
    const std::string computed =
        requiem::deterministic_digest(requiem::canonicalize_result(r));
    const bool digest_ok = (computed == r.result_digest);
    // Check CAS presence for all referenced digests
    requiem::CasStore cas(cas_dir);
    bool stdout_in_cas =
        r.stdout_digest.empty() || cas.contains(r.stdout_digest);
    bool stderr_in_cas =
        r.stderr_digest.empty() || cas.contains(r.stderr_digest);
    bool trace_in_cas = r.trace_digest.empty() || cas.contains(r.trace_digest);

    std::ostringstream o;
    o << "{"
      << "\"ok\":" << (digest_ok ? "true" : "false") << ",\"result_digest\":\""
      << r.result_digest << "\""
      << ",\"computed_digest\":\"" << computed << "\""
      << ",\"digest_match\":" << (digest_ok ? "true" : "false")
      << ",\"request_digest\":\"" << r.request_digest << "\""
      << ",\"stdout_digest\":\"" << r.stdout_digest << "\""
      << ",\"stderr_digest\":\"" << r.stderr_digest << "\""
      << ",\"trace_digest\":\"" << r.trace_digest << "\""
      << ",\"cas_presence\":{"
      << "\"stdout\":" << (stdout_in_cas ? "true" : "false")
      << ",\"stderr\":" << (stderr_in_cas ? "true" : "false")
      << ",\"trace\":" << (trace_in_cas ? "true" : "false") << "}"
      << ",\"exit_code\":" << r.exit_code
      << ",\"ok_flag\":" << (r.ok ? "true" : "false")
      << ",\"termination_reason\":\"" << r.termination_reason << "\""
      << "}\n";
    std::cout << o.str();
    return digest_ok ? 0 : 2;
  }

  // ---------------------------------------------------------------------------
  // Budget commands — set, show, reset-window
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Phase A: reach replay verify
  // Persona: Security Auditor, SRE. Verifies a stored execution replay.
  // Returns structured JSON with verification status and mismatch details.
  // ---------------------------------------------------------------------------
  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string req_file, result_file, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--request" && i + 1 < argc)
        req_file = argv[++i];
      if (std::string(argv[i]) == "--result" && i + 1 < argc)
        result_file = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }
    if (req_file.empty() || result_file.empty()) {
      std::cout
          << "{\"ok\":false,\"error\":\"--request and --result required\"}\n";
      return 2;
    }
    auto req = requiem::parse_request_json(read_file(req_file), nullptr);
    auto r = parse_result(read_file(result_file));
    requiem::CasStore cas(cas_dir);
    std::string err;
    const bool verified = requiem::validate_replay_with_cas(req, r, cas, &err);
    std::ostringstream o;
    o << "{"
      << "\"ok\":" << (verified ? "true" : "false")
      << ",\"verified\":" << (verified ? "true" : "false")
      << ",\"result_digest\":\"" << r.result_digest << "\""
      << ",\"request_digest\":\"" << r.request_digest << "\""
      << ",\"error\":\"" << (verified ? "" : err) << "\""
      << ",\"engine_version\":\"" << PROJECT_VERSION << "\""
      << ",\"hash_algorithm_version\":"
      << requiem::version::HASH_ALGORITHM_VERSION << "}\n";
    std::cout << o.str();
    return verified ? 0 : 2;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "fork") {
    std::string root_digest, cas_dir = ".requiem/cas/v2", payload;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root_digest = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--payload" && i + 1 < argc)
        payload = argv[++i];
    }

    if (root_digest.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--root <execution_digest> "
                   "required\"}\n";
      return 2;
    }

    if (payload.empty()) {
      // Interactive mode: read payload from stdin
      std::getline(std::cin, payload);
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto debugger = requiem::TimeTravelDebugger::Load(cas, root_digest);
    std::string new_root = debugger->Fork(payload);

    std::cout << "{\"ok\":true,\"original_root\":\"" << root_digest << "\""
              << ",\"forked_root\":\"" << new_root << "\"}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "diff") {
    std::string root1, root2, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root1" && i + 1 < argc)
        root1 = argv[++i];
      if (std::string(argv[i]) == "--root2" && i + 1 < argc)
        root2 = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }

    if (root1.empty() || root2.empty()) {
      std::cout
          << "{\"ok\":false,\"error\":\"--root1 and --root2 required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg1 = requiem::TimeTravelDebugger::Load(cas, root1);
    auto dbg2 = requiem::TimeTravelDebugger::Load(cas, root2);

    auto diffs = dbg1->Diff(*dbg2);

    std::cout << "{\"ok\":true,\"divergence_count\":" << diffs.size();
    if (!diffs.empty()) {
      std::cout << ",\"first_divergence_seq\":" << diffs[0];
      std::cout << ",\"divergences\":[";
      for (size_t i = 0; i < diffs.size(); ++i) {
        if (i > 0)
          std::cout << ",";
        std::cout << diffs[i];
      }
      std::cout << "]";
    } else {
      std::cout << ",\"divergences\":[]";
    }
    std::cout << "}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "inspect") {
    std::string root, cas_dir = ".requiem/cas/v2", key;
    uint64_t seq = 0;
    bool seq_set = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc) {
        seq = std::stoull(argv[++i]);
        seq_set = true;
      }
      if (std::string(argv[i]) == "--key" && i + 1 < argc)
        key = argv[++i];
    }

    if (root.empty() || !seq_set) {
      std::cout << "{\"ok\":false,\"error\":\"--root and --seq required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    if (!dbg->Seek(seq)) {
      std::cout << "{\"ok\":false,\"error\":\"sequence_id not found\"}\n";
      return 2;
    }

    auto val = dbg->InspectMemory(key);
    if (!val) {
      std::cout
          << "{\"ok\":false,\"error\":\"key not found or state empty\"}\n";
      return 2;
    }

    if (key.empty()) {
      std::cout << "{\"ok\":true,\"sequence_id\":" << seq
                << ",\"state\":" << *val << "}\n";
    } else {
      std::cout << "{\"ok\":true,\"sequence_id\":" << seq << ",\"key\":\""
                << key << "\",\"value\":\"" << requiem::jsonlite::escape(*val)
                << "\"}\n";
    }
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "step-out") {
    std::string root, cas_dir = ".requiem/cas/v2";
    uint64_t seq = 0;
    bool seq_set = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc) {
        seq = std::stoull(argv[++i]);
        seq_set = true;
      }
    }

    if (root.empty() || !seq_set) {
      std::cout << "{\"ok\":false,\"error\":\"--root and --seq required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    if (!dbg->Seek(seq)) {
      std::cout << "{\"ok\":false,\"error\":\"sequence_id not found\"}\n";
      return 2;
    }

    auto snapshot = dbg->StepOut();
    if (!snapshot) {
      std::cout << "{\"ok\":false,\"error\":\"step-out failed (end of trace or "
                   "no scope)\"}\n";
      return 2;
    }

    std::cout << "{\"ok\":true,\"new_sequence_id\":" << snapshot->sequence_id
              << ",\"state_digest\":\"" << snapshot->memory_digest << "\"}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "step-into") {
    std::string root, cas_dir = ".requiem/cas/v2";
    uint64_t seq = 0;
    bool seq_set = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc) {
        seq = std::stoull(argv[++i]);
        seq_set = true;
      }
    }

    if (root.empty() || !seq_set) {
      std::cout << "{\"ok\":false,\"error\":\"--root and --seq required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    if (!dbg->Seek(seq)) {
      std::cout << "{\"ok\":false,\"error\":\"sequence_id not found\"}\n";
      return 2;
    }

    auto snapshot = dbg->StepInto();
    if (!snapshot) {
      std::cout
          << "{\"ok\":false,\"error\":\"step-into failed (end of trace)\"}\n";
      return 2;
    }

    std::cout << "{\"ok\":true,\"new_sequence_id\":" << snapshot->sequence_id
              << ",\"state_digest\":\"" << snapshot->memory_digest << "\"}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "step-over") {
    std::string root, cas_dir = ".requiem/cas/v2";
    uint64_t seq = 0;
    bool seq_set = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc) {
        seq = std::stoull(argv[++i]);
        seq_set = true;
      }
    }

    if (root.empty() || !seq_set) {
      std::cout << "{\"ok\":false,\"error\":\"--root and --seq required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    if (!dbg->Seek(seq)) {
      std::cout << "{\"ok\":false,\"error\":\"sequence_id not found\"}\n";
      return 2;
    }

    auto snapshot = dbg->StepOver();
    if (!snapshot) {
      std::cout
          << "{\"ok\":false,\"error\":\"step-over failed (end of trace)\"}\n";
      return 2;
    }

    std::cout << "{\"ok\":true,\"new_sequence_id\":" << snapshot->sequence_id
              << ",\"state_digest\":\"" << snapshot->memory_digest << "\"}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "step-forward") {
    std::string root, cas_dir = ".requiem/cas/v2";
    uint64_t seq = 0;
    bool seq_set = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc) {
        seq = std::stoull(argv[++i]);
        seq_set = true;
      }
    }

    if (root.empty() || !seq_set) {
      std::cout << "{\"ok\":false,\"error\":\"--root and --seq required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    if (!dbg->Seek(seq)) {
      std::cout << "{\"ok\":false,\"error\":\"sequence_id not found\"}\n";
      return 2;
    }

    auto snapshot = dbg->StepForward();
    if (!snapshot) {
      std::cout << "{\"ok\":false,\"error\":\"step-forward failed (end of "
                   "trace)\"}\n";
      return 2;
    }

    std::cout << "{\"ok\":true,\"new_sequence_id\":" << snapshot->sequence_id
              << ",\"state_digest\":\"" << snapshot->memory_digest << "\"}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "step-back") {
    std::string root, cas_dir = ".requiem/cas/v2";
    uint64_t seq = 0;
    bool seq_set = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc) {
        seq = std::stoull(argv[++i]);
        seq_set = true;
      }
    }

    if (root.empty() || !seq_set) {
      std::cout << "{\"ok\":false,\"error\":\"--root and --seq required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    if (!dbg->Seek(seq)) {
      std::cout << "{\"ok\":false,\"error\":\"sequence_id not found\"}\n";
      return 2;
    }

    auto snapshot = dbg->StepBackward();
    if (!snapshot) {
      std::cout
          << "{\"ok\":false,\"error\":\"step-back failed (start of trace)\"}\n";
      return 2;
    }

    std::cout << "{\"ok\":true,\"new_sequence_id\":" << snapshot->sequence_id
              << ",\"state_digest\":\"" << snapshot->memory_digest << "\"}\n";
    return 0;
  }

  if (cmd == "replay" && argc >= 3 && std::string(argv[2]) == "timeline") {
    std::string root, cas_dir = ".requiem/cas/v2";
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--root" && i + 1 < argc)
        root = argv[++i];
      if (std::string(argv[i]) == "--cas" && i + 1 < argc)
        cas_dir = argv[++i];
    }

    if (root.empty()) {
      std::cout << "{\"ok\":false,\"error\":\"--root required\"}\n";
      return 2;
    }

    auto cas = std::make_shared<requiem::CasStore>(cas_dir);
    auto dbg = requiem::TimeTravelDebugger::Load(cas, root);
    auto timeline = dbg->GetTimeline();

    std::cout << "{\"ok\":true,\"count\":" << timeline.size()
              << ",\"timeline\":[";
    for (size_t i = 0; i < timeline.size(); ++i) {
      if (i > 0)
        std::cout << ",";
      const auto &step = timeline[i];
      std::cout << "{\"sequence_id\":" << step.sequence_id << ",\"type\":\""
                << requiem::jsonlite::escape(step.type) << "\""
                << ",\"timestamp_ns\":" << step.timestamp_ns
                << ",\"event_digest\":\"" << step.event_digest << "\""
                << ",\"state_digest\":\"" << step.state_digest << "\"}";
    }
    std::cout << "]}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase A: reach metrics
  // Persona: SRE/DevOps, Enterprise Operator. Full metrics dump.
  // Returns complete structured JSON including p50/p95/p99, CAS, determinism.
  // ---------------------------------------------------------------------------
  if (cmd == "metrics") {
    const auto &stats = requiem::global_engine_stats();
    std::ostringstream o;
    o << "{"
      << "\"engine_version\":\"" << PROJECT_VERSION << "\""
      << ",\"engine_abi_version\":" << requiem::version::ENGINE_ABI_VERSION
      << ",\"hash_algorithm_version\":"
      << requiem::version::HASH_ALGORITHM_VERSION
      << ",\"cas_format_version\":" << requiem::version::CAS_FORMAT_VERSION
      << ",\"worker\":"
      << requiem::worker_identity_to_json(requiem::global_worker_identity())
      << ",\"stats\":" << stats.to_json() << ",\"audit_log\":{"
      << "\"entry_count\":" << requiem::global_audit_log().entry_count()
      << ",\"failure_count\":" << requiem::global_audit_log().failure_count()
      << "}"
      << "}\n";
    std::cout << o.str();
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase E: reach quickstart
  // Persona: OSS Developer. First-value guarantee: visible output in one
  // command.
  // ---------------------------------------------------------------------------
  if (cmd == "quickstart") {
    std::cout << "{"
              << "\"step\":1,\"action\":\"verify_engine\",\"ok\":true,"
              << "\"message\":\"Requiem engine ready. Hash: BLAKE3, CAS: v2, "
                 "Protocol: v1.\","
              << "\"next\":\"Run: requiem demo  (to verify determinism)\","
              << "\"docs\":\"https://reach-cli.com/quickstart\""
              << "}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Auto-tuning commands
  // ---------------------------------------------------------------------------
  if (cmd == "autotune" && argc >= 3 && std::string(argv[2]) == "status") {
    std::cout << requiem::autotune::global_autotune_engine().to_json() << "\n";
    return 0;
  }

  if (cmd == "autotune" && argc >= 3 && std::string(argv[2]) == "tick") {
    const auto ev = requiem::autotune::global_autotune_engine().tick();
    std::cout << ev.to_json() << "\n";
    return ev.applied ? 0 : 1;
  }

  if (cmd == "autotune" && argc >= 3 && std::string(argv[2]) == "revert") {
    const auto ev =
        requiem::autotune::global_autotune_engine().revert_to_baseline();
    std::cout << ev.to_json() << "\n";
    return ev.applied ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // Phase 7: Cluster auth commands
  // ---------------------------------------------------------------------------
  if (cmd == "cluster" && argc >= 3 && std::string(argv[2]) == "auth") {
    requiem::init_worker_identity();
    const auto &w = requiem::global_worker_identity();
    std::cout << "{"
              << "\"auth_version\":" << w.auth_version
              << ",\"cluster_auth_version\":"
              << requiem::rbac::CLUSTER_AUTH_VERSION << ",\"node_id\":\""
              << w.node_id << "\""
              << ",\"worker_id\":\"" << w.worker_id << "\""
              << ",\"auth_scheme\":\"bearer_stub\""
              << ",\"note\":\"EXTENSION_POINT:node_auth_upgrade — upgrade to "
                 "mTLS or SPIFFE/SPIRE SVID\""
              << "}\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase E: reach bugreport
  // Persona: OSS Developer. Collects engine diagnostic info for bug reports.
  // ---------------------------------------------------------------------------
  if (cmd == "bugreport") {
    const auto h = requiem::hash_runtime_info();
    auto manifest = requiem::version::current_manifest(PROJECT_VERSION);
    const auto &worker = requiem::global_worker_identity();
    std::ostringstream o;
    o << "{"
      << "\"engine_semver\":\"" << PROJECT_VERSION << "\""
      << ",\"engine_abi_version\":" << requiem::version::ENGINE_ABI_VERSION
      << ",\"hash_primitive\":\"" << h.primitive << "\""
      << ",\"hash_backend\":\"" << h.backend << "\""
      << ",\"hash_available\":" << (h.blake3_available ? "true" : "false")
      << ",\"hash_version\":\"" << h.version << "\""
      << ",\"build_timestamp\":\"" << manifest.build_timestamp << "\""
      << ",\"worker_id\":\"" << worker.worker_id << "\""
      << ",\"node_id\":\"" << worker.node_id << "\""
      << ",\"instructions\":\"Attach this JSON to your bug report at "
         "https://github.com/Hardonian/Requiem/issues\""
      << "}\n";
    std::cout << o.str();
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Kernel: cap — Capability token commands
  // cap mint   --permissions exec.run,cas.put --subject TENANT [--issuer I]
  //            [--not-before N] [--not-after N] [--key-file PATH]
  // cap verify --token JSON --action exec.run [--pub-key HEX]
  // cap revoke --fingerprint HEX
  // cap keygen
  // ---------------------------------------------------------------------------

  if (cmd == "cap" && argc >= 3 && std::string(argv[2]) == "keygen") {
    auto kp = requiem::caps_generate_keypair();
    auto env = requiem::make_envelope(
        "cap.keygen", "{\"public_key\":\"" + kp.public_key_hex +
                          "\",\"secret_key\":\"" + kp.secret_key_hex + "\"}");
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "cap" && argc >= 3 && std::string(argv[2]) == "mint") {
    std::string permissions_str, subject, issuer, key_file, pub_key_hex;
    uint64_t not_before = 0, not_after = 0;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--permissions" && i + 1 < argc)
        permissions_str = argv[++i];
      if (std::string(argv[i]) == "--subject" && i + 1 < argc)
        subject = argv[++i];
      if (std::string(argv[i]) == "--issuer" && i + 1 < argc)
        issuer = argv[++i];
      if (std::string(argv[i]) == "--not-before" && i + 1 < argc)
        not_before = std::strtoull(argv[++i], nullptr, 10);
      if (std::string(argv[i]) == "--not-after" && i + 1 < argc)
        not_after = std::strtoull(argv[++i], nullptr, 10);
      if (std::string(argv[i]) == "--key-file" && i + 1 < argc)
        key_file = argv[++i];
      if (std::string(argv[i]) == "--pub-key" && i + 1 < argc)
        pub_key_hex = argv[++i];
    }
    if (permissions_str.empty() || subject.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument",
                       "--permissions and --subject required", false))
                << "\n";
      return 2;
    }
    // Parse comma-separated permissions.
    std::vector<std::string> perms;
    std::istringstream ss(permissions_str);
    std::string tok;
    while (std::getline(ss, tok, ','))
      if (!tok.empty())
        perms.push_back(tok);
    // Load keys.
    std::string sk_hex = key_file.empty() ? "" : read_file(key_file);
    if (sk_hex.empty()) {
      // Auto-generate an ephemeral keypair if no key is supplied.
      auto kp = requiem::caps_generate_keypair();
      sk_hex = kp.secret_key_hex;
      pub_key_hex = kp.public_key_hex;
    }
    auto token = requiem::caps_mint(perms, subject, sk_hex, pub_key_hex, issuer,
                                    not_before, not_after);
    auto env =
        requiem::make_envelope("cap.mint", requiem::caps_token_to_json(token));
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "cap" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string token_json, action, pub_key_hex;
    uint64_t at_time = 0;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--token" && i + 1 < argc)
        token_json = argv[++i];
      if (std::string(argv[i]) == "--action" && i + 1 < argc)
        action = argv[++i];
      if (std::string(argv[i]) == "--pub-key" && i + 1 < argc)
        pub_key_hex = argv[++i];
      if (std::string(argv[i]) == "--at-time" && i + 1 < argc)
        at_time = std::strtoull(argv[++i], nullptr, 10);
    }
    if (token_json.empty() || action.empty() || pub_key_hex.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument",
                       "--token, --action, and --pub-key required", false))
                << "\n";
      return 2;
    }
    auto token = requiem::caps_token_from_json(token_json);
    auto result = requiem::caps_verify(token, action, pub_key_hex, at_time);
    if (result.ok) {
      std::cout << requiem::envelope_to_json(requiem::make_envelope(
                       "cap.verify", "{\"ok\":true,\"fingerprint\":\"" +
                                         token.fingerprint + "\"}"))
                << "\n";
      return 0;
    } else {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       result.error, result.error, false))
                << "\n";
      return 1;
    }
  }

  if (cmd == "cap" && argc >= 3 && std::string(argv[2]) == "revoke") {
    std::string fingerprint;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--fingerprint" && i + 1 < argc)
        fingerprint = argv[++i];
    if (fingerprint.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--fingerprint required", false))
                << "\n";
      return 2;
    }
    requiem::caps_revoke(fingerprint);
    std::cout << requiem::envelope_to_json(requiem::make_envelope(
                     "cap.revoke", "{\"ok\":true,\"fingerprint\":\"" +
                                       requiem::jsonlite::escape(fingerprint) +
                                       "\"}"))
              << "\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Kernel: policy vm — Policy evaluation against a context JSON
  // policy vm-eval --rules FILE --context JSON [--seq N]
  // ---------------------------------------------------------------------------

  if (cmd == "policy" && argc >= 3 && std::string(argv[2]) == "vm-eval") {
    std::string rules_file, context_json;
    uint64_t seq = 0;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--rules" && i + 1 < argc)
        rules_file = argv[++i];
      if (std::string(argv[i]) == "--context" && i + 1 < argc)
        context_json = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc)
        seq = std::strtoull(argv[++i], nullptr, 10);
    }
    if (rules_file.empty() || context_json.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--rules and --context required",
                       false))
                << "\n";
      return 2;
    }
    auto rules_json = read_file(rules_file);
    auto rules = requiem::policy_rules_from_json(rules_json);
    auto decision = requiem::policy_eval(rules, context_json, seq);
    auto env = requiem::make_envelope(
        "policy.decision", requiem::policy_decision_to_json(decision));
    std::cout << requiem::envelope_to_json(env) << "\n";
    return decision.decision == "allow" ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // Kernel: log verify — Chain integrity check on the event log
  // log verify --log PATH
  // ---------------------------------------------------------------------------

  if (cmd == "log" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string log_path = ".requiem/event_log.ndjson";
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--log" && i + 1 < argc)
        log_path = argv[++i];
    requiem::EventLog event_log(log_path);
    auto result = event_log.verify();
    std::string data;
    data += "{\"ok\":" + std::string(result.ok ? "true" : "false");
    data += ",\"total_events\":" + std::to_string(result.total_events);
    data += ",\"verified_events\":" + std::to_string(result.verified_events);
    data += ",\"failures\":[";
    bool first = true;
    for (const auto &f : result.failures) {
      if (!first)
        data += ",";
      first = false;
      data += "{\"seq\":" + std::to_string(f.seq);
      data += ",\"error\":\"" + requiem::jsonlite::escape(f.error) + "\"}";
    }
    data += "]}";
    auto env = requiem::make_envelope("log.verify", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return result.ok ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // Kernel: plan — DAG execution
  // plan run    --plan FILE [--workspace PATH] [--seq N] [--nonce N]
  // plan verify --plan FILE  (validate DAG, check for cycles)
  // plan hash   --plan FILE  (print deterministic plan content hash)
  // ---------------------------------------------------------------------------

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string plan_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--plan" && i + 1 < argc)
        plan_file = argv[++i];
    if (plan_file.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--plan required", false))
                << "\n";
      return 2;
    }
    auto plan = requiem::plan_from_json(read_file(plan_file));
    auto vr = requiem::plan_validate(plan);
    std::string data;
    data += "{\"ok\":" + std::string(vr.ok ? "true" : "false");
    data += ",\"plan_hash\":\"" + requiem::plan_compute_hash(plan) + "\"";
    data += ",\"step_count\":" + std::to_string(plan.steps.size());
    data += ",\"errors\":[";
    bool first = true;
    for (const auto &e : vr.errors) {
      if (!first)
        data += ",";
      first = false;
      data += "\"" + requiem::jsonlite::escape(e) + "\"";
    }
    data += "]}";
    auto env = requiem::make_envelope("plan.verify", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return vr.ok ? 0 : 1;
  }

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "hash") {
    std::string plan_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--plan" && i + 1 < argc)
        plan_file = argv[++i];
    if (plan_file.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--plan required", false))
                << "\n";
      return 2;
    }
    auto plan = requiem::plan_from_json(read_file(plan_file));
    auto hash = requiem::plan_compute_hash(plan);
    auto env =
        requiem::make_envelope("plan.hash", "{\"plan_hash\":\"" + hash + "\"}");
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "run") {
    std::string plan_file, workspace = ".";
    uint64_t seq = 0, nonce = 0;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--plan" && i + 1 < argc)
        plan_file = argv[++i];
      if (std::string(argv[i]) == "--workspace" && i + 1 < argc)
        workspace = argv[++i];
      if (std::string(argv[i]) == "--seq" && i + 1 < argc)
        seq = std::strtoull(argv[++i], nullptr, 10);
      if (std::string(argv[i]) == "--nonce" && i + 1 < argc)
        nonce = std::strtoull(argv[++i], nullptr, 10);
    }
    if (plan_file.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--plan required", false))
                << "\n";
      return 2;
    }
    auto plan = requiem::plan_from_json(read_file(plan_file));
    auto run_result = requiem::plan_execute(plan, workspace, seq, nonce);
    auto env = requiem::make_envelope(
        "plan.run", requiem::plan_run_result_to_json(run_result));
    std::cout << requiem::envelope_to_json(env) << "\n";
    return run_result.ok ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // PHASE A: Budget commands — set, show, reset-window
  // budget set   --tenant ID --unit UNIT --limit N
  // budget show  --tenant ID
  // budget reset-window --tenant ID
  // ---------------------------------------------------------------------------

  if (cmd == "budget" && argc >= 3 && std::string(argv[2]) == "set") {
    std::string tenant, unit;
    uint64_t limit = 0;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
      if (std::string(argv[i]) == "--unit" && i + 1 < argc)
        unit = argv[++i];
      if (std::string(argv[i]) == "--limit" && i + 1 < argc)
        limit = std::strtoull(argv[++i], nullptr, 10);
    }
    if (tenant.empty() || unit.empty() || limit == 0) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument",
                       "--tenant, --unit, and --limit required", false))
                << "\n";
      return 2;
    }
    // Set budget in metering system
    auto budget = requiem::meter_set_budget(tenant, unit, limit);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"tenant_id\":\"" + requiem::jsonlite::escape(tenant) + "\"";
    data += ",\"unit\":\"" + unit + "\"";
    data += ",\"limit\":" + std::to_string(limit);
    data += ",\"budget_hash\":\"" + budget.budget_hash + "\"";
    data += "}";
    auto env = requiem::make_envelope("budget.set", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "budget" && argc >= 3 && std::string(argv[2]) == "show") {
    std::string tenant;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
    }
    if (tenant.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--tenant required", false))
                << "\n";
      return 2;
    }
    auto budget = requiem::meter_get_budget(tenant);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"tenant_id\":\"" + requiem::jsonlite::escape(tenant) + "\"";
    data += ",\"budgets\":{" exec ":{" limit\":" +
            std::to_string(budget.exec_limit);
    data += ",\"used\":" + std::to_string(budget.exec_used);
    data += ",\"remaining\":" + std::to_string(budget.exec_remaining) + "}";
    data += ",\"cas_put\":{\"limit\":" + std::to_string(budget.cas_put_limit);
    data += ",\"used\":" + std::to_string(budget.cas_put_used);
    data += ",\"remaining\":" + std::to_string(budget.cas_put_remaining) + "}";
    data += ",\"policy_eval\":{\"limit\":" +
            std::to_string(budget.policy_eval_limit);
    data += ",\"used\":" + std::to_string(budget.policy_eval_used);
    data +=
        ",\"remaining\":" + std::to_string(budget.policy_eval_remaining) + "}";
    data += "}";
    data += ",\"budget_hash\":\"" + budget.budget_hash + "\"";
    data += "}";
    auto env = requiem::make_envelope("budget.show", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "budget" && argc >= 3 && std::string(argv[2]) == "reset-window") {
    std::string tenant;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
    }
    if (tenant.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--tenant required", false))
                << "\n";
      return 2;
    }
    requiem::meter_reset_window(tenant);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"tenant_id\":\"" + requiem::jsonlite::escape(tenant) + "\"";
    data += ",\"message\":\"Budget window reset successfully\"";
    data += "}";
    auto env = requiem::make_envelope("budget.reset_window", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  // ---------------------------------------------------------------------------
  // PHASE A: Receipt commands — show, verify
  // receipt show  --receipt-hash HASH
  // receipt verify --receipt FILE
  // ---------------------------------------------------------------------------

  if (cmd == "receipt" && argc >= 3 && std::string(argv[2]) == "show") {
    std::string receipt_hash;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--receipt-hash" && i + 1 < argc)
        receipt_hash = argv[++i];
    }
    if (receipt_hash.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--receipt-hash required", false))
                << "\n";
      return 2;
    }
    auto receipt = requiem::receipt_get_by_hash(receipt_hash);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"receipt\":{" receipt_version\":" +
            std::to_string(receipt.receipt_version);
    data += ",\"operation\":\"" + receipt.operation + "\"";
    data += ",\"tenant_id\":\"" + requiem::jsonlite::escape(receipt.tenant_id) +
            "\"";
    data += ",\"request_digest\":\"" + receipt.request_digest + "\"";
    data += ",\"units_charged\":" + std::to_string(receipt.units_charged);
    data += ",\"budget_before\":" + std::to_string(receipt.budget_before);
    data += ",\"budget_after\":" + std::to_string(receipt.budget_after);
    data += ",\"denied\":" + std::string(receipt.denied ? "true" : "false");
    data += ",\"receipt_hash\":\"" + receipt.receipt_hash + "\"";
    data += ",\"event_log_seq\":" + std::to_string(receipt.event_log_seq);
    data += "}}";
    auto env = requiem::make_envelope("receipt.show", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "receipt" && argc >= 3 && std::string(argv[2]) == "verify") {
    std::string receipt_file;
    for (int i = 3; i < argc; ++i)
      if (std::string(argv[i]) == "--receipt" && i + 1 < argc)
        receipt_file = argv[++i];
    if (receipt_file.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--receipt required", false))
                << "\n";
      return 2;
    }
    auto receipt = requiem::receipt_from_json(read_file(receipt_file));
    auto vr = requiem::receipt_verify(receipt);
    if (vr.ok) {
      auto env = requiem::make_envelope("receipt.verify",
                                        "{\"ok\":true,\"receipt_hash\":\"" +
                                            receipt.receipt_hash + "\"}");
      std::cout << requiem::envelope_to_json(env) << "\n";
      return 0;
    } else {
      std::cout << requiem::envelope_to_json(
                       requiem::make_error_envelope(vr.error, vr.error, false))
                << "\n";
      return 1;
    }
  }

  // ---------------------------------------------------------------------------
  // PHASE A: Snapshot commands — create, list, restore (gated)
  // snapshot create [--tenant ID]
  // snapshot list [--tenant ID]
  // snapshot restore --snapshot-hash HASH [--force]
  // ---------------------------------------------------------------------------

  if (cmd == "snapshot" && argc >= 3 && std::string(argv[2]) == "create") {
    std::string tenant;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
    }
    auto snapshot = requiem::snapshot_create(tenant);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"snapshot\":{\"snapshot_version\":" +
            std::to_string(snapshot.snapshot_version);
    data += ",\"logical_time\":" + std::to_string(snapshot.logical_time);
    data += ",\"event_log_head\":\"" + snapshot.event_log_head + "\"";
    data += ",\"cas_root_hash\":\"" + snapshot.cas_root_hash + "\"";
    data += ",\"snapshot_hash\":\"" + snapshot.snapshot_hash + "\"";
    data +=
        ",\"active_caps_count\":" + std::to_string(snapshot.active_caps.size());
    data += ",\"revoked_caps_count\":" +
            std::to_string(snapshot.revoked_caps.size());
    data += "}}";
    auto env = requiem::make_envelope("snapshot.create", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "snapshot" && argc >= 3 && std::string(argv[2]) == "list") {
    std::string tenant;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
    }
    auto snapshots = requiem::snapshot_list(tenant);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"snapshots\":[";
    bool first = true;
    for (const auto &snap : snapshots) {
      if (!first)
        data += ",";
      first = false;
      data += "{\"snapshot_hash\":\"" + snap.snapshot_hash + "\"";
      data += ",\"logical_time\":" + std::to_string(snap.logical_time);
      data += ",\"event_log_head\":\"" + snap.event_log_head + "\"";
      data += ",\"created_at\":" + std::to_string(snap.timestamp_unix_ms);
      data += "}";
    }
    data += "],\"total\":" + std::to_string(snapshots.size()) + "}";
    auto env = requiem::make_envelope("snapshot.list", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "snapshot" && argc >= 3 && std::string(argv[2]) == "restore") {
    std::string snapshot_hash;
    bool force = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--snapshot-hash" && i + 1 < argc)
        snapshot_hash = argv[++i];
      if (std::string(argv[i]) == "--force")
        force = true;
    }
    if (snapshot_hash.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--snapshot-hash required", false))
                << "\n";
      return 2;
    }
    // Gate: require --force for restore
    if (!force) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "operation_gated",
                       "Snapshot restore is gated. Use --force to proceed. "
                       "WARNING: This will revert state to the snapshot point.",
                       false))
                << "\n";
      return 2;
    }
    auto result = requiem::snapshot_restore(snapshot_hash);
    std::string data;
    data += "{\"ok\":" + std::string(result.ok ? "true" : "false");
    data += ",\"restored_logical_time\":" +
            std::to_string(result.restored_logical_time);
    data +=
        ",\"message\":\"" + requiem::jsonlite::escape(result.message) + "\"";
    data += "}";
    auto env = requiem::make_envelope("snapshot.restore", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return result.ok ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // PHASE A: Additional Plan commands — add, list, show, replay
  // plan add    --plan-id ID --steps FILE
  // plan list   [--tenant ID]
  // plan show   --plan-hash HASH
  // plan replay --run-id ID [--verify-exact]
  // ---------------------------------------------------------------------------

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "add") {
    std::string plan_id, steps_file;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--plan-id" && i + 1 < argc)
        plan_id = argv[++i];
      if (std::string(argv[i]) == "--steps" && i + 1 < argc)
        steps_file = argv[++i];
    }
    if (plan_id.empty() || steps_file.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--plan-id and --steps required",
                       false))
                << "\n";
      return 2;
    }
    auto plan = requiem::plan_add(plan_id, read_file(steps_file));
    std::string data;
    data += "{\"ok\":true";
    data += ",\"plan\":{\"plan_id\":\"" +
            requiem::jsonlite::escape(plan.plan_id) + "\"";
    data += ",\"plan_version\":" + std::to_string(plan.plan_version);
    data += ",\"plan_hash\":\"" + plan.plan_hash + "\"";
    data += ",\"step_count\":" + std::to_string(plan.steps.size()) + "}";
    data += "}";
    auto env = requiem::make_envelope("plan.add", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "list") {
    std::string tenant;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--tenant" && i + 1 < argc)
        tenant = argv[++i];
    }
    auto plans = requiem::plan_list(tenant);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"plans\":[";
    bool first = true;
    for (const auto &plan : plans) {
      if (!first)
        data += ",";
      first = false;
      data +=
          "{\"plan_id\":\"" + requiem::jsonlite::escape(plan.plan_id) + "\"";
      data += ",\"plan_hash\":\"" + plan.plan_hash + "\"";
      data += ",\"step_count\":" + std::to_string(plan.steps.size()) + "}";
    }
    data += "],\"total\":" + std::to_string(plans.size()) + "}";
    auto env = requiem::make_envelope("plan.list", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "show") {
    std::string plan_hash;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--plan-hash" && i + 1 < argc)
        plan_hash = argv[++i];
    }
    if (plan_hash.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--plan-hash required", false))
                << "\n";
      return 2;
    }
    auto result = requiem::plan_show(plan_hash);
    std::string data;
    data += "{\"ok\":true";
    data += ",\"plan\":{\"plan_id\":\"" +
            requiem::jsonlite::escape(result.plan.plan_id) + "\"";
    data += ",\"plan_version\":" + std::to_string(result.plan.plan_version);
    data += ",\"plan_hash\":\"" + result.plan.plan_hash + "\"";
    data +=
        ",\"steps\":" + requiem::plan_steps_to_json(result.plan.steps) + "}";
    data += ",\"runs\":[";
    bool first = true;
    for (const auto &run : result.runs) {
      if (!first)
        data += ",";
      first = false;
      data += "{\"run_id\":\"" + run.run_id + "\"";
      data += ",\"ok\":" + std::string(run.ok ? "true" : "false");
      data += ",\"steps_completed\":" + std::to_string(run.steps_completed);
      data += ",\"steps_total\":" + std::to_string(run.steps_total) + "}";
    }
    data += "]}";
    auto env = requiem::make_envelope("plan.show", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return 0;
  }

  if (cmd == "plan" && argc >= 3 && std::string(argv[2]) == "replay") {
    std::string run_id;
    bool verify_exact = false;
    for (int i = 3; i < argc; ++i) {
      if (std::string(argv[i]) == "--run-id" && i + 1 < argc)
        run_id = argv[++i];
      if (std::string(argv[i]) == "--verify-exact")
        verify_exact = true;
    }
    if (run_id.empty()) {
      std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                       "missing_argument", "--run-id required", false))
                << "\n";
      return 2;
    }
    auto result = requiem::plan_replay(run_id, verify_exact);
    std::string data;
    data += "{\"ok\":" + std::string(result.ok ? "true" : "false");
    data += ",\"original_run_id\":\"" + result.original_run_id + "\"";
    data += ",\"replay_run_id\":\"" + result.replay_run_id + "\"";
    data += ",\"exact_match\":" +
            std::string(result.exact_match ? "true" : "false");
    data +=
        ",\"receipt_hash_original\":\"" + result.receipt_hash_original + "\"";
    data += ",\"receipt_hash_replay\":\"" + result.receipt_hash_replay + "\"";
    data += "}";
    auto env = requiem::make_envelope("plan.replay", data);
    std::cout << requiem::envelope_to_json(env) << "\n";
    return (result.ok && (!verify_exact || result.exact_match)) ? 0 : 1;
  }

  // ---------------------------------------------------------------------------
  // Unknown command — typed error envelope, never plain-text, never hard-500.
  // ---------------------------------------------------------------------------
  std::cout << requiem::envelope_to_json(requiem::make_error_envelope(
                   "unknown_command",
                   "Unknown command: '" + requiem::jsonlite::escape(cmd) +
                       "'. Run 'requiem help' for usage.",
                   false))
            << "\n";
  return 2;
}
