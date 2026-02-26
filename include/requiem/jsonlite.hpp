#pragma once

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <variant>
#include <vector>

namespace requiem::jsonlite {

struct JsonError {
  std::string code;
  std::string message;
};

// Parsed object types for nested access
struct Value {
  std::variant<std::nullptr_t, bool, std::string, std::uint64_t, double, std::map<std::string, Value>, std::vector<Value>> v;
  Value() : v(nullptr) {}
  template <typename T> Value(T value) : v(std::move(value)) {}
};
using Object = std::map<std::string, Value>;
using Array = std::vector<Value>;

// Full parser and canonicalizer
std::optional<JsonError> validate_strict(const std::string& text);
std::string canonicalize_json(const std::string& text, std::optional<JsonError>* error = nullptr);
std::string hash_json_canonical(const std::string& text, std::optional<JsonError>* error = nullptr);
Object parse(const std::string& text, std::optional<JsonError>* error = nullptr);

// Type-safe extractors from a parsed object
std::string get_string(const Object& obj, const std::string& key, const std::string& def = "");
bool get_bool(const Object& obj, const std::string& key, bool def = false);
unsigned long long get_u64(const Object& obj, const std::string& key, unsigned long long def = 0);
double get_double(const Object& obj, const std::string& key, double def = 0.0);
std::vector<std::string> get_string_array(const Object& obj, const std::string& key);
std::map<std::string, std::string> get_string_map(const Object& obj, const std::string& key);

// DEPRECATED: Regex-based extractors. Avoid use.
std::string get_string(const std::string& s, const std::string& key, const std::string& def = "");
bool get_bool(const std::string& s, const std::string& key, bool def = false);
unsigned long long get_u64(const std::string& s, const std::string& key, unsigned long long def = 0);
double get_double(const std::string& s, const std::string& key, double def = 0.0);
std::vector<std::string> get_string_array(const std::string& s, const std::string& key);
std::map<std::string, std::string> get_string_map(const std::string& s, const std::string& key);

std::string escape(const std::string& s);

}  // namespace requiem::jsonlite
