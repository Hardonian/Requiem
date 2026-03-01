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
#include <memory>
#include <random>
#include <string_view> // MICRO_OPT: zero-alloc key lookup in info() lambda

#if defined(REQUIEM_WITH_ZSTD)
#include <zstd.h>
#endif

#include "requiem/hash.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {
#if defined(REQUIEM_WITH_ZSTD)
std::string compress_zstd(const std::string &data) {
  std::string out;
  out.resize(ZSTD_compressBound(data.size()));
  size_t n = ZSTD_compress(out.data(), out.size(), data.data(), data.size(), 3);
  if (ZSTD_isError(n))
    return {};
  out.resize(n);
  return out;
}

std::string decompress_zstd(const std::string &data,
                            std::size_t original_size) {
  std::string out;
  out.resize(original_size);
  size_t n = ZSTD_decompress(out.data(), out.size(), data.data(), data.size());
  if (ZSTD_isError(n))
    return {};
  out.resize(n);
  return out;
}
#endif

// Generate a unique temporary filename to avoid collisions during concurrent
// writes.
std::string make_tmp_name(const fs::path &dir) {
  static thread_local std::mt19937 rng(std::random_device{}());
  std::uniform_int_distribution<uint64_t> dist;
  return (dir / (".tmp_" + std::to_string(dist(rng)))).string();
}

