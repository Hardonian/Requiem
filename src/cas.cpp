#include "requiem/cas.hpp"

// PHASE 3: CAS Hardening + Abstraction
//
// CasStore (LocalFSBackend) now implements ICASBackend.
// S3CompatibleBackend is scaffolded — all methods return empty/false.
//
// EXTENSION_POINT: append_only_journal
//   See cas.hpp for design notes on adding a crash-recovery journal.
//
// EXTENSION_POINT: multi-region_cas_replication
//   To implement: create a ReplicatingBackend that wraps two ICASBackend
//   instances and writes to both atomically. On primary success + secondary
//   failure, schedule async retry on secondary. Invariant: return success
//   only after primary write confirms.

#include <cstdio>
#include <filesystem>
#include <fstream>
#include <random>
#include <string_view>  // MICRO_OPT: zero-alloc key lookup in info() lambda

#if defined(REQUIEM_WITH_ZSTD)
#include <zstd.h>
#endif

#include "requiem/hash.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {
#if defined(REQUIEM_WITH_ZSTD)
std::string compress_zstd(const std::string& data) {
  std::string out;
  out.resize(ZSTD_compressBound(data.size()));
  size_t n = ZSTD_compress(out.data(), out.size(), data.data(), data.size(), 3);
  if (ZSTD_isError(n)) return {};
  out.resize(n);
  return out;
}

std::string decompress_zstd(const std::string& data, std::size_t original_size) {
  std::string out;
  out.resize(original_size);
  size_t n = ZSTD_decompress(out.data(), out.size(), data.data(), data.size());
  if (ZSTD_isError(n)) return {};
  out.resize(n);
  return out;
}
#endif

// Generate a unique temporary filename to avoid collisions during concurrent writes.
std::string make_tmp_name(const fs::path& dir) {
  static thread_local std::mt19937 rng(std::random_device{}());
  std::uniform_int_distribution<uint64_t> dist;
  return (dir / (".tmp_" + std::to_string(dist(rng)))).string();
}

// Atomic write: write to temp file, then rename into place.
// On POSIX, rename() is atomic within the same filesystem.
bool atomic_write(const fs::path& target, const std::string& data) {
  fs::create_directories(target.parent_path());
  const std::string tmp = make_tmp_name(target.parent_path());
  {
    std::ofstream ofs(tmp, std::ios::binary | std::ios::trunc);
    if (!ofs) return false;
    ofs.write(data.data(), static_cast<std::streamsize>(data.size()));
    if (!ofs) {
      std::remove(tmp.c_str());
      return false;
    }
  }
  std::error_code ec;
  fs::rename(tmp, target, ec);
  if (ec) {
    std::remove(tmp.c_str());
    return false;
  }
  return true;
}

// Validate digest is a 64-char hex string.
bool valid_digest(const std::string& d) {
  if (d.size() != 64) return false;
  for (char c : d) {
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  }
  return true;
}

}  // namespace

CasStore::CasStore(std::string root) : root_(std::move(root)) {
  fs::create_directories(fs::path(root_) / "objects");
}

std::string CasStore::object_path(const std::string& digest) const {
  return (fs::path(root_) / "objects" / digest.substr(0, 2) / digest.substr(2, 2) / digest).string();
}

std::string CasStore::meta_path(const std::string& digest) const {
  return object_path(digest) + ".meta";
}

std::string CasStore::put(const std::string& data, const std::string& compression) {
  // INV-2 ENFORCEMENT: CAS key uses "cas:" domain prefix per determinism contract.
  const std::string digest = cas_content_hash(data);
  if (digest.empty() || !valid_digest(digest)) return {};

  // Dedup: already stored — verify content integrity before returning (INV-2).
  const fs::path target = object_path(digest);
  const fs::path meta = meta_path(digest);
  if (fs::exists(target) && fs::exists(meta)) {
    // INV-2 ENFORCEMENT: Verify existing content matches — detect silent mutation.
    auto existing = get(digest);
    if (!existing.has_value() || *existing != data) {
      // Content mismatch or integrity failure on existing object.
      return {};
    }
    return digest;
  }

  std::string stored = data;
  std::string encoding = "identity";
#if defined(REQUIEM_WITH_ZSTD)
  if (compression == "zstd") {
    auto c = compress_zstd(data);
    if (!c.empty()) {
      stored = std::move(c);
      encoding = "zstd";
    }
  }
#else
  (void)compression;
#endif

  // Write blob atomically.
  if (!atomic_write(target, stored)) return {};

  // Write metadata atomically.
  // stored_blob_hash uses plain BLAKE3 (no domain prefix) since it hashes the
  // potentially-compressed blob, not the original CAS content.
  const std::string meta_json = "{\"digest\":\"" + digest + "\",\"encoding\":\"" + encoding +
                                "\",\"original_size\":" + std::to_string(data.size()) +
                                ",\"stored_size\":" + std::to_string(stored.size()) +
                                ",\"stored_blob_hash\":\"" + blake3_hex(stored) + "\"}";
  if (!atomic_write(meta, meta_json)) {
    // Rollback blob on meta write failure.
    std::error_code ec;
    fs::remove(target, ec);
    return {};
  }
  return digest;
}

