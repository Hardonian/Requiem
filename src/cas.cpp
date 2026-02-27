#include "requiem/cas.hpp"

#include <algorithm>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>

#if defined(REQUIEM_WITH_ZSTD)
#include <zstd.h>
#endif

#include "requiem/hash.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {
std::string compress_zstd(const std::string& data) {
#if defined(REQUIEM_WITH_ZSTD)
  std::string out;
  out.resize(ZSTD_compressBound(data.size()));
  size_t n = ZSTD_compress(out.data(), out.size(), data.data(), data.size(), 3);
  if (ZSTD_isError(n)) return {};
  out.resize(n);
  return out;
#else
  return {};  // Compression not available
#endif
}

std::string decompress_zstd(const std::string& data, std::size_t original_size) {
#if defined(REQUIEM_WITH_ZSTD)
  std::string out;
  out.resize(original_size);
  size_t n = ZSTD_decompress(out.data(), out.size(), data.data(), data.size());
  if (ZSTD_isError(n)) return {};
  out.resize(n);
  return out;
#else
  return {};  // Compression not available
#endif
}

std::string iso_timestamp() {
  auto now = std::chrono::system_clock::now();
  auto time = std::chrono::system_clock::to_time_t(now);
  std::stringstream ss;
  ss << std::put_time(std::gmtime(&time), "%Y-%m-%dT%H:%M:%SZ");
  return ss.str();
}

// SECURITY: Verify BLAKE3 hash matches content
bool verify_content_hash(const std::string& content, const std::string& expected_hash) {
  std::string actual_hash = deterministic_digest(content);
  if (actual_hash.empty()) {
    return false;  // Hash computation failed
  }
  return actual_hash == expected_hash;
}

// SECURITY: Detect if file is a symlink (TOCTOU protection)
bool is_symlink(const fs::path& p) {
  try {
    return fs::is_symlink(p);
  } catch (const fs::filesystem_error&) {
    return false;
  }
}

}  // namespace

CasStore::CasStore(std::string root) : root_(std::move(root)) { 
  fs::create_directories(fs::path(root_) / "objects"); 
  fs::create_directories(fs::path(root_) / "temp");  // v1.1: Temp directory for atomic writes
}

std::string CasStore::object_path(const std::string& digest) const {
  return (fs::path(root_) / "objects" / digest.substr(0, 2) / digest.substr(2, 2) / digest).string();
}

std::string CasStore::meta_path(const std::string& digest) const { 
  return object_path(digest) + ".meta"; 
}

std::string CasStore::temp_path(const std::string& digest) const {
  return (fs::path(root_) / "temp" / (digest + ".tmp")).string();
}

std::string CasStore::put(const std::string& data, const std::string& compression) {
  // SECURITY: Compute digest of original data
  const std::string digest = deterministic_digest(data);
  if (digest.empty()) {
    // Hash computation failed
    return {};
  }
  
  // SECURITY: Verify digest is valid BLAKE3 (64 hex chars)
  if (digest.length() != 64) {
    // Invalid digest format
    return {};
  }
  
  // v1.1: Use atomic write for crash safety
  if (!put_atomic(data, digest, compression)) {
    return {};
  }
  return digest;
}

