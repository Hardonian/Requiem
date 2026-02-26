#include "requiem/cas.hpp"

#include <filesystem>
#include <fstream>

#include <zstd.h>

#include "requiem/hash.hpp"

namespace fs = std::filesystem;

namespace requiem {

namespace {
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
}  // namespace

CasStore::CasStore(std::string root) : root_(std::move(root)) { fs::create_directories(fs::path(root_) / "objects"); }

std::string CasStore::object_path(const std::string& digest) const {
  return (fs::path(root_) / "objects" / digest.substr(0, 2) / digest.substr(2, 2) / digest).string();
}

std::string CasStore::meta_path(const std::string& digest) const { return object_path(digest) + ".meta"; }

std::string CasStore::put(const std::string& data, const std::string& compression) {
  const std::string digest = deterministic_digest(data);
  if (digest.empty()) return {};
  const fs::path target = object_path(digest);
  const fs::path meta = meta_path(digest);
  fs::create_directories(target.parent_path());
  if (fs::exists(target) && fs::exists(meta)) return digest;

  std::string stored = data;
  std::string encoding = "identity";
  if (compression == "zstd") {
    auto c = compress_zstd(data);
    if (!c.empty()) {
      stored = std::move(c);
      encoding = "zstd";
    }
  }

  std::ofstream ofs(target, std::ios::binary | std::ios::trunc);
  ofs.write(stored.data(), static_cast<std::streamsize>(stored.size()));

  const std::string meta_json = "{\"digest\":\"" + digest + "\",\"encoding\":\"" + encoding +
                                "\",\"original_size\":" + std::to_string(data.size()) +
                                ",\"stored_size\":" + std::to_string(stored.size()) +
                                ",\"stored_blob_hash\":\"" + deterministic_digest(stored) + "\"}";
  std::ofstream mfs(meta, std::ios::binary | std::ios::trunc);
  mfs << meta_json;
  return digest;
}

std::optional<CasObjectInfo> CasStore::info(const std::string& digest) const {
  const fs::path mp = meta_path(digest);
  if (!fs::exists(mp)) return std::nullopt;
  std::ifstream ifs(mp, std::ios::binary);
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
  return info;
}

std::optional<std::string> CasStore::get(const std::string& digest) const {
  const fs::path p = object_path(digest);
  if (!fs::exists(p)) return std::nullopt;
  std::ifstream ifs(p, std::ios::binary);
  std::string data((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
  auto meta = info(digest);
  if (!meta) return std::nullopt;
  const auto stored_digest = deterministic_digest(data);
  if (stored_digest.empty() || stored_digest != meta->stored_blob_hash) return std::nullopt;
  if (meta->encoding == "zstd") data = decompress_zstd(data, meta->original_size);
  const auto orig_digest = deterministic_digest(data);
  if (orig_digest.empty() || orig_digest != digest) return std::nullopt;
  return data;
}

bool CasStore::contains(const std::string& digest) const { return fs::exists(object_path(digest)); }

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

}  // namespace requiem
