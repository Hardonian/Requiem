#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

#include "requiem/cas.hpp"
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
}  // namespace

int main() {
  const fs::path tmp = fs::temp_directory_path() / "requiem_tests";
  fs::remove_all(tmp);
  fs::create_directories(tmp);

  {
    requiem::CasStore cas((tmp / "cas").string());
    const std::string data = "artifact";
    const std::string d1 = cas.put(data, "off");
    const std::string d2 = cas.put(data, "zstd");
    expect(!d1.empty() && d1 == d2, "CAS key must be independent of encoding");
    expect(cas.get(d1).value_or("") == data, "CAS get should return original bytes");
    expect(cas.info(d1).has_value(), "CAS info should be readable");
  }

  {
    std::optional<requiem::jsonlite::JsonError> err;
    const auto c1 = requiem::jsonlite::canonicalize_json("{\"b\":1,\"a\":2}", &err);
    expect(!err.has_value(), "valid json should canonicalize");
    const auto c2 = requiem::jsonlite::canonicalize_json("{\"a\":2,\"b\":1}", &err);
    expect(c1 == c2, "key-order variations should canonicalize identically");
    auto dup = requiem::jsonlite::validate_strict("{\"a\":1,\"a\":2}");
    expect(dup.has_value() && dup->code == "json_duplicate_key", "duplicate keys must be rejected");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-1";
    request.workspace_root = tmp.string();
    request.command = "/bin/sh";
    request.argv = {"-c", "printf 'ABCDEFGHIJ'"};
    request.max_output_bytes = 4;

    const auto result = requiem::execute(request);
    expect(result.stdout_truncated, "stdout should truncate at max_output_bytes");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-2";
    request.workspace_root = tmp.string();
    request.command = "/bin/sh";
    request.argv = {"-c", "sleep 1"};
    request.timeout_ms = 10;

    const auto result = requiem::execute(request);
    expect(result.exit_code == 124, "timeout sentinel should be 124");
    expect(result.termination_reason == "timeout", "timeout reason should be set");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-3";
    request.workspace_root = tmp.string();
    request.command = "/bin/sh";
    request.argv = {"-c", "echo ok > out.txt"};
    request.outputs = {"out.txt"};
    const auto result = requiem::execute(request);
    expect(result.ok, "execution should succeed");
    expect(requiem::validate_replay(request, result), "replay validation should pass");
  }

  std::cout << "All tests passed\n";
  return 0;
}
