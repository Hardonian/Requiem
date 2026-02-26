#include "requiem/jsonlite.hpp"

#include <cctype>
#include <cstdint>
#include <map>
#include <regex>
#include <sstream>
#include <variant>

#include "requiem/hash.hpp"

namespace requiem::jsonlite {

namespace {
struct Value;
using Object = std::map<std::string, Value>;
using Array = std::vector<Value>;
struct Value {
  std::variant<std::nullptr_t, bool, std::string, std::uint64_t, Object, Array> v;
  Value() : v(nullptr) {}
  template <typename T> Value(T value) : v(std::move(value)) {}
};

struct Parser {
  const std::string& s;
  size_t i{0};
  std::optional<JsonError> err;

  void ws() { while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i]))) ++i; }
  bool eat(char c) { ws(); if (i < s.size() && s[i] == c) { ++i; return true; } return false; }

  std::string parse_string() {
    if (!eat('"')) return {};
    std::string o;
    while (i < s.size()) {
      char c = s[i++];
      if (c == '"') return o;
      if (c == '\\' && i < s.size()) {
        char n = s[i++];
        if (n == 'n') o += '\n';
        else o += n;
      } else {
        o += c;
      }
    }
    err = JsonError{"json_parse_error", "unterminated string"};
    return {};
  }

  std::uint64_t parse_num() {
    ws();
    if (s.compare(i, 3, "NaN") == 0 || s.compare(i, 8, "Infinity") == 0) {
      err = JsonError{"json_parse_error", "NaN/Infinity unsupported"};
      return 0;
    }
    size_t j = i;
    while (j < s.size() && std::isdigit(static_cast<unsigned char>(s[j]))) ++j;
    if (j == i) { err = JsonError{"json_parse_error", "invalid number"}; return 0; }
    auto v = std::stoull(s.substr(i, j - i));
    i = j;
    return v;
  }

  Value parse_value() {
    ws();
    if (i >= s.size()) { err = JsonError{"json_parse_error", "unexpected eof"}; return {}; }
    if (s[i] == '{') return Value{parse_object()};
    if (s[i] == '[') return Value{parse_array()};
    if (s[i] == '"') return Value{parse_string()};
    if (s.compare(i, 4, "true") == 0) { i += 4; return Value{true}; }
    if (s.compare(i, 5, "false") == 0) { i += 5; return Value{false}; }
    if (s.compare(i, 4, "null") == 0) { i += 4; return Value{nullptr}; }
    if (std::isdigit(static_cast<unsigned char>(s[i]))) return Value{parse_num()};
    err = JsonError{"json_parse_error", "unexpected token"};
    return {};
  }

  Object parse_object() {
    Object out;
    eat('{');
    ws();
    if (eat('}')) return out;
    while (!err) {
      auto k = parse_string();
      if (err) break;
      if (out.contains(k)) { err = JsonError{"json_duplicate_key", "duplicate key: " + k}; break; }
      if (!eat(':')) { err = JsonError{"json_parse_error", "expected :"}; break; }
      out[k] = parse_value();
      if (err) break;
      if (eat('}')) break;
      if (!eat(',')) { err = JsonError{"json_parse_error", "expected ,"}; break; }
    }
    return out;
  }

  Array parse_array() {
    Array out;
    eat('[');
    ws();
    if (eat(']')) return out;
    while (!err) {
      out.push_back(parse_value());
      if (err) break;
      if (eat(']')) break;
      if (!eat(',')) { err = JsonError{"json_parse_error", "expected ,"}; break; }
    }
    return out;
  }
};

std::string to_json(const Value& v);
std::string escape_inner(const std::string& s) {
  std::string o;
  for (char c : s) {
    if (c == '"') o += "\\\"";
    else if (c == '\n') o += "\\n";
    else if (c == '\\') o += "\\\\";
    else o += c;
  }
  return o;
}

std::string to_json(const Value& v) {
  if (std::holds_alternative<std::nullptr_t>(v.v)) return "null";
  if (std::holds_alternative<bool>(v.v)) return std::get<bool>(v.v) ? "true" : "false";
  if (std::holds_alternative<std::string>(v.v)) return "\"" + escape_inner(std::get<std::string>(v.v)) + "\"";
  if (std::holds_alternative<std::uint64_t>(v.v)) return std::to_string(std::get<std::uint64_t>(v.v));
  if (std::holds_alternative<Object>(v.v)) {
    std::ostringstream oss; oss << "{"; bool first = true;
    for (const auto& [k, vv] : std::get<Object>(v.v)) { if (!first) oss << ","; first = false; oss << "\"" << escape_inner(k) << "\":" << to_json(vv); }
    oss << "}"; return oss.str();
  }
  std::ostringstream oss; oss << "["; bool first = true;
  for (const auto& vv : std::get<Array>(v.v)) { if (!first) oss << ","; first = false; oss << to_json(vv); }
  oss << "]"; return oss.str();
}
}  // namespace

std::optional<JsonError> validate_strict(const std::string& text) {
  Parser p{text};
  auto v = p.parse_value();
  (void)v;
  p.ws();
  if (!p.err && p.i != text.size()) p.err = JsonError{"json_parse_error", "trailing data"};
  return p.err;
}

std::string canonicalize_json(const std::string& text, std::optional<JsonError>* error) {
  Parser p{text};
  auto v = p.parse_value();
  p.ws();
  if (!p.err && p.i != text.size()) p.err = JsonError{"json_parse_error", "trailing data"};
  if (error) *error = p.err;
  if (p.err) return {};
  return to_json(v);
}

std::string hash_json_canonical(const std::string& text, std::optional<JsonError>* error) {
  auto c = canonicalize_json(text, error);
  if (c.empty()) return {};
  return deterministic_digest(c);
}

std::string escape(const std::string& s) { return escape_inner(s); }

// Compatibility extractors (for fixed schema inputs).
std::string get_string(const std::string& s, const std::string& key, const std::string& def) {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
  std::smatch m;
  return std::regex_search(s, m, re) ? m[1].str() : def;
}
bool get_bool(const std::string& s, const std::string& key, bool def) {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*(true|false)");
  std::smatch m;
  return std::regex_search(s, m, re) ? m[1].str() == "true" : def;
}
unsigned long long get_u64(const std::string& s, const std::string& key, unsigned long long def) {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*([0-9]+)");
  std::smatch m;
  return std::regex_search(s, m, re) ? std::stoull(m[1].str()) : def;
}
std::vector<std::string> get_string_array(const std::string& s, const std::string& key) {
  std::vector<std::string> out;
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\[([^\\]]*)\\]");
  std::smatch m;
  if (!std::regex_search(s, m, re)) return out;
  std::regex item("\\\"([^\\\"]*)\\\"");
  for (auto it = std::sregex_iterator(m[1].first, m[1].second, item); it != std::sregex_iterator(); ++it) out.push_back((*it)[1].str());
  return out;
}
std::map<std::string, std::string> get_string_map(const std::string& s, const std::string& key) {
  std::map<std::string, std::string> out;
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*\\{([^\\}]*)\\}");
  std::smatch m;
  if (!std::regex_search(s, m, re)) return out;
  std::regex item("\\\"([^\\\"]*)\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
  for (auto it = std::sregex_iterator(m[1].first, m[1].second, item); it != std::sregex_iterator(); ++it) out[(*it)[1].str()] = (*it)[2].str();
  return out;
}

}  // namespace requiem::jsonlite
