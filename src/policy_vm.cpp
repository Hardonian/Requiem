#include "requiem/policy_vm.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"

#include <algorithm>
#include <regex>

namespace requiem {

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

std::string policy_rule_to_json(const PolicyRule &rule) {
  jsonlite::Object obj;
  jsonlite::Object cond;
  cond["field"] = rule.condition.field;
  cond["op"] = rule.condition.op;
  cond["value"] = rule.condition.value;
  obj["condition"] = std::move(cond);
  obj["effect"] = rule.effect;
  obj["priority"] = static_cast<uint64_t>(
      rule.priority >= 0 ? static_cast<uint64_t>(rule.priority) : 0);
  obj["rule_id"] = rule.rule_id;
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string policy_rules_to_json(const std::vector<PolicyRule> &rules) {
  jsonlite::Array arr;
  for (const auto &r : rules) {
    // Parse each rule's JSON back into a Value for the array.
    auto obj_str = policy_rule_to_json(r);
    auto parsed = jsonlite::parse(obj_str, nullptr);
    arr.push_back(jsonlite::Value{std::move(parsed)});
  }
  return jsonlite::to_json(jsonlite::Value{std::move(arr)});
}

std::vector<PolicyRule> policy_rules_from_json(const std::string &json) {
  std::vector<PolicyRule> rules;
  // Parse as array of objects.
  auto arr = jsonlite::get_string_array(json, "rules");
  // If that fails, try parsing as a direct array.
  auto top = jsonlite::parse(json, nullptr);

  // Try to find "rules" key first.
  auto it = top.find("rules");
  if (it != top.end() &&
      std::holds_alternative<jsonlite::Array>(it->second.v)) {
    const auto &rule_arr = std::get<jsonlite::Array>(it->second.v);
    for (const auto &rv : rule_arr) {
      if (!std::holds_alternative<jsonlite::Object>(rv.v))
        continue;
      const auto &robj = std::get<jsonlite::Object>(rv.v);
      PolicyRule rule;
      rule.rule_id = jsonlite::get_string(robj, "rule_id", "");
      rule.effect = jsonlite::get_string(robj, "effect", "deny");
      rule.priority =
          static_cast<int64_t>(jsonlite::get_u64(robj, "priority", 0));

      auto cit = robj.find("condition");
      if (cit != robj.end() &&
          std::holds_alternative<jsonlite::Object>(cit->second.v)) {
        const auto &cobj = std::get<jsonlite::Object>(cit->second.v);
        rule.condition.field = jsonlite::get_string(cobj, "field", "");
        rule.condition.op = jsonlite::get_string(cobj, "op", "eq");
        rule.condition.value = jsonlite::get_string(cobj, "value", "");
      }
      rules.push_back(std::move(rule));
    }
  }

  return rules;
}

std::string policy_decision_to_json(const PolicyDecision &d) {
  jsonlite::Object obj;
  obj["context_hash"] = d.context_hash;
  obj["decision"] = d.decision;
  obj["evaluated_at_logical_time"] = d.evaluated_at_logical_time;
  obj["matched_rule_id"] = d.matched_rule_id;
  obj["proof_hash"] = d.proof_hash;
  obj["rules_hash"] = d.rules_hash;
  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

bool policy_condition_matches(const PolicyCondition &condition,
                              const std::string &actual_value) {

  const auto &op = condition.op;
  const auto &expected = condition.value;

  if (op == "eq") {
    return actual_value == expected;
  }
  if (op == "neq") {
    return actual_value != expected;
  }
  if (op == "exists") {
    return !actual_value.empty();
  }
  if (op == "in") {
    // expected is a comma-separated list.
    std::string token;
    std::istringstream stream(expected);
    while (std::getline(stream, token, ',')) {
      // Trim whitespace.
      size_t start = token.find_first_not_of(' ');
      size_t end = token.find_last_not_of(' ');
      if (start != std::string::npos) {
        token = token.substr(start, end - start + 1);
      }
      if (token == actual_value)
        return true;
    }
    return false;
  }
  if (op == "not_in") {
    std::string token;
    std::istringstream stream(expected);
    while (std::getline(stream, token, ',')) {
      size_t start = token.find_first_not_of(' ');
      size_t end = token.find_last_not_of(' ');
      if (start != std::string::npos) {
        token = token.substr(start, end - start + 1);
      }
      if (token == actual_value)
        return false;
    }
    return true;
  }
  if (op == "gt" || op == "lt" || op == "gte" || op == "lte") {
    // Numeric comparison.
    try {
      double av = std::stod(actual_value);
      double ev = std::stod(expected);
      if (op == "gt")
        return av > ev;
      if (op == "lt")
        return av < ev;
      if (op == "gte")
        return av >= ev;
      if (op == "lte")
        return av <= ev;
    } catch (...) {
      return false;
    }
  }
  if (op == "matches") {
    try {
      std::regex re(expected);
      return std::regex_search(actual_value, re);
    } catch (...) {
      return false;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Extract a field value from context JSON.
// Supports dotted paths like "request.tenant_id".
// ---------------------------------------------------------------------------

namespace {

std::string extract_field(const jsonlite::Object &obj,
                          const std::string &field) {
  // Split on dots.
  size_t dot = field.find('.');
  if (dot == std::string::npos) {
    return jsonlite::get_string(obj, field, "");
  }

  std::string first = field.substr(0, dot);
  std::string rest = field.substr(dot + 1);

  auto it = obj.find(first);
  if (it == obj.end())
    return "";
  if (std::holds_alternative<jsonlite::Object>(it->second.v)) {
    return extract_field(std::get<jsonlite::Object>(it->second.v), rest);
  }
  return "";
}

} // namespace

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

PolicyDecision policy_eval(const std::vector<PolicyRule> &rules,
                           const std::string &context_json,
                           uint64_t logical_time) {

  PolicyDecision decision;
  decision.evaluated_at_logical_time = logical_time;

  // Compute context hash.
  decision.context_hash = hash_domain("pol:", context_json);

  // Compute rules hash.
  decision.rules_hash = hash_domain("pol:", policy_rules_to_json(rules));

  // Sort rules by priority descending.
  std::vector<PolicyRule> sorted_rules = rules;
  std::sort(sorted_rules.begin(), sorted_rules.end(),
            [](const PolicyRule &a, const PolicyRule &b) {
              return a.priority > b.priority;
            });

  // Parse context.
  auto ctx_obj = jsonlite::parse(context_json, nullptr);

  // Evaluate rules in priority order.
  decision.decision = "deny"; // Default deny.
  decision.matched_rule_id = "";

  for (const auto &rule : sorted_rules) {
    std::string actual = extract_field(ctx_obj, rule.condition.field);
    if (policy_condition_matches(rule.condition, actual)) {
      decision.decision = rule.effect;
      decision.matched_rule_id = rule.rule_id;
      break;
    }
  }

  // Compute proof hash.
  jsonlite::Object proof_obj;
  proof_obj["context_hash"] = decision.context_hash;
  proof_obj["decision"] = decision.decision;
  proof_obj["matched_rule_id"] = decision.matched_rule_id;
  proof_obj["rules_hash"] = decision.rules_hash;

  decision.proof_hash = hash_domain(
      "pol:", jsonlite::to_json(jsonlite::Value{std::move(proof_obj)}));

  return decision;
}

} // namespace requiem
