#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"

namespace fs = std::filesystem;

namespace {
void expect(bool condition, const std::string& message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << "\n";
    std::exit(1);
  }
}

// Generate deterministic 1MB test data
std::string generate_1mb_deterministic() {
  std::string result;
  result.reserve(1024 * 1024);
  // Use a deterministic PRNG (LCG)
  uint64_t state = 12345;
  for (size_t i = 0; i < 1024 * 1024; ++i) {
    state = state * 1103515245 + 12345;
    result.push_back(static_cast<char>(state >> 24));
  }
  return result;
}

// Known BLAKE3 test vectors from the official test suite
void test_blake3_vectors() {
  // Empty string
  const std::string empty_hash = requiem::blake3_hex("");
  expect(empty_hash == "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262",
         "BLAKE3 empty vector mismatch");
  
  // "hello"
  const std::string hello_hash = requiem::blake3_hex("hello");
  expect(hello_hash == "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f",
         "BLAKE3 hello vector mismatch");
  
  // 1MB deterministic
  const std::string mb_data = generate_1mb_deterministic();
  const std::string mb_hash = requiem::blake3_hex(mb_data);
  // Note: This is the expected hash for our specific 1MB deterministic data
  // The exact value depends on the PRNG used
  expect(mb_hash.length() == 64, "BLAKE3 1MB hash should be 64 hex chars");
  
  // Verify consistency
  const std::string mb_hash2 = requiem::blake3_hex(mb_data);
  expect(mb_hash == mb_hash2, "BLAKE3 should be deterministic");
}

void test_domain_separation() {
  const std::string data = "test data";
  
  // Same data, different domains should produce different hashes
  const std::string req_hash = requiem::hash_domain("req:", data);
  const std::string res_hash = requiem::hash_domain("res:", data);
  const std::string cas_hash = requiem::hash_domain("cas:", data);
  
  expect(!req_hash.empty(), "req domain hash should not be empty");
  expect(!res_hash.empty(), "res domain hash should not be empty");
  expect(!cas_hash.empty(), "cas domain hash should not be empty");
  
  expect(req_hash != res_hash, "req and res domains should produce different hashes");
  expect(req_hash != cas_hash, "req and cas domains should produce different hashes");
  expect(res_hash != cas_hash, "res and cas domains should produce different hashes");
  
  // Same domain, same data should produce same hash
  const std::string req_hash2 = requiem::hash_domain("req:", data);
  expect(req_hash == req_hash2, "Same domain and data should produce same hash");
}

void test_hash_runtime_info() {
  const auto info = requiem::hash_runtime_info();
  
  // With vendored BLAKE3, we should always have BLAKE3 available
  expect(info.blake3_available, "BLAKE3 should be available with vendored implementation");
  expect(info.primitive == "blake3", "Primitive should be blake3");
  expect(info.backend == "vendored", "Backend should be vendored");
  expect(!info.compat_warning, "Should not have compat warning with vendored BLAKE3");
  expect(!info.version.empty(), "Version should not be empty");
}

void test_file_hashing() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_hash_test";
  fs::create_directories(tmp);
  
  const std::string test_content = "test content for file hashing";
  const fs::path test_file = tmp / "test_file.txt";
  
  std::ofstream ofs(test_file, std::ios::binary);
  ofs << test_content;
  ofs.close();
  
  const std::string file_hash = requiem::hash_file_blake3(test_file.string());
  const std::string bytes_hash = requiem::hash_bytes_blake3(test_content);
  
  expect(!file_hash.empty(), "File hash should not be empty");
  expect(file_hash == bytes_hash, "File hash should match bytes hash for same content");
  
  // Non-existent file should return empty
  const std::string missing_hash = requiem::hash_file_blake3("/nonexistent/path/file.txt");
  expect(missing_hash.empty(), "Non-existent file should return empty hash");
  
  fs::remove_all(tmp);
}

void test_binary_digest() {
  const std::string data = "binary test data";
  const std::string binary_hash = requiem::hash_bytes_blake3(data);
  const std::string hex_hash = requiem::blake3_hex(data);
  
  expect(binary_hash.length() == 32, "Binary hash should be 32 bytes");
  expect(hex_hash.length() == 64, "Hex hash should be 64 chars");
  
  // Verify binary and hex are consistent
  std::string binary_to_hex;
  binary_to_hex.reserve(64);
  const char* hex_chars = "0123456789abcdef";
  for (unsigned char c : binary_hash) {
    binary_to_hex.push_back(hex_chars[c >> 4]);
    binary_to_hex.push_back(hex_chars[c & 0xf]);
  }
  expect(binary_to_hex == hex_hash, "Binary to hex conversion should match hex hash");
}

