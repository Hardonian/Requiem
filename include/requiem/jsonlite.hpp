#pragma once

#include <map>
#include <optional>
#include <string>
#include <vector>

namespace requiem::jsonlite {

struct JsonError {
  std::string code;
  std::string message;
};

std::optional<JsonError> validate_strict(const std::string& text);
std::string canonicalize_json(const std::string& text, std::optional<JsonError>* error = nullptr);
std::string hash_json_canonical(const std::string& text, std::optional<JsonError>* error = nullptr);

std::string get_string(const std::string& s, const std::string& key, const std::string& def = "");
bool get_bool(const std::string& s, const std::string& key, bool def = false);
unsigned long long get_u64(const std::string& s, const std::string& key, unsigned long long def = 0);
std::vector<std::string> get_string_array(const std::string& s, const std::string& key);
std::map<std::string, std::string> get_string_map(const std::string& s, const std::string& key);
std::string escape(const std::string& s);

}  // namespace requiem::jsonlite
