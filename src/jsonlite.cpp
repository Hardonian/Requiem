#include "requiem/jsonlite.hpp"

#include <cctype>
#include <cstdint>
#include <iomanip>
#include <map>
#include <regex>
#include <sstream>
#include <variant>

#include "requiem/hash.hpp"

namespace requiem::jsonlite {

namespace {

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
        else if (n == 't') o += '\t';
        else if (n == 'r') o += '\r';
        else if (n == 'b') o += '\b';
        else if (n == 'f') o += '\f';
        else o += n;
      } else {
        o += c;
      }
    }
    err = JsonError{"json_parse_error", "unterminated string"};
    return {};
  }

  // Parse a number - returns true if successful, sets out_value
  bool parse_number(Value& out_val) {
    ws();
    size_t start = i;
    
    // Check for NaN/Infinity
    if (s.compare(i, 3, "NaN") == 0 || s.compare(i, 8, "Infinity") == 0 || s.compare(i, 9, "-Infinity") == 0) {
      err = JsonError{"json_parse_error", "NaN/Infinity unsupported"};
      return false;
    }
    
    // Optional minus
    if (i < s.size() && s[i] == '-') ++i;
    
    // Must have at least one digit
    if (i >= s.size() || !std::isdigit(static_cast<unsigned char>(s[i]))) {
      return false;
    }
    
    // Integer part
    while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) ++i;
    
    // Fractional part
    bool has_frac = false;
    if (i < s.size() && s[i] == '.') {
      has_frac = true;
      ++i;
      if (i >= s.size() || !std::isdigit(static_cast<unsigned char>(s[i]))) {
        err = JsonError{"json_parse_error", "invalid number format"};
        return false;
      }
      while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) ++i;
    }
    
    // Exponent part
    bool has_exp = false;
    if (i < s.size() && (s[i] == 'e' || s[i] == 'E')) {
      has_exp = true;
      ++i;
      if (i < s.size() && (s[i] == '+' || s[i] == '-')) ++i;
      if (i >= s.size() || !std::isdigit(static_cast<unsigned char>(s[i]))) {
        err = JsonError{"json_parse_error", "invalid exponent"};
        return false;
      }
      while (i < s.size() && std::isdigit(static_cast<unsigned char>(s[i]))) ++i;
    }
    
    std::string num_str = s.substr(start, i - start);
    
    // If it has fractional part or exponent, parse as double
    if (has_frac || has_exp) {
      try {
        out_val = Value{std::stod(num_str)};
        return true;
      } catch (...) {
        err = JsonError{"json_parse_error", "invalid floating point"};
        return false;
      }
    } else {
      // Integer - try u64 first, then double if too large
      try {
        // Check for negative
        if (num_str[0] == '-') {
          // Negative integer - store as double to preserve sign
          out_val = Value{std::stod(num_str)};
        } else {
          out_val = Value{std::stoull(num_str)};
        }
        return true;
      } catch (...) {
        err = JsonError{"json_parse_error", "invalid integer"};
        return false;
      }
    }
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
    // Try to parse as number
    Value num_val;
    if (parse_number(num_val)) {
      return num_val;
    }
    if (!err) err = JsonError{"json_parse_error", "unexpected token"};
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
    else if (c == '\\') o += "\\\\";
    else if (c == '\b') o += "\\b";
    else if (c == '\f') o += "\\f";
    else if (c == '\n') o += "\\n";
    else if (c == '\r') o += "\\r";
    else if (c == '\t') o += "\\t";
    else o += c;
  }
  return o;
}

// Format double for canonical JSON - must be deterministic
std::string format_double(double d) {
  std::ostringstream oss;
  oss << std::fixed << std::setprecision(6);
  oss << d;
  std::string result = oss.str();
  // Trim trailing zeros and possibly trailing decimal point
  while (!result.empty() && result.back() == '0') result.pop_back();
  if (!result.empty() && result.back() == '.') result.push_back('0');
  return result;
}