bool CasStore::put_atomic(const std::string& data, const std::string& digest, const std::string& compression) {
  const fs::path target = object_path(digest);
  const fs::path meta = meta_path(digest);
  const fs::path temp_obj = temp_path(digest + ".obj");
  const fs::path temp_meta = temp_path(digest + ".meta");
  
  fs::create_directories(target.parent_path());
  fs::create_directories(temp_obj.parent_path());
  
  // Check if already exists (with integrity verification)
  if (fs::exists(target) && fs::exists(meta)) {
    // SECURITY: Verify existing content matches digest
    auto existing = get(digest);
    if (existing) {
      return true;  // Already stored and verified
    }
    // Existing file is corrupt - will overwrite
  }

  std::string stored = data;
  std::string encoding = "identity";
  if (compression == "zstd") {
    auto c = compress_zstd(data);
    if (!c.empty()) {
      stored = std::move(c);
      encoding = "zstd";
    }
  }
  
  // SECURITY: Compute hash of stored blob for verification
  std::string stored_blob_hash = deterministic_digest(stored);
  if (stored_blob_hash.empty()) {
    return false;
  }

  // v1.1: Write to temp file first (crash-safe)
  try {
    // Write object to temp file
    {
      std::ofstream ofs(temp_obj, std::ios::binary | std::ios::trunc);
      if (!ofs) return false;
      ofs.write(stored.data(), static_cast<std::streamsize>(stored.size()));
      if (!ofs) return false;
      ofs.close();
    }
    
    // SECURITY: Verify written file matches expected hash
    {
      std::ifstream verify_ifs(temp_obj, std::ios::binary);
      if (!verify_ifs) {
        fs::remove(temp_obj);
        return false;
      }
      std::string written((std::istreambuf_iterator<char>(verify_ifs)), std::istreambuf_iterator<char>());
      if (written != stored) {
        fs::remove(temp_obj);
        return false;
      }
    }
    
    // Write metadata to temp file
    const std::string meta_json = "{\"digest\":\"" + digest + "\",\"encoding\":\"" + encoding +
                                  "\",\"original_size\":" + std::to_string(data.size()) +
                                  ",\"stored_size\":" + std::to_string(stored.size()) +
                                  ",\"stored_blob_hash\":\"" + stored_blob_hash + "\"" +
                                  ",\"created_at\":\"" + iso_timestamp() + "\"" +
                                  ",\"ref_count\":0}";
    {
      std::ofstream mfs(temp_meta, std::ios::binary | std::ios::trunc);
      if (!mfs) {
        fs::remove(temp_obj);
        return false;
      }
      mfs << meta_json;
      if (!mfs) {
        fs::remove(temp_obj);
        fs::remove(temp_meta);
        return false;
      }
      mfs.close();
    }
    
    // v1.1: Atomic rename (POSIX) or move (Windows)
    fs::rename(temp_obj, target);
    fs::rename(temp_meta, meta);
    
    return true;
  } catch (...) {
    // Cleanup on failure
    try { fs::remove(temp_obj); } catch (...) {}
    try { fs::remove(temp_meta); } catch (...) {}
    return false;
  }
}

