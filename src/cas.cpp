#include "requiem/cas.hpp"

#include <filesystem>
#include <fstream>

#include "requiem/hash.hpp"

namespace fs = std::filesystem;

namespace requiem {

CasStore::CasStore(std::string root) : root_(std::move(root)) {
  fs::create_directories(fs::path(root_) / "objects");
}

std::string CasStore::object_path(const std::string& digest) const {
  if (digest.size() < 4) {
    return (fs::path(root_) / "objects" / "invalid" / digest).string();
  }
  return (fs::path(root_) / "objects" / digest.substr(0, 2) / digest.substr(2, 2) / digest).string();
}

std::string CasStore::put(const std::string& data) {
  const std::string digest = deterministic_digest(data);
  const fs::path target = object_path(digest);
  fs::create_directories(target.parent_path());
  if (fs::exists(target)) {
    return digest;
  }

  const fs::path tmp = target.string() + ".tmp";
  {
    std::ofstream ofs(tmp, std::ios::binary | std::ios::trunc);
    ofs.write(data.data(), static_cast<std::streamsize>(data.size()));
    ofs.flush();
  }

  std::error_code ec;
  fs::rename(tmp, target, ec);
  if (ec && !fs::exists(target)) {
    fs::remove(tmp);
    return "";
  }

  auto stored = get(digest);
  if (!stored || deterministic_digest(*stored) != digest) {
    fs::remove(target);
    return "";
  }
  return digest;
}

std::optional<std::string> CasStore::get(const std::string& digest) const {
  const fs::path p = object_path(digest);
  if (!fs::exists(p)) {
    return std::nullopt;
  }
  std::ifstream ifs(p, std::ios::binary);
  std::string data((std::istreambuf_iterator<char>(ifs)), std::istreambuf_iterator<char>());
  return data;
}

bool CasStore::contains(const std::string& digest) const {
  return fs::exists(object_path(digest));
}

std::size_t CasStore::size() const {
  return scan_objects().size();
}

std::vector<CasObjectInfo> CasStore::scan_objects() const {
  std::vector<CasObjectInfo> out;
  const fs::path root = fs::path(root_) / "objects";
  if (!fs::exists(root)) {
    return out;
  }
  for (auto const& entry : fs::recursive_directory_iterator(root)) {
    if (!entry.is_regular_file()) continue;
    const std::string digest = entry.path().filename().string();
    if (digest.size() < 8 || entry.path().extension() == ".tmp") continue;
    out.push_back({digest, static_cast<std::size_t>(entry.file_size())});
  }
  return out;
}

}  // namespace requiem
