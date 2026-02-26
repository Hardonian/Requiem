#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

namespace requiem {

struct CasObjectInfo {
  std::string digest;
  std::size_t size{0};
};

class CasStore {
 public:
  explicit CasStore(std::string root = ".requiem/cas");

  std::string put(const std::string& data);
  std::optional<std::string> get(const std::string& digest) const;
  bool contains(const std::string& digest) const;
  std::size_t size() const;
  std::vector<CasObjectInfo> scan_objects() const;

  const std::string& root() const { return root_; }

 private:
  std::string object_path(const std::string& digest) const;
  std::string root_;
};

}  // namespace requiem