// Atomic write: write to temp file, then rename into place.
// On POSIX, rename() is atomic within the same filesystem.
bool atomic_write(const fs::path &target, const std::string &data) {
  fs::create_directories(target.parent_path());
  const std::string tmp = make_tmp_name(target.parent_path());
  {
    std::ofstream ofs(tmp, std::ios::binary | std::ios::trunc);
    if (!ofs)
      return false;
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
bool valid_digest(const std::string &d) {
  if (d.size() != 64)
    return false;
  for (char c : d) {
    if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')))
      return false;
  }
  return true;
}

} // namespace

CasStore::CasStore(std::string root) : root_(std::move(root)) {
  fs::create_directories(fs::path(root_) / "objects");
}

std::string CasStore::object_path(const std::string &digest) const {
  return (fs::path(root_) / "objects" / digest.substr(0, 2) /
          digest.substr(2, 2) / digest)
      .string();
}

std::string CasStore::meta_path(const std::string &digest) const {
  return object_path(digest) + ".meta";
}

std::string CasStore::index_path() const {
  return (fs::path(root_) / "index.ndjson").string();
}

void CasStore::load_index() const {
  std::lock_guard<std::mutex> lk(index_mu_);
  if (index_loaded_)
    return;

  const fs::path ip = index_path();
  if (fs::exists(ip)) {
    std::ifstream ifs(ip);
    std::string line;
    while (std::getline(ifs, line)) {
      if (line.empty())
        continue;

      // REQUIEM_UPGRADE: Ad-hoc parsing for speed.
      // In a full implementation, use jsonlite::parse().
      auto find_in = [&](const std::string &l,
                         std::string_view k) -> std::string {
        auto p = l.find(k);
        if (p == std::string::npos)
          return {};
        auto start = l.find(':', p);
        if (start == std::string::npos)
          return {};
        if (l[start + 1] == '"') {
          auto end = l.find('"', start + 2);
          return l.substr(start + 2, end - start - 2);
        } else {
          auto end = l.find_first_of(",}", start + 1);
          return l.substr(start + 1, end - start - 1);
        }
      };

      CasObjectInfo inf;
      inf.digest = find_in(line, "\"digest\"");
      inf.encoding = find_in(line, "\"encoding\"");
      inf.stored_blob_hash = find_in(line, "\"stored_blob_hash\"");
      try {
        inf.original_size = std::stoull(find_in(line, "\"original_size\""));
        inf.stored_size = std::stoull(find_in(line, "\"stored_size\""));
      } catch (...) {
      }

      if (!inf.digest.empty())
        index_[inf.digest] = std::move(inf);
    }
  }
  index_loaded_ = true;
}

void CasStore::save_index_entry(const CasObjectInfo &info) const {
  const std::string line =
      "{\"digest\":\"" + info.digest + "\",\"encoding\":\"" + info.encoding +
      "\",\"original_size\":" + std::to_string(info.original_size) +
      ",\"stored_size\":" + std::to_string(info.stored_size) +
      ",\"stored_blob_hash\":\"" + info.stored_blob_hash + "\"}\n";
  std::ofstream ofs(index_path(), std::ios::binary | std::ios::app);
  ofs.write(line.data(), line.size());
}

std::string CasStore::put(const std::string &data,
                          const std::string &compression) {
  // INV-2 ENFORCEMENT: CAS key uses "cas:" domain prefix per determinism
  // contract.
  const std::string digest = cas_content_hash(data);
  if (digest.empty() || !valid_digest(digest))
    return {};

  // Dedup: already stored — verify content integrity before returning (INV-2).
  const fs::path target = object_path(digest);
  const fs::path meta = meta_path(digest);
  if (fs::exists(target) && fs::exists(meta)) {
    // INV-2 ENFORCEMENT: Verify existing content matches — detect silent
    // mutation.
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
  if (!atomic_write(target, stored))
    return {};

  // Write metadata atomically.
  CasObjectInfo info;
  info.digest = digest;
  info.encoding = encoding;
  info.original_size = data.size();
  info.stored_size = stored.size();
  info.stored_blob_hash = blake3_hex(stored);

  const std::string meta_json =
      "{\"digest\":\"" + info.digest + "\",\"encoding\":\"" + info.encoding +
      "\",\"original_size\":" + std::to_string(info.original_size) +
      ",\"stored_size\":" + std::to_string(info.stored_size) +
      ",\"stored_blob_hash\":\"" + info.stored_blob_hash + "\"}";
  if (!atomic_write(meta, meta_json)) {
    // Rollback blob on meta write failure.
    std::error_code ec;
    fs::remove(target, ec);
    return {};
  }

  // Update in-memory index and persistence.
  {
    std::lock_guard<std::mutex> lk(index_mu_);
    index_[digest] = info;
  }
  save_index_entry(info);

  return digest;
}

std::optional<CasObjectInfo> CasStore::info(const std::string &digest) const {
  if (!valid_digest(digest))
    return std::nullopt;

  if (!index_loaded_)
    load_index();

  std::lock_guard<std::mutex> lk(index_mu_);
  auto it = index_.find(digest);
  if (it != index_.end())
    return it->second;

  return std::nullopt;
}

std::optional<std::string> CasStore::get(const std::string &digest) const {
  if (!valid_digest(digest))
    return std::nullopt;
  const fs::path p = object_path(digest);
  if (!fs::exists(p))
    return std::nullopt;
  std::ifstream ifs(p, std::ios::binary);
  std::string data((std::istreambuf_iterator<char>(ifs)),
                   std::istreambuf_iterator<char>());

  auto meta = info(digest);
  if (!meta)
    return std::nullopt;

  // Verify stored blob integrity (plain BLAKE3, no domain prefix for blob
  // hash).
  const auto stored_hash = blake3_hex(data);
  if (stored_hash != meta->stored_blob_hash)
    return std::nullopt;

#if defined(REQUIEM_WITH_ZSTD)
  if (meta->encoding == "zstd")
    data = decompress_zstd(data, meta->original_size);
#endif

  // INV-2 ENFORCEMENT: Verify original content integrity using cas: domain
  // hash.
  const auto orig_digest = cas_content_hash(data);
  if (orig_digest != digest)
    return std::nullopt;

  return data;
}

bool CasStore::contains(const std::string &digest) const {
  if (!valid_digest(digest))
    return false;
  return fs::exists(object_path(digest));
}

std::size_t CasStore::size() const {
  if (!index_loaded_)
    load_index();
  std::lock_guard<std::mutex> lk(index_mu_);
  return index_.size();
}

std::vector<CasObjectInfo> CasStore::scan_objects() const {
  if (!index_loaded_)
    load_index();
  std::vector<CasObjectInfo> out;
  std::lock_guard<std::mutex> lk(index_mu_);
  out.reserve(index_.size());
  for (const auto &[_, info] : index_)
    out.push_back(info);
  return out;
}

// ---------------------------------------------------------------------------
// ReplicatingBackend
// ---------------------------------------------------------------------------

class ReplicatingBackend : public ICASBackend {
 public:
  ReplicatingBackend(std::shared_ptr<ICASBackend> primary,
                     std::shared_ptr<ICASBackend> secondary)
      : primary_(std::move(primary)), secondary_(std::move(secondary)) {}

  std::string backend_id() const override { return "replicating"; }

  std::string put(const std::string &data,
                  const std::string &compression) override {
    // Write to primary first (authoritative).
    std::string digest = primary_->put(data, compression);
    if (digest.empty()) return {};

    // Dual-write to secondary.
    // In a production system, this might be asynchronous or fail-open.
    // Here we attempt it synchronously.
    secondary_->put(data, compression);

    return digest;
  }

  std::optional<std::string> get(const std::string &digest) const override {
    // Read from primary.
    auto result = primary_->get(digest);
    if (result) return result;
    // Fallback to secondary if primary misses.
    return secondary_->get(digest);
  }

  bool contains(const std::string &digest) const override {
    return primary_->contains(digest) || secondary_->contains(digest);
  }

  std::optional<CasObjectInfo> info(const std::string &digest) const override {
    auto i = primary_->info(digest);
    if (i) return i;
    return secondary_->info(digest);
  }

  std::vector<CasObjectInfo> scan_objects() const override {
    return primary_->scan_objects();
  }

  std::size_t size() const override { return primary_->size(); }

 private:
  std::shared_ptr<ICASBackend> primary_;
  std::shared_ptr<ICASBackend> secondary_;
};

// ---------------------------------------------------------------------------
// S3CompatibleBackend — scaffold (not yet implemented)
// ---------------------------------------------------------------------------
// EXTENSION_POINT: s3_backend_implementation
// See include/requiem/cas.hpp for detailed implementation notes.

S3CompatibleBackend::S3CompatibleBackend(std::string endpoint,
                                         std::string bucket, std::string prefix)
    : endpoint_(std::move(endpoint)), bucket_(std::move(bucket)),
      prefix_(std::move(prefix)) {
  // Simulation: Ensure "bucket" directory exists if endpoint is a local path.
  // In a real implementation, this would initialize the S3 client.
  if (endpoint_.find("file://") == 0) {
    fs::create_directories(fs::path(endpoint_.substr(7)) / bucket_);
  }
}

std::string S3CompatibleBackend::put(const std::string &data,
                                     const std::string &compression) {
  const std::string digest = cas_content_hash(data);
  if (digest.empty())
    return {};

  // Simulation: Write to file:// endpoint.
  // Real impl: s3_client.PutObject({Bucket: bucket_, Key: prefix_ + "/" +
  // digest, Body: data});
  if (endpoint_.find("file://") == 0) {
    fs::path p = fs::path(endpoint_.substr(7)) / bucket_ / prefix_ / digest;
    fs::create_directories(p.parent_path());
    std::ofstream ofs(p, std::ios::binary);
    ofs.write(data.data(), data.size());
    if (!ofs)
      return {};
    return digest;
  }

  // Fallback for non-file endpoints (stub)
  return {};
}

std::optional<std::string>
S3CompatibleBackend::get(const std::string &digest) const {
  if (endpoint_.find("file://") == 0) {
    fs::path p = fs::path(endpoint_.substr(7)) / bucket_ / prefix_ / digest;
    if (!fs::exists(p))
      return std::nullopt;
    std::ifstream ifs(p, std::ios::binary);
    return std::string((std::istreambuf_iterator<char>(ifs)),
                       std::istreambuf_iterator<char>());
  }
  return std::nullopt;
}

bool S3CompatibleBackend::contains(const std::string &digest) const {
  if (endpoint_.find("file://") == 0) {
    fs::path p = fs::path(endpoint_.substr(7)) / bucket_ / prefix_ / digest;
    return fs::exists(p);
  }
  return false;
}

std::optional<CasObjectInfo>
S3CompatibleBackend::info(const std::string &digest) const {
  // S3 HEAD object simulation
  if (contains(digest)) {
    auto data = get(digest);
    if (data) {
      CasObjectInfo i;
      i.digest = digest;
      i.stored_size = data->size();
      i.original_size =
          data->size(); // Assuming identity compression for simulation
      i.encoding = "identity";
      return i;
    }
  }
  return std::nullopt;
}

std::vector<CasObjectInfo> S3CompatibleBackend::scan_objects() const {
  // S3 ListObjectsV2 simulation
  std::vector<CasObjectInfo> out;
  if (endpoint_.find("file://") == 0) {
    fs::path root = fs::path(endpoint_.substr(7)) / bucket_ / prefix_;
    if (fs::exists(root)) {
      for (const auto &entry : fs::recursive_directory_iterator(root)) {
        if (entry.is_regular_file()) {
          auto i = info(entry.path().filename().string());
          if (i)
            out.push_back(*i);
        }
      }
    }
  }
  return out;
}

std::size_t S3CompatibleBackend::size() const { return 0; }

} // namespace requiem