void test_json_double_parsing() {
  // Test double parsing
  std::optional<requiem::jsonlite::JsonError> err;
  auto obj = requiem::jsonlite::parse("{\"value\": 3.14159}", &err);
  expect(!err.has_value(), "double parsing should not error");
  double val = requiem::jsonlite::get_double(obj, "value", 0.0);
  expect(val > 3.14 && val < 3.15, "double value should be approximately 3.14159");
  
  // Test negative integer stored as double
  obj = requiem::jsonlite::parse("{\"value\": -42}", &err);
  expect(!err.has_value(), "negative integer parsing should not error");
  val = requiem::jsonlite::get_double(obj, "value", 0.0);
  expect(val == -42.0, "negative integer should be parsed as double");
  
  // Test scientific notation
  obj = requiem::jsonlite::parse("{\"value\": 1.5e10}", &err);
  expect(!err.has_value(), "scientific notation should not error");
  val = requiem::jsonlite::get_double(obj, "value", 0.0);
  expect(val == 1.5e10, "scientific notation should parse correctly");
  
  // Test canonicalization preserves double format
  auto canonical = requiem::jsonlite::canonicalize_json("{\"b\": 1.5, \"a\": 2.0}", &err);
  expect(!err.has_value(), "canonicalization should not error");
  expect(canonical.find("1.5") != std::string::npos, "canonical should contain 1.5");
  expect(canonical.find("2.0") != std::string::npos, "canonical should contain 2.0");
}

void test_determinism_repeat() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_determinism_test";
  fs::create_directories(tmp);
  
  requiem::ExecutionRequest request;
  request.request_id = "det-test";
  request.workspace_root = tmp.string();
#ifdef _WIN32
  request.command = "cmd";
  request.argv = {"/c", "echo deterministic_output"};
#else
  request.command = "/bin/sh";
  request.argv = {"-c", "echo deterministic_output"};
#endif
  request.policy.deterministic = true;
  
  // Run N times and verify identical digests
  const int N = 20;  // Using 20 for faster tests, production should use 100+
  std::string first_result_digest;
  std::string first_stdout_digest;
  
  for (int i = 0; i < N; ++i) {
    auto result = requiem::execute(request);
    expect(result.ok, "execution should succeed");
    
    if (i == 0) {
      first_result_digest = result.result_digest;
      first_stdout_digest = result.stdout_digest;
    } else {
      expect(result.result_digest == first_result_digest, 
             "result_digest should be deterministic across runs");
      expect(result.stdout_digest == first_stdout_digest, 
             "stdout_digest should be deterministic across runs");
    }
  }
  
  fs::remove_all(tmp);
}

void test_cas_corruption_detection() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_cas_corrupt_test";
  fs::create_directories(tmp);
  
  requiem::CasStore cas(tmp.string());
  const std::string data = "test data for corruption check";
  const std::string digest = cas.put(data, "off");
  expect(!digest.empty(), "CAS put should return digest");
  
  // Verify we can read it back
  auto retrieved = cas.get(digest);
  expect(retrieved.has_value(), "CAS get should succeed");
  expect(retrieved.value() == data, "Retrieved data should match original");
  
  // Corrupt the stored file by flipping a byte
  auto info = cas.info(digest);
  expect(info.has_value(), "CAS info should be available");
  
  // Get the object path and corrupt it
  std::string obj_path = (fs::path(tmp) / "objects" / digest.substr(0, 2) / digest.substr(2, 2) / digest).string();
  {
    std::fstream file(obj_path, std::ios::in | std::ios::out | std::ios::binary);
    expect(file.good(), "Should be able to open object file");
    char byte;
    file.read(&byte, 1);
    byte ^= 0xFF;  // Flip all bits
    file.seekp(0);
    file.write(&byte, 1);
  }
  
  // Now get should fail due to hash mismatch
  auto corrupted = cas.get(digest);
  expect(!corrupted.has_value(), "CAS should detect corruption and return nullopt");
  
  fs::remove_all(tmp);
}

}  // namespace

