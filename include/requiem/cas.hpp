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
};

class CasStore {
 public:
  explicit CasStore(std::string root = ".requiem/cas/v2");

  std::string put(const std::string& data, const std::string& compression = "off");
  std::optional<std::string> get(const std::string& digest) const;
  std::optional<CasObjectInfo> info(const std::string& digest) const;
  bool contains(const std::string& digest) const;
  std::size_t size() const;
  std::vector<CasObjectInfo> scan_objects() const;

  const std::string& root() const { return root_; }

 private:
  std::string object_path(const std::string& digest) const;
  std::string meta_path(const std::string& digest) const;
  std::string root_;
};

}  // namespace requiem
