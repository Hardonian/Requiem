#pragma once

// requiem/policy_vm.hpp — Deterministic policy evaluation with proof hashing.
//
// KERNEL_SPEC §7: The Policy VM evaluates rules against a context and
// produces a deterministic decision with a proof hash that is reproducible.
//
// INVARIANTS:
//   - Same rules + same context = same decision + same proof_hash.
//   - Default deny: if no rule matches, deny.
//   - Rules sorted by priority descending, first match wins.

#include <cstdint>
#include <string>
#include <vector>

namespace requiem {

// A single policy rule condition.
struct PolicyCondition {
  std::string field; // e.g. "request.tenant_id"
  std::string op;    // eq, neq, in, not_in, exists, gt, lt, gte, lte, matches
  std::string value; // Comparison value (or JSON array for in/not_in)
};

// A policy rule.
struct PolicyRule {
  std::string rule_id;
  PolicyCondition condition;
  std::string effect; // "allow" or "deny"
  int64_t priority{0};
};

// The result of a policy evaluation.
struct PolicyDecision {
  std::string decision;        // "allow" or "deny"
  std::string matched_rule_id; // Which rule matched (empty if default deny)
  std::string context_hash;    // H("pol:", canonical_json(context))
  std::string rules_hash;      // H("pol:", canonical_json(rules))
  std::string proof_hash;      // H("pol:", canonical_json(decision_record))
  uint64_t evaluated_at_logical_time{0};
};

// Serialize a policy rule to canonical JSON.
std::string policy_rule_to_json(const PolicyRule &rule);

// Serialize a vector of policy rules to canonical JSON.
std::string policy_rules_to_json(const std::vector<PolicyRule> &rules);

// Parse policy rules from JSON.
std::vector<PolicyRule> policy_rules_from_json(const std::string &json);

// Serialize a policy decision to JSON.
std::string policy_decision_to_json(const PolicyDecision &decision);

// Evaluate policy rules against a context.
// context_json: canonical JSON of the execution request or relevant context.
// rules: vector of PolicyRule, will be sorted by priority internally.
// logical_time: current logical time for time-bound evaluation.
PolicyDecision policy_eval(const std::vector<PolicyRule> &rules,
                           const std::string &context_json,
                           uint64_t logical_time = 0);

// Check if a condition matches against a context value.
bool policy_condition_matches(const PolicyCondition &condition,
                              const std::string &actual_value);

} // namespace requiem
