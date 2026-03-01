#pragma once

#include <map>
#include <string>
#include <vector>

namespace requiem {

struct PolicyRegistry {
  std::vector<std::string> policies;
  std::vector<std::string> constraints;
  std::map<std::string, std::vector<std::string>> mapping;
  std::vector<std::pair<std::string, std::string>> conflicts;
};

struct LintResult {
  bool valid;
  std::vector<std::string> errors;
  std::vector<std::string> warnings;
};

class PolicyLinter {
public:
  /**
   * @brief Statically analyzes a policy registry for logical contradictions.
   *
   * Checks for:
   * 1. Self-contradictory policies (Policy A -> {C1, C2} where C1 conflicts
   * with C2).
   * 2. Unreachable configurations (Policy A and Policy B cannot coexist).
   */
  static LintResult Check(const PolicyRegistry &registry);

  /**
   * @brief Parses a JSON string into a PolicyRegistry structure.
   * Supports the schema defined in policies/*.json (policies, constraints, map,
   * conflicts).
   */
  static PolicyRegistry LoadFromJson(const std::string &json_content);
};

} // namespace requiem
