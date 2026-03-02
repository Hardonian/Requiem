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

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <cstdio>
#include <deque>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <memory>
#include <random>
#include <sstream>
#include <thread>

#if defined(REQUIEM_WITH_ZSTD)
#include <zstd.h>
#endif

#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

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

std::string bytes_to_hex(const unsigned char *data, size_t len) {
  std::ostringstream oss;
  for (size_t i = 0; i < len; ++i) {
    oss << std::hex << std::setw(2) << std::setfill('0')
        << static_cast<int>(data[i]);
  }
  return oss.str();
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

#if defined(REQUIEM_WITH_ZSTD)
class ZstdDecompressStreambuf : public std::streambuf {
public:
  explicit ZstdDecompressStreambuf(std::unique_ptr<std::istream> source)
      : source_(std::move(source)), dstream_(ZSTD_createDStream()),
        in_buf_(ZSTD_DStreamInSize()), out_buf_(ZSTD_DStreamOutSize()) {
    ZSTD_initDStream(dstream_);
    setg(out_buf_.data(), out_buf_.data(), out_buf_.data());
  }

  ~ZstdDecompressStreambuf() override { ZSTD_freeDStream(dstream_); }

  ZstdDecompressStreambuf(const ZstdDecompressStreambuf &) = delete;
  ZstdDecompressStreambuf &operator=(const ZstdDecompressStreambuf &) = delete;

protected:
  int_type underflow() override {
    if (gptr() < egptr()) {
      return traits_type::to_int_type(*gptr());
    }

    pos_at_eback_ += (egptr() - eback());

    while (true) {
      if (input_.pos == input_.size) {
        if (source_->peek() == EOF) {
          return traits_type::eof();
        }
        source_->read(in_buf_.data(), in_buf_.size());
        input_.src = in_buf_.data();
        input_.size = source_->gcount();
        input_.pos = 0;
      }

      ZSTD_outBuffer output = {out_buf_.data(), out_buf_.size(), 0};
      size_t ret = ZSTD_decompressStream(dstream_, &output, &input_);

      if (ZSTD_isError(ret)) {
        return traits_type::eof();
      }

      if (output.pos > 0) {
        setg(out_buf_.data(), out_buf_.data(), out_buf_.data() + output.pos);
        return traits_type::to_int_type(*gptr());
      }

      if (ret == 0 && input_.pos == input_.size) {
        return traits_type::eof();
      }
    }
  }

  std::streampos seekoff(std::streamoff off, std::ios_base::seekdir way,
                         std::ios_base::openmode which) override {
    if (which & std::ios_base::out)
      return -1;

    std::streampos current_pos = pos_at_eback_ + (gptr() - eback());
    std::streampos new_pos = -1;

    if (way == std::ios_base::beg) {
      new_pos = off;
    } else if (way == std::ios_base::cur) {
      new_pos = current_pos + off;
    } else {
      return -1;
    }

    if (new_pos < 0)
      return -1;
    if (new_pos == current_pos)
      return new_pos;

    if (new_pos < current_pos) {
      // Rewind: restart decompression
      ZSTD_initDStream(dstream_); // Re-init context to reset state
      source_->clear();
      source_->seekg(0);
      input_ = {nullptr, 0, 0};
      setg(out_buf_.data(), out_buf_.data(), out_buf_.data());
      pos_at_eback_ = 0;
      current_pos = 0;
    }

    // Skip forward
    while (current_pos < new_pos) {
      if (sbumpc() == traits_type::eof())
        return -1;
      current_pos += 1;
    }
    return current_pos;
  }

  std::streampos seekpos(std::streampos pos,
                         std::ios_base::openmode which) override {
    return seekoff(pos, std::ios_base::beg, which);
  }

private:
  std::unique_ptr<std::istream> source_;
  ZSTD_DStream *dstream_;
  std::vector<char> in_buf_;
  std::vector<char> out_buf_;
  ZSTD_inBuffer input_{nullptr, 0, 0};
  std::streampos pos_at_eback_{0};
};

class ZstdInputStream : public std::istream {
public:
  explicit ZstdInputStream(std::unique_ptr<std::istream> source)
      : std::istream(&buf_), buf_(std::move(source)) {
    rdbuf(&buf_);
  }

private:
  ZstdDecompressStreambuf buf_;
};
#endif

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

      std::optional<jsonlite::JsonError> err;
      auto obj = jsonlite::parse(line, &err);
      if (err)
        continue;

      CasObjectInfo inf;
      inf.digest = jsonlite::get_string(obj, "digest", "");
      inf.encoding = jsonlite::get_string(obj, "encoding", "identity");
      inf.stored_blob_hash = jsonlite::get_string(obj, "stored_blob_hash", "");
      inf.original_size = jsonlite::get_u64(obj, "original_size", 0);
      inf.stored_size = jsonlite::get_u64(obj, "stored_size", 0);
      inf.created_at_unix_ts = jsonlite::get_u64(obj, "created_at", 0);

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
      ",\"stored_blob_hash\":\"" + info.stored_blob_hash +
      "\",\"created_at\":" + std::to_string(info.created_at_unix_ts) + "}\n";
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
  info.created_at_unix_ts = static_cast<uint64_t>(std::time(nullptr));

  const std::string meta_json =
      "{\"digest\":\"" + info.digest + "\",\"encoding\":\"" + info.encoding +
      "\",\"original_size\":" + std::to_string(info.original_size) +
      ",\"stored_size\":" + std::to_string(info.stored_size) +
      ",\"stored_blob_hash\":\"" + info.stored_blob_hash +
      "\",\"created_at\":" + std::to_string(info.created_at_unix_ts) + "}";
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

std::string CasStore::put_stream(std::istream &in,
                                 const std::string &compression) {
  // Buffer the entire stream and delegate to put().
  // A direct streaming BLAKE3 path can be added when a streaming hash
  // API is exposed via hash.hpp.
  std::string buffer((std::istreambuf_iterator<char>(in)),
                     std::istreambuf_iterator<char>());
  return put(buffer, compression);
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

std::unique_ptr<std::istream>
CasStore::get_stream(const std::string &digest) const {
  if (!valid_digest(digest))
    return nullptr;
  const fs::path p = object_path(digest);
  if (!fs::exists(p))
    return nullptr;

  auto file_stream = std::make_unique<std::ifstream>(p, std::ios::binary);
  if (!file_stream->is_open())
    return nullptr;

  auto meta = info(digest);
  if (meta && meta->encoding == "zstd") {
#if defined(REQUIEM_WITH_ZSTD)
    return std::make_unique<ZstdInputStream>(std::move(file_stream));
#else
    // Zstd compression required but not available in this build.
    return nullptr;
#endif
  }
  return file_stream;
}

bool CasStore::remove(const std::string &digest) {
  if (!valid_digest(digest))
    return false;

  std::error_code ec;
  bool removed_any = false;
  removed_any |= fs::remove(object_path(digest), ec);
  removed_any |= fs::remove(meta_path(digest), ec);

  std::lock_guard<std::mutex> lk(index_mu_);
  if (index_loaded_) {
    index_.erase(digest);
  }

  return !ec; // Return true if no error occurred (even if file missing)
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

void CasStore::compact() {
  if (!index_loaded_)
    load_index();

  std::lock_guard<std::mutex> lk(index_mu_);

  const std::string tmp_path = index_path() + ".tmp";
  {
    std::ofstream ofs(tmp_path, std::ios::binary | std::ios::trunc);
    for (const auto &[_, info] : index_) {
      const std::string line =
          "{\"digest\":\"" + info.digest + "\",\"encoding\":\"" +
          info.encoding +
          "\",\"original_size\":" + std::to_string(info.original_size) +
          ",\"stored_size\":" + std::to_string(info.stored_size) +
          ",\"stored_blob_hash\":\"" + info.stored_blob_hash +
          "\",\"created_at\":" + std::to_string(info.created_at_unix_ts) +
          "}\n";
      ofs.write(line.data(), line.size());
    }
  }

  std::error_code ec;
  fs::rename(tmp_path, index_path(), ec);
  if (ec) {
    fs::remove(tmp_path, ec);
  }
}

std::vector<std::string> CasStore::verify_integrity() {
  std::vector<std::string> corrupted;
  auto objects = scan_objects();
  for (const auto &obj : objects) {
    const std::string path = object_path(obj.digest);
    if (!fs::exists(path)) {
      corrupted.push_back(obj.digest);
      continue;
    }
    const std::string actual_hash = hash_file_blake3_hex(path);
    // Note: stored_blob_hash in metadata is the hash of the *encoded*
    // (compressed) blob. For identity encoding, this matches the digest. We
    // verify against the metadata's claim of what the blob hash should be.
    if (actual_hash != obj.stored_blob_hash) {
      corrupted.push_back(obj.digest);
    }
  }
  return corrupted;
}

bool CasStore::repair(const std::string &digest,
                      const ReplicatingBackend &replicator) {
  // 1. Verify object is actually corrupt or missing in this store.
  if (get(digest).has_value()) {
    return true; // Not corrupt, nothing to do.
  }

  // 2. Fetch from the replicating backend.
  auto valid_data = replicator.get(digest);
  if (!valid_data)
    return false; // Not available in replicator either.

  // 3. Put the valid data back into this store.
  return !put(*valid_data).empty();
}

std::vector<CasObjectInfo>
CasStore::scan_objects(size_t limit, const std::string &start_after) const {
  std::vector<CasObjectInfo> out;

  // Optimization: If index is already loaded, use it (it's sorted).
  {
    std::lock_guard<std::mutex> lk(index_mu_);
    if (index_loaded_) {
      auto it = start_after.empty() ? index_.begin()
                                    : index_.upper_bound(start_after);
      while (it != index_.end()) {
        if (limit > 0 && out.size() >= limit)
          break;
        out.push_back(it->second);
        ++it;
      }
      return out;
    }
  }

  // Fallback: Filesystem scan to avoid loading entire index into memory.
  // Structure: objects/AB/CD/<digest>
  // We iterate 00..FF at level 1, then 00..FF at level 2 to maintain sort
  // order.

  auto hex_str = [](int i) {
    std::stringstream ss;
    ss << std::setfill('0') << std::setw(2) << std::hex << i;
    return ss.str();
  };

  fs::path obj_root = fs::path(root_) / "objects";
  if (!fs::exists(obj_root))
    return out;

  // Determine start indices based on start_after digest
  int start_i = 0, start_j = 0;
  if (!start_after.empty() && start_after.size() >= 4) {
    try {
      start_i = std::stoi(start_after.substr(0, 2), nullptr, 16);
      start_j = std::stoi(start_after.substr(2, 2), nullptr, 16);
    } catch (...) {
    }
  }

  for (int i = start_i; i < 256; ++i) {
    std::string dir1 = hex_str(i);
    fs::path p1 = obj_root / dir1;
    if (!fs::exists(p1))
      continue;

    int j_begin = (i == start_i) ? start_j : 0;
    for (int j = j_begin; j < 256; ++j) {
      std::string dir2 = hex_str(j);
      fs::path p2 = p1 / dir2;
      if (!fs::exists(p2))
        continue;

      // Collect files in this bucket
      std::vector<std::string> digests_in_bucket;
      for (const auto &entry : fs::directory_iterator(p2)) {
        if (entry.is_regular_file()) {
          std::string fname = entry.path().filename().string();
          // Skip .meta files, only count objects
          if (fname.size() == 64 && fname.find('.') == std::string::npos) {
            if (fname > start_after) {
              digests_in_bucket.push_back(fname);
            }
          }
        }
      }

      // Sort to ensure deterministic order within bucket
      std::sort(digests_in_bucket.begin(), digests_in_bucket.end());

      for (const auto &d : digests_in_bucket) {
        if (limit > 0 && out.size() >= limit)
          return out;
        auto meta = info(d); // Load metadata on demand
        if (meta)
          out.push_back(*meta);
      }

      if (limit > 0 && out.size() >= limit)
        return out;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// CasGarbageCollector
// ---------------------------------------------------------------------------

CasGarbageCollector::CasGarbageCollector(std::shared_ptr<ICASBackend> backend)
    : backend_(std::move(backend)) {}

size_t CasGarbageCollector::prune(std::chrono::seconds max_age, bool dry_run) {
  size_t deleted_count = 0;
  std::string start_after = "";
  const size_t batch_size = 1000;
  const uint64_t now = static_cast<uint64_t>(std::time(nullptr));
  const uint64_t cutoff = now > static_cast<uint64_t>(max_age.count())
                              ? now - static_cast<uint64_t>(max_age.count())
                              : 0;

  while (true) {
    auto batch = backend_->scan_objects(batch_size, start_after);
    if (batch.empty())
      break;

    for (const auto &obj : batch) {
      // If created_at is 0 (legacy object), we might skip or delete based on
      // policy. Here we assume 0 means "unknown age", so we keep it to be safe.
      if (obj.created_at_unix_ts > 0 && obj.created_at_unix_ts < cutoff) {
        if (!dry_run) {
          backend_->remove(obj.digest);
        }
        deleted_count++;
      }
      start_after = obj.digest;
    }

    if (batch.size() < batch_size)
      break;
  }
  return deleted_count;
}

// ---------------------------------------------------------------------------
// ReplicationManager — internal async write worker
// ---------------------------------------------------------------------------
class ReplicationManager {
public:
  ReplicationManager(std::shared_ptr<ICASBackend> backend,
                     size_t max_queue_size, ReplicationDropPolicy policy)
      : backend_(std::move(backend)), max_queue_size_(max_queue_size),
        policy_(policy) {
    worker_ = std::thread([this] { worker_loop(); });
  }

  ~ReplicationManager() {
    {
      std::lock_guard<std::mutex> lock(mu_);
      stopping_ = true;
    }
    cv_.notify_all();
    cv_capacity_.notify_all();
    if (worker_.joinable())
      worker_.join();
  }

  void enqueue(std::string data, std::string compression) {
    std::unique_lock<std::mutex> lock(mu_);
    if (max_queue_size_ > 0 && queue_.size() >= max_queue_size_) {
      if (policy_ == ReplicationDropPolicy::Block) {
        cv_capacity_.wait(lock, [this] {
          return stopping_ || queue_.size() < max_queue_size_;
        });
        if (stopping_)
          return;
      } else {
        // DropOldest: remove from front to make room
        queue_.pop_front();
      }
    }
    queue_.emplace_back(std::move(data), std::move(compression));
    cv_.notify_one();
  }

private:
  void worker_loop() {
    while (true) {
      std::pair<std::string, std::string> task;
      {
        std::unique_lock<std::mutex> lock(mu_);
        cv_.wait(lock, [this] { return stopping_ || !queue_.empty(); });
        if (stopping_ && queue_.empty())
          return;
        task = std::move(queue_.front());
        queue_.pop_front();
        if (max_queue_size_ > 0)
          cv_capacity_.notify_one();
      }
      backend_->put(task.first, task.second);
    }
  }

  std::shared_ptr<ICASBackend> backend_;
  size_t max_queue_size_;
  ReplicationDropPolicy policy_;
  std::thread worker_;
  std::mutex mu_;
  std::condition_variable cv_;
  std::condition_variable cv_capacity_;
  std::deque<std::pair<std::string, std::string>> queue_;
  bool stopping_{false};
};

// ---------------------------------------------------------------------------
// ReplicatingBackend
// ---------------------------------------------------------------------------

ReplicatingBackend::ReplicatingBackend(std::shared_ptr<ICASBackend> primary,
                                       std::shared_ptr<ICASBackend> secondary,
                                       size_t max_queue_size,
                                       ReplicationDropPolicy policy)
    : primary_(std::move(primary)), secondary_(std::move(secondary)),
      repl_mgr_(std::make_unique<ReplicationManager>(secondary_, max_queue_size,
                                                     policy)) {}

ReplicatingBackend::~ReplicatingBackend() = default;

std::string ReplicatingBackend::backend_id() const { return "replicating"; }

std::string ReplicatingBackend::put(const std::string &data,
                                    const std::string &compression) {
  // Write to primary first (authoritative).
  std::string digest = primary_->put(data, compression);
  if (digest.empty())
    return {};

  // Async replication to secondary.
  repl_mgr_->enqueue(data, compression);

  return digest;
}

std::string ReplicatingBackend::put_stream(std::istream &in,
                                           const std::string &compression) {
  // Write to primary first.
  std::string digest = primary_->put_stream(in, compression);
  if (digest.empty())
    return {};

  // Synchronous replication: read back from primary to write to secondary.
  // We cannot reuse 'in' as it is consumed.
  auto stream = primary_->get_stream(digest);
  if (stream) {
    secondary_->put_stream(*stream, compression);
  }
  return digest;
}

std::optional<std::string>
ReplicatingBackend::get(const std::string &digest) const {
  // Read from primary.
  auto result = primary_->get(digest);
  if (result)
    return result;
  // Fallback to secondary if primary misses.
  return secondary_->get(digest);
}

std::unique_ptr<std::istream>
ReplicatingBackend::get_stream(const std::string &digest) const {
  auto s = primary_->get_stream(digest);
  if (s)
    return s;
  return secondary_->get_stream(digest);
}

bool ReplicatingBackend::remove(const std::string &digest) {
  bool p = primary_->remove(digest);
  bool s = secondary_->remove(digest);
  // Return true if removed from at least one (or both were already gone)
  return p || s;
}

bool ReplicatingBackend::contains(const std::string &digest) const {
  return primary_->contains(digest) || secondary_->contains(digest);
}

std::optional<CasObjectInfo>
ReplicatingBackend::info(const std::string &digest) const {
  auto i = primary_->info(digest);
  if (i)
    return i;
  return secondary_->info(digest);
}

std::vector<CasObjectInfo>
ReplicatingBackend::scan_objects(size_t limit,
                                 const std::string &start_after) const {
  return primary_->scan_objects(limit, start_after);
}

std::size_t ReplicatingBackend::size() const { return primary_->size(); }

bool ReplicatingBackend::verify_replication(const std::string &digest) {
  bool p = primary_->contains(digest);
  bool s = secondary_->contains(digest);

  if (p && s)
    return true;
  if (!p && !s)
    return true; // Consistent (missing in both)

  if (p && !s) {
    // Missing in secondary -> repair from primary
    auto data = primary_->get(digest);
    if (data) {
      secondary_->put(*data, "off");
      return true;
    }
  } else if (!p && s) {
    // Missing in primary -> repair from secondary
    auto data = secondary_->get(digest);
    if (data) {
      primary_->put(*data, "off");
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// ReplicationMonitor
// ---------------------------------------------------------------------------

ReplicationMonitor::ReplicationMonitor(
    std::shared_ptr<ReplicatingBackend> backend,
    std::chrono::milliseconds interval, double sample_rate,
    size_t max_scan_items)
    : backend_(std::move(backend)), interval_(interval),
      sample_rate_(sample_rate), max_scan_items_(max_scan_items) {
  start();
}

ReplicationMonitor::~ReplicationMonitor() { stop(); }

void ReplicationMonitor::start() {
  std::lock_guard<std::mutex> lock(mu_);
  if (worker_.joinable())
    return;
  stopping_ = false;
  worker_ = std::thread([this] { worker_loop(); });
}

void ReplicationMonitor::stop() {
  {
    std::lock_guard<std::mutex> lock(mu_);
    stopping_ = true;
  }
  cv_.notify_all();
  if (worker_.joinable())
    worker_.join();
}

void ReplicationMonitor::worker_loop() {
  std::mt19937 rng(std::random_device{}());
  std::uniform_real_distribution<double> dist(0.0, 1.0);

  while (true) {
    {
      std::unique_lock<std::mutex> lock(mu_);
      cv_.wait_for(lock, interval_, [this] { return stopping_.load(); });
      if (stopping_)
        return;
    }

    auto objects = backend_->scan_objects(max_scan_items_);

    // If limiting scan items, shuffle to ensure uniform coverage over time.
    if (max_scan_items_ > 0 && objects.size() > max_scan_items_) {
      std::shuffle(objects.begin(), objects.end(), rng);
    }

    size_t scanned = 0;
    for (const auto &obj : objects) {
      if (stopping_)
        return;
      if (max_scan_items_ > 0 && scanned >= max_scan_items_)
        break;
      if (dist(rng) < sample_rate_) {
        if (!backend_->verify_replication(obj.digest)) {
          // Attempt self-repair if verification fails.
          auto primary_cas =
              std::dynamic_pointer_cast<CasStore>(backend_->get_primary());
          if (primary_cas) {
            primary_cas->repair(obj.digest, *backend_);
          }
        }
      }
      scanned++;
    }
  }
}

// ---------------------------------------------------------------------------
// S3CompatibleBackend — scaffold (not yet implemented)
// ---------------------------------------------------------------------------
// EXTENSION_POINT: s3_backend_implementation
// See include/requiem/cas.hpp for detailed implementation notes.

S3CompatibleBackend::S3CompatibleBackend(std::string endpoint,
                                         std::string bucket, std::string prefix)
    : endpoint_(std::move(endpoint)), bucket_(std::move(bucket)),
      prefix_(std::move(prefix)) {
  // Simulation: Ensure "bucket" directory exists if endpoint is a local
  // path. In a real implementation, this would initialize the S3 client.
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
    {
      std::ofstream ofs(p, std::ios::binary);
      ofs.write(data.data(), data.size());
      if (!ofs)
        return {};
    }

    // Write metadata sidecar
    fs::path meta = p;
    meta += ".meta";
    std::string stored_hash = blake3_hex(data);
    uint64_t now = static_cast<uint64_t>(std::time(nullptr));
    std::ofstream mofs(meta, std::ios::binary);
    mofs << "{\"digest\":\"" << digest << "\",\"encoding\":\"identity\""
         << ",\"original_size\":" << data.size()
         << ",\"stored_size\":" << data.size() << ",\"stored_blob_hash\":\""
         << stored_hash << "\""
         << ",\"created_at\":" << now << "}";
    return digest;
  }

  // Fallback for non-file endpoints (stub)
  return {};
}

std::string S3CompatibleBackend::put_stream(std::istream &in,
                                            const std::string &compression) {
  // Buffer entire stream and delegate to put().
  std::string buffer((std::istreambuf_iterator<char>(in)),
                     std::istreambuf_iterator<char>());
  return put(buffer, compression);
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

std::unique_ptr<std::istream>
S3CompatibleBackend::get_stream(const std::string &digest) const {
  if (endpoint_.find("file://") == 0) {
    fs::path p = fs::path(endpoint_.substr(7)) / bucket_ / prefix_ / digest;
    if (!fs::exists(p))
      return nullptr;
    return std::make_unique<std::ifstream>(p, std::ios::binary);
  }
  return nullptr;
}

bool S3CompatibleBackend::remove(const std::string &digest) {
  if (endpoint_.find("file://") == 0) {
    fs::path p = fs::path(endpoint_.substr(7)) / bucket_ / prefix_ / digest;
    fs::path meta = p;
    meta += ".meta";

    std::error_code ec;
    bool removed_any = fs::remove(p, ec);
    removed_any |= fs::remove(meta, ec);
    return !ec; // Return true if no error occurred
  }
  return false;
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
  if (endpoint_.find("file://") == 0) {
    fs::path p = fs::path(endpoint_.substr(7)) / bucket_ / prefix_ / digest;
    fs::path meta = p;
    meta += ".meta";

    if (fs::exists(meta)) {
      std::ifstream ifs(meta);
      std::string json((std::istreambuf_iterator<char>(ifs)),
                       std::istreambuf_iterator<char>());
      std::optional<jsonlite::JsonError> err;
      auto obj = jsonlite::parse(json, &err);
      if (!err) {
        CasObjectInfo i;
        i.digest = jsonlite::get_string(obj, "digest", digest);
        i.encoding = jsonlite::get_string(obj, "encoding", "identity");
        i.original_size = jsonlite::get_u64(obj, "original_size", 0);
        i.stored_size = jsonlite::get_u64(obj, "stored_size", 0);
        i.stored_blob_hash = jsonlite::get_string(obj, "stored_blob_hash", "");
        i.created_at_unix_ts = jsonlite::get_u64(obj, "created_at", 0);
        return i;
      }
    }

    // Fallback for objects without metadata
    if (fs::exists(p)) {
      CasObjectInfo i;
      i.digest = digest;
      i.stored_size = fs::file_size(p);
      i.original_size = i.stored_size;
      i.encoding = "identity";
      return i;
    }
  }
  return std::nullopt;
}

std::vector<CasObjectInfo>
S3CompatibleBackend::scan_objects(size_t limit,
                                  const std::string &start_after) const {
  // S3 ListObjectsV2 simulation
  std::vector<CasObjectInfo> out;
  if (endpoint_.find("file://") == 0) {
    fs::path root = fs::path(endpoint_.substr(7)) / bucket_ / prefix_;
    if (fs::exists(root)) {
      for (const auto &entry : fs::recursive_directory_iterator(root)) {
        if (entry.is_regular_file()) {
          const std::string fname = entry.path().filename().string();
          // Skip metadata sidecar files
          if (fname.size() > 5 && fname.substr(fname.size() - 5) == ".meta") {
            continue;
          }
          if (fname <= start_after)
            continue;
          auto i = info(fname);
          if (i)
            out.push_back(*i);
          if (limit > 0 && out.size() >= limit)
            break;
        }
      }
    }
  }
  return out;
}

std::size_t S3CompatibleBackend::size() const { return 0; }

} // namespace requiem
