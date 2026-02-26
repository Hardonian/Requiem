#include <cstdlib>
#include <iostream>
#include <string>

#include "requiem/cas.hpp"
#include "requiem/hash.hpp"
#include "requiem/replay.hpp"
#include "requiem/runtime.hpp"

namespace {

void expect(bool condition, const std::string& message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << "\n";
    std::exit(1);
  }
}

}  // namespace

int main() {
  {
    const auto digest_a = requiem::deterministic_digest("abc");
    const auto digest_b = requiem::deterministic_digest("abc");
    expect(digest_a == digest_b, "hashing should be deterministic");
    expect(digest_a == "e71fa2190541574b", "known FNV-1a digest should match fixture");
  }

  {
    requiem::CasStore cas;
    const std::string data = "artifact";
    const std::string digest1 = cas.put(data);
    const std::string digest2 = cas.put(data);
    expect(digest1 == digest2, "CAS put should be content-addressed");
    expect(cas.size() == 1, "CAS should deduplicate identical writes");
    expect(cas.contains(digest1), "CAS should contain stored digest");
    expect(cas.get(digest1).value_or("") == data, "CAS should return stored object");
  }

  {
    requiem::ExecutionRequest request;
    request.command = "echo";
    request.inputs = {{"arg0", "hello"}, {"arg1", "world"}};
    request.nonce = 42;

    const requiem::ExecutionResult result = requiem::execute(request);
    expect(result.exit_code == 0, "scaffold execution should succeed");
    expect(!result.request_digest.empty(), "request digest should be populated");
    expect(!result.result_digest.empty(), "result digest should be populated");
    expect(requiem::validate_replay(request, result), "replay validation should pass for untampered result");

    auto tampered = result;
    tampered.stdout_text += "-tampered";
    expect(!requiem::validate_replay(request, tampered), "replay validation should fail for tampered result");
  }

  std::cout << "All tests passed\n";
  return 0;
}
