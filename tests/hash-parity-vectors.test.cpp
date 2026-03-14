#include "requiem/hash.hpp"

#include <iostream>
#include <string>
#include <vector>

int main() {
  const std::vector<std::string> vectors = {
      "", "hello", "hello world", "{\"key\":\"value\"}", "\n", "\r\n",
      "caf\xC3\xA9", "\xF0\x9F\x94\x92", std::string(1000, 'a')};

  for (const auto &v : vectors) {
    const auto h1 = requiem::blake3_hex(v);
    const auto h2 = requiem::blake3_hex(v);
    if (h1 != h2 || h1.size() != 64) {
      std::cerr << "hash vector determinism failure\n";
      return 1;
    }
  }

  const std::string payload = "test-payload";
  if (requiem::hash_domain("req:", payload) ==
      requiem::hash_domain("res:", payload)) {
    std::cerr << "domain separation failure\n";
    return 1;
  }

  return 0;
}