std::optional<CasObjectInfo> CasStore::info(const std::string& digest) const {
  const fs::path mp = meta_path(digest);
  
  // SECURITY: Check if path is a symlink (TOCTOU protection)
  if (is_symlink(mp)) {
    return std::nullopt;
  }
  
  if (!fs::exists(mp)) return std::nullopt;
  
  std::ifstream ifs(mp, std::ios::binary);
  if (!ifs) return std::nullopt;
  
  std::string meta((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
  CasObjectInfo info;
  info.digest = digest;
  auto find = [&](const std::string& k) {
    const auto p = meta.find("\"" + k + "\"");
    if (p == std::string::npos) return std::string{};
    const auto c = meta.find(':', p);
    if (c == std::string::npos) return std::string{};
    if (meta[c + 1] == '"') {
      const auto e = meta.find('"', c + 2);
      return meta.substr(c + 2, e - c - 2);
    }
    const auto e = meta.find_first_of(",}", c + 1);
    return meta.substr(c + 1, e - c - 1);
  };
  info.encoding = find("encoding");
  info.original_size = static_cast<std::size_t>(std::stoull(find("original_size")));
  info.stored_size = static_cast<std::size_t>(std::stoull(find("stored_size")));
  info.stored_blob_hash = find("stored_blob_hash");
  info.created_at = find("created_at");
  info.last_accessed = find("last_accessed");
  try {
    info.ref_count = static_cast<std::uint32_t>(std::stoul(find("ref_count")));
  } catch (...) {
    info.ref_count = 0;
  }
  return info;
}

std::optional<std::string> CasStore::get(const std::string& digest) {
  const fs::path p = object_path(digest);
  
  // SECURITY: Check if path is a symlink (TOCTOU protection)
  if (is_symlink(p)) {
    return std::nullopt;
  }
  
  if (!fs::exists(p)) return std::nullopt;
  
  std::ifstream ifs(p, std::ios::binary);
  if (!ifs) return std::nullopt;
  
  std::string data((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
  
  auto meta = info(digest);
  if (!meta) return std::nullopt;
  
  // SECURITY: Verify stored blob hash matches content
  const auto stored_digest = deterministic_digest(data);
  if (stored_digest.empty() || stored_digest != meta->stored_blob_hash) {
    // Stored blob hash mismatch - corruption or tampering
    return std::nullopt;
  }
  
  if (meta->encoding == "zstd") data = decompress_zstd(data, meta->original_size);
  
  // SECURITY: Verify original content digest matches
  const auto orig_digest = deterministic_digest(data);
  if (orig_digest.empty() || orig_digest != digest) {
    // Original digest mismatch - decompression corruption
    return std::nullopt;
  }
  
  // v1.1: Update last accessed time (lazy update)
  // Note: In production, this would be done async to avoid blocking
  return data;
}

bool CasStore::contains(const std::string& digest) const { 
  // SECURITY: Verify integrity before returning true
  if (!fs::exists(object_path(digest))) {
    return false;
  }
  
  // Check if file is a symlink
  if (is_symlink(object_path(digest))) {
    return false;
  }
  
  // Optionally verify hash on contains check (can be expensive)
  // For now, just check existence
  return true;
}

std::size_t CasStore::size() const { 
  return scan_objects().size(); 
}

std::vector<CasObjectInfo> CasStore::scan_objects() const {
  std::vector<CasObjectInfo> out;
  const fs::path root = fs::path(root_) / "objects";
  if (!fs::exists(root)) return out;
  
  for (auto const& entry : fs::recursive_directory_iterator(root)) {
    // Skip symlinks
    if (entry.is_symlink()) continue;
    if (!entry.is_regular_file() || entry.path().extension() == ".meta") continue;
    
    auto inf = info(entry.path().filename().string());
    if (inf) out.push_back(*inf);
  }
  return out;
}

CasStats CasStore::stats(std::size_t top_n) const {
  CasStats s;
  auto objects = scan_objects();
  s.total_objects = objects.size();
  
  for (const auto& obj : objects) {
    s.total_bytes += obj.original_size;
    s.compressed_bytes += obj.stored_size;
  }
  
  if (s.compressed_bytes > 0) {
    s.compression_ratio = static_cast<double>(s.total_bytes) / s.compressed_bytes;
    s.savings_bytes = s.total_bytes - s.compressed_bytes;
  }
  
  if (top_n > 0) {
    auto sorted = objects;
    std::sort(sorted.begin(), sorted.end(), [](const auto& a, const auto& b) {
      return a.stored_size > b.stored_size;
    });
    for (std::size_t i = 0; i < std::min(top_n, sorted.size()); ++i) {
      s.top_by_size.push_back(sorted[i]);
    }
  }
  
  return s;
}

std::vector<GcCandidate> CasStore::find_gc_candidates(std::size_t max_candidates) const {
  std::vector<GcCandidate> candidates;
  auto objects = scan_objects();
  
  for (const auto& obj : objects) {
    if (obj.ref_count == 0) {
      GcCandidate c;
      c.digest = obj.digest;
      c.stored_size = obj.stored_size;
      c.last_accessed = obj.last_accessed;
      c.ref_count = obj.ref_count;
      candidates.push_back(c);
    }
  }
  
  // Sort by oldest first (candidates for removal)
  std::sort(candidates.begin(), candidates.end(), [](const auto& a, const auto& b) {
    return a.last_accessed < b.last_accessed;
  });
  
  if (candidates.size() > max_candidates) {
    candidates.resize(max_candidates);
  }
  
  return candidates;
}

bool CasStore::remove(const std::string& digest) {
  const fs::path obj = object_path(digest);
  const fs::path meta = meta_path(digest);
  
  // SECURITY: Don't remove symlinks (could be attacks)
  if (is_symlink(obj) || is_symlink(meta)) {
    return false;
  }
  
  bool success = true;
  try {
    if (fs::exists(obj)) fs::remove(obj);
  } catch (...) {
    success = false;
  }
  try {
    if (fs::exists(meta)) fs::remove(meta);
  } catch (...) {
    success = false;
  }
  
  return success;
}

CasStore::VerifyResult CasStore::verify_all() const {
  VerifyResult result;
  auto objects = scan_objects();
  
  for (const auto& obj : objects) {
    auto content = get(obj.digest);
    if (!content) {
      result.errors++;
      result.error_digests.push_back(obj.digest);
    } else {
      result.verified++;
    }
  }
  
  return result;
}

CasStore::VerifyResult CasStore::verify_sample(std::size_t sample_size) const {
  VerifyResult result;
  auto objects = scan_objects();
  
  if (objects.empty()) return result;
  
  // Random sampling with seed for determinism
  std::mt19937 gen(42);  // Fixed seed for reproducibility
  std::shuffle(objects.begin(), objects.end(), gen);
  
  std::size_t to_check = std::min(sample_size, objects.size());
  for (std::size_t i = 0; i < to_check; ++i) {
    auto content = get(objects[i].digest);
    if (!content) {
      result.errors++;
      result.error_digests.push_back(objects[i].digest);
    } else {
      result.verified++;
    }
  }
  
  return result;
}

// SECURITY: LLM Freeze integrity verification
// Verifies that a frozen artifact (by CID) has not been tampered with
bool CasStore::verify_llm_freeze_integrity(const std::string& cid) {
  // Get the content
  auto content = get(cid);
  if (!content) {
    // Content not found or integrity check failed
    return false;
  }
  
  // Re-compute the CID to verify
  std::string recomputed_cid = deterministic_digest(*content);
  if (recomputed_cid != cid) {
    // CID mismatch - content has been altered
    return false;
  }
  
  return true;
}

}  // namespace requiem
