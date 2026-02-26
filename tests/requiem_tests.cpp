#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

#include "requiem/cas.hpp"
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
    const std::string digest1 = cas.put(data);
    const std::string digest2 = cas.put(data);
    expect(!digest1.empty(), "CAS write should succeed");
    expect(digest1 == digest2, "CAS put should be content-addressed");
    expect(cas.size() == 1, "CAS should deduplicate identical writes");
    expect(cas.contains(digest1), "CAS should contain stored digest");
    expect(cas.get(digest1).value_or("") == data, "CAS should return stored object");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-1";
    request.workspace_root = tmp.string();
    request.command = "/bin/sh";
    request.argv = {"-c", "printf 'ABCDEFGHIJ'"};
    request.max_output_bytes = 4;

    const requiem::ExecutionResult result = requiem::execute(request);
    expect(result.stdout_truncated, "stdout should truncate at max_output_bytes");
    expect(result.stdout_text.find("(truncated)") != std::string::npos, "truncation marker should be present");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-2";
    request.workspace_root = tmp.string();
    request.command = "/bin/sh";
    request.argv = {"-c", "sleep 1"};
    request.timeout_ms = 10;

    const requiem::ExecutionResult result = requiem::execute(request);
    expect(result.exit_code == 124, "timeout exit code sentinel should be 124");
    expect(result.termination_reason == "timeout", "timeout termination reason should be set");
  }

  {
    requiem::ExecutionRequest request;
    request.request_id = "req-3";
    request.workspace_root = tmp.string();
    request.command = "/bin/sh";
    request.argv = {"-c", "echo ok > out.txt"};
    request.outputs = {"out.txt"};
    const requiem::ExecutionResult result = requiem::execute(request);
    expect(result.ok, "execution should succeed");
    expect(requiem::validate_replay(request, result), "replay validation should pass");

    requiem::CasStore cas((tmp / "cas2").string());
    for (const auto& [path, digest] : result.output_digests) {
      (void)path;
      std::ifstream ifs(tmp / "out.txt", std::ios::binary);
      std::string bytes((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
      expect(cas.put(bytes) == digest, "output digest should match CAS digest");
    }
    std::string error;
    expect(requiem::validate_replay_with_cas(request, result, cas, &error), "replay+cas validation should pass");
  }

  std::cout << "All tests passed\n";
  return 0;
}
