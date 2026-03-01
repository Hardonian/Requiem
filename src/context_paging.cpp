#include "requiem/context_paging.hpp"

#include <algorithm>
#include <optional>
#include <sstream>

#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

namespace requiem {

ContextPager::ContextPager(std::shared_ptr<CasStore> cas)
    : cas_(std::move(cas)) {}

std::string ContextPager::virtualize(const std::string &full_context,
                                     size_t page_size) {
  if (full_context.empty())
    return "";

  PageManifest manifest;
  manifest.total_size = full_context.size();

  size_t current_offset = 0;
  while (current_offset < full_context.size()) {
    size_t chunk_len =
        std::min(page_size, full_context.size() - current_offset);
    std::string chunk_data = full_context.substr(current_offset, chunk_len);

    // Store chunk in CAS.
    // In a production environment, we would enable compression here.
    std::string chunk_digest = cas_->put(chunk_data, "identity");
    if (chunk_digest.empty()) {
      return ""; // CAS write failure
    }

    manifest.chunks.push_back({chunk_digest, chunk_len, current_offset});
    current_offset += chunk_len;
  }

  // Serialize Manifest to JSON
  std::ostringstream oss;
  oss << "{\"type\":\"context_manifest\",\"total_size\":" << manifest.total_size
      << ",\"chunks\":[";
  for (size_t i = 0; i < manifest.chunks.size(); ++i) {
    const auto &c = manifest.chunks[i];
    oss << "{\"d\":\"" << c.digest << "\",\"s\":" << c.size
        << ",\"o\":" << c.offset << "}";
    if (i < manifest.chunks.size() - 1)
      oss << ",";
  }
  oss << "]}";

  // Store the manifest itself in CAS.
  // The returned digest is the handle for the entire virtual context.
  return cas_->put(oss.str(), "identity");
}

std::optional<std::string>
ContextPager::recall(const std::string &manifest_digest, size_t offset,
                     size_t length) {
  auto manifest_data = cas_->get(manifest_digest);
  if (!manifest_data)
    return std::nullopt;

  const std::string &m = *manifest_data;
  if (m.find("\"type\":\"context_manifest\"") == std::string::npos) {
    return std::nullopt; // Invalid manifest type
  }

  // Parse manifest using jsonlite
  std::optional<jsonlite::JsonError> err;
  const auto root = jsonlite::parse(m, &err);
  if (err) {
    return std::nullopt;
  }

  auto chunks_it = root.find("chunks");
  if (chunks_it == root.end() ||
      !std::holds_alternative<jsonlite::Array>(chunks_it->second.v)) {
    return std::nullopt;
  }
  const auto &chunks_arr = std::get<jsonlite::Array>(chunks_it->second.v);

  std::string result;
  result.resize(length, '\0');

  for (const auto &chunk_val : chunks_arr) {
    if (!std::holds_alternative<jsonlite::Object>(chunk_val.v))
      continue;
    const auto &c_obj = std::get<jsonlite::Object>(chunk_val.v);

    std::string digest = jsonlite::get_string(c_obj, "d");
    size_t size = jsonlite::get_u64(c_obj, "s");
    size_t chunk_offset = jsonlite::get_u64(c_obj, "o");

    size_t req_start = offset;
    size_t req_end = offset + length;
    size_t chunk_end = chunk_offset + size;

    size_t overlap_start = std::max(req_start, chunk_offset);
    size_t overlap_end = std::min(req_end, chunk_end);

    if (overlap_start < overlap_end) {
      size_t overlap_len = overlap_end - overlap_start;
      size_t read_start = overlap_start - chunk_offset;
      size_t write_start = overlap_start - req_start;

      auto stream = cas_->get_stream(digest);
      if (stream) {
        stream->seekg(static_cast<std::streamoff>(read_start));
        if (!stream->good()) {
          // seekg failed (non-seekable stream) — skip chunk, leave zeros
          continue;
        }
        stream->read(&result[write_start],
                     static_cast<std::streamsize>(overlap_len));
        if (stream->gcount() != static_cast<std::streamsize>(overlap_len)) {
          // Partial read: CAS object shorter than manifest advertises.
          // Zero out the unread tail to avoid leaking stale data.
          size_t actually_read = static_cast<size_t>(stream->gcount());
          std::fill_n(&result[write_start + actually_read],
                      overlap_len - actually_read, '\0');
        }
      }
      // If stream is missing, we leave zeros (default resize behavior),
      // matching the behavior of test_missing_cas_object.
    }
  }

  return result;
}

} // namespace requiem
