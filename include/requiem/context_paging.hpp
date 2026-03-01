#pragma once

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "requiem/cas.hpp"

namespace requiem {

/**
 * PageManifest represents the virtualized structure of a large context window.
 * Stored in CAS as a JSON manifest to enable random access retrieval.
 */
struct PageManifest {
  struct Chunk {
    std::string digest;
    size_t size;
    size_t offset; // Logical offset in the virtual context
  };
  std::vector<Chunk> chunks;
  size_t total_size;
};

/**
 * ContextPager manages virtualization and recall of large contexts.
 * It shards large payloads into CAS chunks and stiches them back on demand.
 */
class ContextPager {
public:
  explicit ContextPager(std::shared_ptr<CasStore> cas);

  /**
   * Virtualizes a large context string into CAS chunks.
   * Returns the manifest digest (the \"Virtual Context ID\").
   */
  std::string virtualize(const std::string &full_context,
                         size_t page_size = 4096);

  /**
   * Recalls a specific slice of the virtual context from CAS.
   * Automatically fetches and stitches required chunks.
   */
  std::optional<std::string> recall(const std::string &manifest_digest,
                                    size_t offset, size_t length);

private:
  std::shared_ptr<CasStore> cas_;
};

} // namespace requiem
