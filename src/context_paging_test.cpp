#include "requiem/cas.hpp"
#include "requiem/context_paging.hpp"

#include <cassert>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <memory>
#include <string>
#include <vector>

namespace fs = std::filesystem;

void test_stitching() {
  std::cout << "Running test_stitching...\n";
  const auto test_dir =
      fs::temp_directory_path() / "requiem_paging_test_stitching";
  fs::remove_all(test_dir);
  fs::create_directories(test_dir);

  auto cas = std::make_shared<requiem::CasStore>(test_dir.string());
  requiem::ContextPager pager(cas);

  // Create a string: "01234567890123456789..." (50 chars)
  std::string full_context;
  for (int i = 0; i < 5; ++i)
    full_context += "0123456789";

  // Virtualize with small page size to force chunking
  // Page size 4 -> chunks: "0123", "4567", "8901", ...
  std::string manifest_digest = pager.virtualize(full_context, 4);
  assert(!manifest_digest.empty());

  // Recall a slice that spans chunks
  // Offset 2, length 8. Should be "23456789".
  // Chunk 0 ("0123") provides "23"
  // Chunk 1 ("4567") provides "4567"
  // Chunk 2 ("8901") provides "89"
  auto recalled = pager.recall(manifest_digest, 2, 8);
  assert(recalled.has_value());
  assert(*recalled == "23456789");

  // Recall exact chunk boundary
  // Offset 4, length 4. Should be "4567" (Chunk 1 exactly)
  recalled = pager.recall(manifest_digest, 4, 4);
  assert(recalled.has_value());
  assert(*recalled == "4567");

  // Recall crossing multiple chunks
  // Offset 3, length 6. Should be "345678".
  recalled = pager.recall(manifest_digest, 3, 6);
  assert(recalled.has_value());
  assert(*recalled == "345678");

  fs::remove_all(test_dir);
  std::cout << "test_stitching passed.\n";
}

void test_missing_cas_object() {
  std::cout << "Running test_missing_cas_object...\n";
  const auto test_dir =
      fs::temp_directory_path() / "requiem_paging_test_missing";
  fs::remove_all(test_dir);
  fs::create_directories(test_dir);

  auto cas = std::make_shared<requiem::CasStore>(test_dir.string());
  requiem::ContextPager pager(cas);

  std::string full_context = "AAAAABBBBBCCCCC"; // 15 chars
  // Page size 5 -> Chunks: AAAAA, BBBBB, CCCCC
  std::string manifest_digest = pager.virtualize(full_context, 5);
  assert(!manifest_digest.empty());

  // Identify the digest of the middle chunk ("BBBBB")
  // We can do this by putting it manually to get the hash, or inspecting CAS.
  // "BBBBB" -> put("BBBBB")
  std::string b_digest = cas->put("BBBBB");
  assert(cas->contains(b_digest));

  // Corrupt CAS: remove the object file for the middle chunk
  // Path structure: objects/AB/CD/digest
  fs::path b_path = fs::path(test_dir) / "objects" / b_digest.substr(0, 2) /
                    b_digest.substr(2, 2) / b_digest;
  fs::remove(b_path);
  assert(!cas->contains(b_digest)); // Should be gone

  // Recall range covering A, B, and C.
  // Offset 0, length 15.
  // Should get "AAAAA" + "\0\0\0\0\0" + "CCCCC" because B is missing.
  auto recalled = pager.recall(manifest_digest, 0, 15);
  assert(recalled.has_value());

  std::string expected = "AAAAA\0\0\0\0\0CCCCC";
  // Note: std::string comparison stops at null if constructed from char*, but
  // here we compare content. We need to construct expected carefully.
  std::string expected_str = "AAAAA";
  expected_str.append(5, '\0');
  expected_str += "CCCCC";

  assert(*recalled == expected_str);

  fs::remove_all(test_dir);
  std::cout << "test_missing_cas_object passed.\n";
}

int main() {
  test_stitching();
  test_missing_cas_object();
  return 0;
}