std::string to_json(const Value& v) {
  if (std::holds_alternative<std::nullptr_t>(v.v)) return "null";
  if (std::holds_alternative<bool>(v.v)) return std::get<bool>(v.v) ? "true" : "false";
  if (std::holds_alternative<std::string>(v.v)) return "\"" + escape_inner(std::get<std::string>(v.v)) + "\"";
  if (std::holds_alternative<std::uint64_t>(v.v)) return std::to_string(std::get<std::uint64_t>(v.v));
  if (std::holds_alternative<double>(v.v)) return format_double(std::get<double>(v.v));
  if (std::holds_alternative<Object>(v.v)) {
    std::ostringstream oss; oss << "{"; bool first = true;
    for (const auto& [k, vv] : std::get<Object>(v.v)) { if (!first) oss << ","; first = false; oss << "\"" << escape_inner(k) << "\"" << ":" << to_json(vv); }
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

Object parse(const std::string& text, std::optional<JsonError>* error) {
  Parser p{text};
  auto v = p.parse_value();
  p.ws();
  if (!p.err && p.i != text.size()) p.err = JsonError{"json_parse_error", "trailing data"};
  if (error) *error = p.err;
  if (p.err || !std::holds_alternative<Object>(v.v)) return {};
  return std::get<Object>(v.v);
}

// Type-safe extractors
std::string get_string(const Object& obj, const std::string& key, const std::string& def) {
  auto it = obj.find(key);
  if (it == obj.end() || !std::holds_alternative<std::string>(it->second.v)) return def;
  return std::get<std::string>(it->second.v);
}
bool get_bool(const Object& obj, const std::string& key, bool def) {
  auto it = obj.find(key);
  if (it == obj.end() || !std::holds_alternative<bool>(it->second.v)) return def;
  return std::get<bool>(it->second.v);
}
unsigned long long get_u64(const Object& obj, const std::string& key, unsigned long long def) {
  auto it = obj.find(key);
  if (it == obj.end() || !std::holds_alternative<std::uint64_t>(it->second.v)) return def;
  return std::get<std::uint64_t>(it->second.v);
}
double get_double(const Object& obj, const std::string& key, double def) {
  auto it = obj.find(key);
  if (it == obj.end()) return def;
  if (std::holds_alternative<double>(it->second.v)) return std::get<double>(it->second.v);
  if (std::holds_alternative<std::uint64_t>(it->second.v)) return static_cast<double>(std::get<std::uint64_t>(it->second.v));
  return def;
}
std::vector<std::string> get_string_array(const Object& obj, const std::string& key) {
  std::vector<std::string> out;
  auto it = obj.find(key);
  if (it == obj.end() || !std::holds_alternative<Array>(it->second.v)) return out;
  for (const auto& item : std::get<Array>(it->second.v)) {
    if (std::holds_alternative<std::string>(item.v)) {
      out.push_back(std::get<std::string>(item.v));
    }
  }
  return out;
}
std::map<std::string, std::string> get_string_map(const Object& obj, const std::string& key) {
  std::map<std::string, std::string> out;
  auto it = obj.find(key);
  if (it == obj.end() || !std::holds_alternative<Object>(it->second.v)) return out;
  for (const auto& [k, v] : std::get<Object>(it->second.v)) {
    if (std::holds_alternative<std::string>(v.v)) {
      out[k] = std::get<std::string>(v.v);
    }
  }
  return out;
}

std::string escape(const std::string& s) { return escape_inner(s); }

// DEPRECATED: Regex-based extractors. Avoid use.
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
double get_double(const std::string& s, const std::string& key, double def) {
  std::regex re("\\\"" + key + "\\\"\\s*:\\s*(-?[0-9]+\\.?[0-9]*(?:[eE][+-]?[0-9]+)?)");
  std::smatch m;
  return std::regex_search(s, m, re) ? std::stod(m[1].str()) : def;
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
