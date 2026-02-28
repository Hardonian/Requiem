#include "requiem/policy_linter.hpp"

#include <algorithm>
#include <sstream>

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

} // namespace requiem