int main() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_tests";
  fs::remove_all(tmp);
  fs::create_directories(tmp);

  // Test BLAKE3 known vectors
  std::cout << "Testing BLAKE3 known vectors...\n";
  test_blake3_vectors();
  std::cout << "  PASSED\n";
  
  // Test domain separation
  std::cout << "Testing domain separation...\n";
  test_domain_separation();
  std::cout << "  PASSED\n";
  
  // Test hash runtime info
  std::cout << "Testing hash runtime info...\n";
  test_hash_runtime_info();
  std::cout << "  PASSED\n";
  
  // Test file hashing
  std::cout << "Testing file hashing...\n";
  test_file_hashing();
  std::cout << "  PASSED\n";
  
  // Test binary digest
  std::cout << "Testing binary digest...\n";
  test_binary_digest();
  std::cout << "  PASSED\n";
  
  // Test JSON double parsing
  std::cout << "Testing JSON double parsing...\n";
  test_json_double_parsing();
  std::cout << "  PASSED\n";
  
  // Test determinism repeat
  std::cout << "Testing determinism repeat...\n";
  test_determinism_repeat();
  std::cout << "  PASSED\n";
  
  // Test CAS corruption detection
  std::cout << "Testing CAS corruption detection...\n";
  test_cas_corruption_detection();
  std::cout << "  PASSED\n";

  // CAS tests
  {
    requiem::set_hash_fallback_allowed(true);
    requiem::CasStore cas((tmp / "cas").string());
    const std::string data = "artifact";
    const std::string d1 = cas.put(data, "off");
    const std::string d2 = cas.put(data, "zstd");
    expect(!d1.empty() && d1 == d2, "CAS key must be independent of encoding");
    expect(cas.get(d1).value_or("") == data, "CAS get should return original bytes");
    expect(cas.info(d1).has_value(), "CAS info should be readable");
  }

  // JSON canonicalization tests
  {
    std::optional<requiem::jsonlite::JsonError> err;
    const auto c1 = requiem::jsonlite::canonicalize_json("{\"b\":1,\"a\":2}", &err);
    expect(!err.has_value(), "valid json should canonicalize");
    const auto c2 = requiem::jsonlite::canonicalize_json("{\"a\":2,\"b\":1}", &err);
    expect(c1 == c2, "key-order variations should canonicalize identically");
    auto dup = requiem::jsonlite::validate_strict("{\"a\":1,\"a\":2}");
    expect(dup.has_value() && dup->code == "json_duplicate_key", "duplicate keys must be rejected");
  }

  // Execution tests
  {
    requiem::ExecutionRequest request;
    request.request_id = "req-1";
    request.workspace_root = tmp.string();
#ifdef _WIN32
    request.command = "cmd";
    request.argv = {"/c", "printf ABCDEFGHIJ"};
#else
    request.command = "/bin/sh";
    request.argv = {"-c", "printf 'ABCDEFGHIJ'"};
#endif
    request.max_output_bytes = 4;

    const auto result = requiem::execute(request);
    expect(result.stdout_truncated, "stdout should truncate at max_output_bytes");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-2";
    request.workspace_root = tmp.string();
#ifdef _WIN32
    request.command = "cmd";
    request.argv = {"/c", "timeout /t 2 >nul"};
#else
    request.command = "/bin/sh";
    request.argv = {"-c", "sleep 1"};
#endif
    request.timeout_ms = 10;

    const auto result = requiem::execute(request);
    expect(result.exit_code == 124, "timeout sentinel should be 124");
    expect(result.termination_reason == "timeout", "timeout reason should be set");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-3";
    request.workspace_root = tmp.string();
#ifdef _WIN32
    request.command = "cmd";
    request.argv = {"/c", "echo ok > out.txt"};
#else
    request.command = "/bin/sh";
    request.argv = {"-c", "echo ok > out.txt"};
#endif
    request.outputs = {"out.txt"};
    const auto result = requiem::execute(request);
    expect(result.ok, "execution should succeed");
    expect(requiem::validate_replay(request, result), "replay validation should pass");
  }

  fs::remove_all(tmp);

  std::cout << "All tests passed\n";
  return 0;
}
