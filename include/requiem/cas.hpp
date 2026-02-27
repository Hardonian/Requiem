#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace requiem {

struct CasObjectInfo {
  std::string digest;
  std::string encoding{"identity"};
  std::size_t original_size{0};
  std::size_t stored_size{0};
  std::string stored_blob_hash;
  std::string created_at;  // v1.1: Creation timestamp for GC
  std::string last_accessed;  // v1.1: For LRU eviction
  std::uint32_t ref_count{0};  // v1.1: Reference counting for GC
};

// v1.1: CAS statistics
struct CasStats {
  std::size_t total_objects{0};
  std::size_t total_bytes{0};
  std::size_t compressed_bytes{0};
  std::size_t savings_bytes{0};
  double compression_ratio{1.0};
  std::vector<CasObjectInfo> top_by_size;  // Largest objects
};

// v1.1: GC candidate selection
struct GcCandidate {
  std::string digest;
  std::size_t stored_size{0};
  std::string last_accessed;
  std::uint32_t ref_count{0};
};

class CasStore {
 public:
  explicit CasStore(std::string root = ".requiem/cas/v2");

  std::string put(const std::string& data, const std::string& compression = "off");
  std::optional<std::string> get(const std::string& digest);
  std::optional<CasObjectInfo> info(const std::string& digest) const;
  bool contains(const std::string& digest) const;
  std::size_t size() const;
  std::vector<CasObjectInfo> scan_objects() const;

  // v1.1: Atomic write operations for crash safety
  bool put_atomic(const std::string& data, const std::string& digest, const std::string& compression = "off");
  
  // v1.1: Statistics
  CasStats stats(std::size_t top_n = 0) const;
  
  // v1.1: GC with candidates
  std::vector<GcCandidate> find_gc_candidates(std::size_t max_candidates = 100) const;
  bool remove(const std::string& digest);
  
  // v1.1: Verify with sampling
  struct VerifyResult {
    std::size_t verified{0};
    std::size_t errors{0};
    std::size_t missing{0};
    std::vector<std::string> error_digests;
  };
  VerifyResult verify_all() const;
  VerifyResult verify_sample(std::size_t sample_size) const;
  
  // SECURITY: LLM Freeze integrity verification
  // Verifies that a frozen artifact (by CID) has not been tampered with
  bool verify_llm_freeze_integrity(const std::string& cid);

  const std::string& root() const { return root_; }

 private:
  std::string object_path(const std::string& digest) const;
  std::string meta_path(const std::string& digest) const;
  std::string temp_path(const std::string& digest) const;  // v1.1: Temp file for atomic writes
  std::string root_;
};

}  // namespace requiem
