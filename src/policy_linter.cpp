#include "requiem/policy_linter.hpp"

#include <algorithm>
#include <cctype>
#include <iostream>
#include <sstream>
#include <stdexcept>

namespace requiem {

LintResult PolicyLinter::Check(const PolicyRegistry &registry) {
  LintResult result{true, {}, {}};

  // 1. Check for self-contradictory policies
  // A policy is self-contradictory if it maps to two constraints that conflict.
  for (const auto &policy_name : registry.policies) {
    if (registry.mapping.find(policy_name) == registry.mapping.end())
      continue;

    const auto &constraints = registry.mapping.at(policy_name);

    for (const auto &conflict : registry.conflicts) {
      bool has_first = std::find(constraints.begin(), constraints.end(),
                                 conflict.first) != constraints.end();
      bool has_second = std::find(constraints.begin(), constraints.end(),
                                  conflict.second) != constraints.end();

      if (has_first && has_second) {
        result.valid = false;
        std::stringstream ss;
        ss << "Policy '" << policy_name
           << "' is self-contradictory: implies conflicting constraints '"
           << conflict.first << "' and '" << conflict.second << "'";
        result.errors.push_back(ss.str());
      }
    }
  }

  // 2. Check for unreachable configurations (mutually exclusive policies)
  // If Policy A implies C1, and Policy B implies C2, and (C1, C2) conflict,
  // then {A, B} is unreachable.
  for (size_t i = 0; i < registry.policies.size(); ++i) {
    for (size_t j = i + 1; j < registry.policies.size(); ++j) {
      const auto &p1 = registry.policies[i];
      const auto &p2 = registry.policies[j];

      if (registry.mapping.count(p1) == 0 || registry.mapping.count(p2) == 0)
        continue;

      const auto &c1_set = registry.mapping.at(p1);
      const auto &c2_set = registry.mapping.at(p2);

      for (const auto &conflict : registry.conflicts) {
        bool p1_has_first = std::find(c1_set.begin(), c1_set.end(),
                                      conflict.first) != c1_set.end();
        bool p1_has_second = std::find(c1_set.begin(), c1_set.end(),
                                       conflict.second) != c1_set.end();

        bool p2_has_first = std::find(c2_set.begin(), c2_set.end(),
                                      conflict.first) != c2_set.end();
        bool p2_has_second = std::find(c2_set.begin(), c2_set.end(),
                                       conflict.second) != c2_set.end();

        if ((p1_has_first && p2_has_second) ||
            (p1_has_second && p2_has_first)) {
          std::stringstream ss;
          ss << "Configuration { " << p1 << ", " << p2
             << " } is unreachable due to conflict: " << conflict.first
             << " vs " << conflict.second;
          result.warnings.push_back(ss.str());
        }
      }
    }
  }

  return result;
}

namespace {

// Minimal JSON cursor for parsing the specific PolicyRegistry schema.
// Not a full generic JSON parser.
class JsonCursor {
public:
  explicit JsonCursor(const std::string &json) : json_(json), pos_(0) {
    skip_ws();
  }

  char peek() {
    skip_ws();
    if (pos_ >= json_.size())
      return 0;
    return json_[pos_];
  }

  bool consume(char c) {
    if (peek() == c) {
      pos_++;
      return true;
    }
    return false;
  }

  void expect(char c) {
    if (!consume(c)) {
      throw std::runtime_error(std::string("Expected '") + c + "' at pos " +
                               std::to_string(pos_));
    }
  }

  std::string parse_string() {
    expect('"');
    std::string res;
    while (pos_ < json_.size()) {
      char c = json_[pos_++];
      if (c == '"') {
        return res;
      }
      if (c == '\\') {
        if (pos_ < json_.size()) {
          res += json_[pos_++]; // Simple escape handling
        }
      } else {
        res += c;
      }
    }
    throw std::runtime_error("Unterminated string");
  }

  std::vector<std::string> parse_string_array() {
    std::vector<std::string> res;
    expect('[');
    while (peek() != ']') {
      res.push_back(parse_string());
      if (peek() == ',')
        consume(',');
    }
    expect(']');
    return res;
  }

private:
  void skip_ws() {
    while (pos_ < json_.size() &&
           (std::isspace(static_cast<unsigned char>(json_[pos_])) ||
            json_[pos_] == ',' || json_[pos_] == ':')) {
      pos_++;
    }
  }

  const std::string &json_;
  size_t pos_;
};

} // namespace

PolicyRegistry PolicyLinter::LoadFromJson(const std::string &json_content) {
  PolicyRegistry reg;
  JsonCursor cursor(json_content);

  cursor.expect('{');

  while (cursor.peek() != '}' && cursor.peek() != 0) {
    std::string key = cursor.parse_string();

    if (key == "policies") {
      reg.policies = cursor.parse_string_array();
    } else if (key == "constraints") {
      reg.constraints = cursor.parse_string_array();
    } else if (key == "map") {
      cursor.expect('{');
      while (cursor.peek() != '}') {
        std::string map_key = cursor.parse_string();
        reg.mapping[map_key] = cursor.parse_string_array();
        if (cursor.peek() == ',')
          cursor.consume(',');
      }
      cursor.expect('}');
    } else if (key == "conflicts") {
      cursor.expect('[');
      while (cursor.peek() != ']') {
        // Conflicts are arrays of strings ["a", "b"]
        std::vector<std::string> pair = cursor.parse_string_array();
        if (pair.size() >= 2) {
          reg.conflicts.push_back({pair[0], pair[1]});
        }
        if (cursor.peek() == ',')
          cursor.consume(',');
      }
      cursor.expect(']');
    } else {
      // Skip unknown fields (simple skip: assume string or array of strings)
      // For safety in this minimal parser, we just throw if unknown structure
      // appears, or we could try to skip. Given the controlled input, we'll
      // just parse value as string or array and ignore.
      char c = cursor.peek();
      if (c == '[')
        cursor.parse_string_array();
      else if (c == '"')
        cursor.parse_string();
      else if (c == '{') {
        // Skip object not supported in this minimal version for unknown keys
        throw std::runtime_error("Unknown object key: " + key);
      } else {
        // Numbers/bools not supported
        throw std::runtime_error("Unknown value type for key: " + key);
      }
    }

    if (cursor.peek() == ',')
      cursor.consume(',');
  }

  return reg;
}

} // namespace requiem