std::optional<CasObjectInfo> CasStore::info(const std::string& digest) const {
  if (!valid_digest(digest)) return std::nullopt;
  const fs::path mp = meta_path(digest);
  if (!fs::exists(mp)) return std::nullopt;
  std::ifstream ifs(mp, std::ios::binary);
  std::string meta((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
  CasObjectInfo obj_info;
  obj_info.digest = digest;

  // MICRO_OPT: Accept string_view (not std::string) to avoid heap allocation per key.
  // MICRO_DOCUMENTED: Old lambda took `const std::string& k` and constructed
  //   `"\"" + k + "\""` on each call — 4 heap allocations for 4 fields = 4 alloc+free pairs.
  // New lambda takes string_view of a pre-quoted compile-time key literal.
  //   Caller passes `"\"encoding\""` as a string_view → zero heap allocation for key lookup.
  // Assumption: meta JSON is compact (single-line, no whitespace between tokens).
  //   This is guaranteed by the put() implementation which generates the meta JSON inline.
  // EXTENSION_POINT: data_layout_strategy — if meta parsing becomes hot (e.g. scan_objects()
  //   on large CAS stores), replace ad-hoc search with a minimal JSON tokenizer that
  //   walks the string once and extracts all fields in a single pass.
  auto find_field = [&](std::string_view quoted_key) -> std::string {
    const auto p = meta.find(quoted_key.data(), 0, quoted_key.size());
    if (p == std::string::npos) return {};
    const auto c = meta.find(':', p);
    if (c == std::string::npos) return {};
    if (c + 1 < meta.size() && meta[c + 1] == '"') {
      const auto e = meta.find('"', c + 2);
      if (e == std::string::npos) return {};
      return meta.substr(c + 2, e - c - 2);
    }
    const auto e = meta.find_first_of(",}", c + 1);
    if (e == std::string::npos) return {};
    return meta.substr(c + 1, e - c - 1);
  };

  obj_info.encoding = find_field("\"encoding\"");
  try {
    obj_info.original_size = static_cast<std::size_t>(std::stoull(find_field("\"original_size\"")));
    obj_info.stored_size   = static_cast<std::size_t>(std::stoull(find_field("\"stored_size\"")));
  } catch (...) {
    return std::nullopt;
  }
  obj_info.stored_blob_hash = find_field("\"stored_blob_hash\"");
  return obj_info;
}

std::optional<std::string> CasStore::get(const std::string& digest) const {
  if (!valid_digest(digest)) return std::nullopt;
  const fs::path p = object_path(digest);
  if (!fs::exists(p)) return std::nullopt;
  std::ifstream ifs(p, std::ios::binary);
  std::string data((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());

  auto meta = info(digest);
  if (!meta) return std::nullopt;

  // Verify stored blob integrity (plain BLAKE3, no domain prefix for blob hash).
  const auto stored_hash = blake3_hex(data);
  if (stored_hash != meta->stored_blob_hash) return std::nullopt;

#if defined(REQUIEM_WITH_ZSTD)
  if (meta->encoding == "zstd") data = decompress_zstd(data, meta->original_size);
#endif

  // INV-2 ENFORCEMENT: Verify original content integrity using cas: domain hash.
  const auto orig_digest = cas_content_hash(data);
  if (orig_digest != digest) return std::nullopt;

  return data;
}

bool CasStore::contains(const std::string& digest) const {
  if (!valid_digest(digest)) return false;
  return fs::exists(object_path(digest));
}

std::size_t CasStore::size() const { return scan_objects().size(); }

std::vector<CasObjectInfo> CasStore::scan_objects() const {
  std::vector<CasObjectInfo> out;
  const fs::path root = fs::path(root_) / "objects";
  if (!fs::exists(root)) return out;
  for (auto const& entry : fs::recursive_directory_iterator(root)) {
    if (!entry.is_regular_file() || entry.path().extension() == ".meta") continue;
    auto inf = info(entry.path().filename().string());
    if (inf) out.push_back(*inf);
  }
  return out;
}

// ---------------------------------------------------------------------------
// S3CompatibleBackend — scaffold (not yet implemented)
// ---------------------------------------------------------------------------
// EXTENSION_POINT: s3_backend_implementation
// See include/requiem/cas.hpp for detailed implementation notes.

S3CompatibleBackend::S3CompatibleBackend(std::string endpoint, std::string bucket,
                                         std::string prefix)
    : endpoint_(std::move(endpoint))
    , bucket_(std::move(bucket))
    , prefix_(std::move(prefix)) {}

std::string S3CompatibleBackend::put(const std::string& /*data*/,
                                     const std::string& /*compression*/) {
  // Not yet implemented. See cas.hpp EXTENSION_POINT: s3_backend_implementation.
  return {};
}

std::optional<std::string> S3CompatibleBackend::get(const std::string& /*digest*/) const {
  return std::nullopt;
}

bool S3CompatibleBackend::contains(const std::string& /*digest*/) const {
  return false;
}

std::optional<CasObjectInfo> S3CompatibleBackend::info(const std::string& /*digest*/) const {
  return std::nullopt;
}

std::vector<CasObjectInfo> S3CompatibleBackend::scan_objects() const {
  return {};
}

std::size_t S3CompatibleBackend::size() const {
  return 0;
}

}  // namespace requiem
