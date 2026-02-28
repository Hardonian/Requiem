#pragma once

// requiem/cas.hpp — Content-Addressable Storage interface and implementations.
//
// PHASE 3: CAS Hardening + Abstraction
//
// DESIGN INVARIANTS (must not be broken by any implementation):
//   1. CAS key = BLAKE3(original_bytes) ALWAYS — content-addressed, not
//   location-addressed.
//   2. Writes are atomic: tmp+rename on the same filesystem (POSIX rename
//   guarantee).
//   3. Reads verify integrity: stored_blob_hash is checked before returning
//   data.
//   4. Fail-closed: any integrity failure returns empty/nullopt, never
//   corrupted data.
//   5. Deduplication: a second put() of the same content returns the same
//   digest immediately.
//
// EXTENSION_POINT: multi-region_cas_replication
//   Current: single-machine local filesystem (LocalFSBackend).
//   Upgrade path: implement S3CompatibleBackend or GCSBackend that maps the
//   same object_path() hierarchy to cloud storage prefixes. For replication:
//   use a ReplicatingBackend that wraps two ICASBackend instances and writes to
//   both (with rollback on secondary failure). Invariant: the CAS key scheme
//   must never change (BLAKE3, "cas:" domain prefix). Changing it would
//   invalidate all existing stored objects without migration.

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
};

// ---------------------------------------------------------------------------
// ICASBackend — abstract storage backend interface
// ---------------------------------------------------------------------------
// All CAS operations go through this interface, enabling transparent backend
// substitution (local FS, S3, GCS, Redis, etc.).
//
// Thread-safety: all implementations MUST be safe for concurrent calls.
// The LocalFSBackend relies on atomic rename() for write safety.
//
// EXTENSION_POINT: multi-region_cas_replication
class ICASBackend {
public:
  virtual ~ICASBackend() = default;

  // Store data. Returns the content digest on success, "" on failure.
  // compression: "off" (identity) or "zstd" (if built with REQUIEM_WITH_ZSTD).
  // Idempotent: returns existing digest if content already stored.
  virtual std::string put(const std::string &data,
                          const std::string &compression = "off") = 0;

  // Retrieve data by digest. Returns nullopt if not found or integrity fails.
  virtual std::optional<std::string> get(const std::string &digest) const = 0;

  // Check existence without loading data.
  virtual bool contains(const std::string &digest) const = 0;

  // Get object metadata without loading the blob.
  virtual std::optional<CasObjectInfo>
  info(const std::string &digest) const = 0;

  // Enumerate all stored objects.
  virtual std::vector<CasObjectInfo> scan_objects() const = 0;

  // Total number of stored objects.
  virtual std::size_t size() const = 0;

  // Human-readable backend identifier for diagnostics.
  virtual std::string backend_id() const = 0;
};

// ---------------------------------------------------------------------------
// CasStore — LocalFSBackend implementation
// ---------------------------------------------------------------------------
// Stores objects as sharded files under:
//   <root>/objects/AB/CD/<full-64-char-digest>
//   <root>/objects/AB/CD/<full-64-char-digest>.meta
//
// The 2-level sharding (AB/CD) limits directory entry counts per node,
// keeping readdir() O(1) at typical scales (<64k objects per shard pair).
//
// EXTENSION_POINT: append_only_journal
//   Current: individual files per object (random-write, no journal).
//   Upgrade path: add a journal file (<root>/journal.bin) that logs each put()
//   as an append with a CRC32 record. On startup, replay the journal to recover
//   any objects whose final rename did not complete.
//   Invariant: journal must not be the authoritative store — objects/ directory
//   is the source of truth. Journal is for crash recovery only.
class CasStore : public ICASBackend {
public:
  explicit CasStore(std::string root = ".requiem/cas/v2");

  std::string put(const std::string &data,
                  const std::string &compression = "off") override;
  std::optional<std::string> get(const std::string &digest) const override;
  std::optional<CasObjectInfo> info(const std::string &digest) const override;
  bool contains(const std::string &digest) const override;
  std::size_t size() const override;
  std::vector<CasObjectInfo> scan_objects() const override;
  std::string backend_id() const override { return "local_fs"; }

  const std::string &root() const { return root_; }

private:
  std::string root_;
  mutable std::mutex index_mu_;
  mutable std::map<std::string, CasObjectInfo> index_;
  mutable bool index_loaded_{false};
  void load_index() const;
  void save_index_entry(const CasObjectInfo &info) const;
};

// ---------------------------------------------------------------------------
// S3CompatibleBackend — scaffold (not yet implemented)
// ---------------------------------------------------------------------------
// EXTENSION_POINT: s3_backend_implementation
//
// Design notes for future implementer:
//   - Map object_path() hierarchy to s3://bucket/prefix/AB/CD/ABCDEF...
//   - Use conditional PutObject (x-amz-copy-source-if-none-match) for
//   atomicity.
//   - Use multipart upload for objects > 5MB (ZSTD-compressed blobs).
//   - Metadata stored as S3 object tags or a separate .meta object.
//   - Integrity: verify ETag (MD5) on small objects; use SHA256 for larger
//   ones.
//   - Thread-safety: AWS SDK is thread-safe per-client; use a shared client.
//
// Invariants from ICASBackend that must be preserved:
//   1. CAS key = BLAKE3(original_bytes) — never use S3's ETag as the CAS key.
//   2. Reads must verify stored_blob_hash before returning.
//   3. put() must be idempotent — HEAD the object before uploading.
//
// To activate: set REQUIEM_CAS_BACKEND=s3 and configure
// endpoint/bucket/credentials.
class S3CompatibleBackend : public ICASBackend {
public:
  // endpoint: e.g. "https://s3.amazonaws.com" or "http://localhost:9000"
  // (MinIO) bucket: S3 bucket name prefix: object key prefix (e.g. "cas/v2/")
  S3CompatibleBackend(std::string endpoint, std::string bucket,
                      std::string prefix = "cas/v2/");

  // All methods return error/empty — not yet implemented.
  // Replace with real AWS SDK calls when activating.
  std::string put(const std::string & /*data*/,
                  const std::string & /*compression*/ = "off") override;
  std::optional<std::string> get(const std::string & /*digest*/) const override;
  bool contains(const std::string & /*digest*/) const override;
  std::optional<CasObjectInfo>
  info(const std::string & /*digest*/) const override;
  std::vector<CasObjectInfo> scan_objects() const override;
  std::size_t size() const override;
  std::string backend_id() const override { return "s3_scaffold"; }

private:
  std::string endpoint_;
  std::string bucket_;
  std::string prefix_;
};

} // namespace requiem
