#include "requiem/cas.hpp"

#include "requiem/hash.hpp"

namespace requiem {

std::string CasStore::put(const std::string& data) {
  const std::string digest = deterministic_digest(data);
  objects_.try_emplace(digest, data);
  return digest;
}

std::optional<std::string> CasStore::get(const std::string& digest) const {
  const auto it = objects_.find(digest);
  if (it == objects_.end()) {
    return std::nullopt;
  }
  return it->second;
}

bool CasStore::contains(const std::string& digest) const {
  return objects_.find(digest) != objects_.end();
}

std::size_t CasStore::size() const {
  return objects_.size();
}

}  // namespace requiem
