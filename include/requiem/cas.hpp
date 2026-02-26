#pragma once

#include <optional>
#include <string>
#include <unordered_map>

namespace requiem {

class CasStore {
 public:
  std::string put(const std::string& data);
  std::optional<std::string> get(const std::string& digest) const;
  bool contains(const std::string& digest) const;
  std::size_t size() const;

 private:
  std::unordered_map<std::string, std::string> objects_;
};

}  // namespace requiem
