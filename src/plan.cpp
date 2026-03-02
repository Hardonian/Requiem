#include "requiem/plan.hpp"
#include "requiem/hash.hpp"
#include "requiem/jsonlite.hpp"
#include "requiem/receipt.hpp"
#include "requiem/runtime.hpp"

#include <chrono>
#include <map>
#include <queue>
#include <set>

namespace requiem {

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

namespace {

std::string step_config_to_json(const PlanStepConfig &cfg) {
  jsonlite::Object obj;

  jsonlite::Array argv_arr;
  for (const auto &a : cfg.argv)
    argv_arr.push_back(jsonlite::Value{a});
  obj["argv"] = std::move(argv_arr);

  obj["command"] = cfg.command;
  if (!cfg.data.empty())
    obj["data"] = cfg.data;
  obj["timeout_ms"] = cfg.timeout_ms;
  obj["workspace_root"] = cfg.workspace_root;

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

std::string steps_to_json(const std::vector<PlanStep> &steps) {
  jsonlite::Array arr;
  for (const auto &s : steps) {
    jsonlite::Object obj;

    // Config.
    auto cfg_str = step_config_to_json(s.config);
    auto cfg_parsed = jsonlite::parse(cfg_str, nullptr);
    obj["config"] = jsonlite::Value{std::move(cfg_parsed)};

    // Depends.
    jsonlite::Array deps_arr;
    for (const auto &d : s.depends_on)
      deps_arr.push_back(jsonlite::Value{d});
    obj["depends_on"] = std::move(deps_arr);

    obj["kind"] = s.kind;
    obj["step_id"] = s.step_id;
    arr.push_back(jsonlite::Value{std::move(obj)});
  }
  return jsonlite::to_json(jsonlite::Value{std::move(arr)});
}

} // namespace

std::string plan_to_json(const Plan &plan) {
  jsonlite::Object obj;
  obj["plan_hash"] = plan.plan_hash;
  obj["plan_id"] = plan.plan_id;
  obj["plan_version"] = static_cast<uint64_t>(plan.plan_version);

  // steps_to_json() returns a JSON array string; re-embed it by building
  // the steps array directly as a Value so it round-trips correctly.
  jsonlite::Array steps_arr;
  for (const auto &s : plan.steps) {
    jsonlite::Object sobj;

    // Config sub-object.
    jsonlite::Object cobj;
    jsonlite::Array argv_arr;
    for (const auto &a : s.config.argv)
      argv_arr.push_back(jsonlite::Value{a});
    cobj["argv"] = std::move(argv_arr);
    cobj["command"] = s.config.command;
    if (!s.config.data.empty())
      cobj["data"] = s.config.data;
    cobj["timeout_ms"] = s.config.timeout_ms;
    cobj["workspace_root"] = s.config.workspace_root;
    sobj["config"] = jsonlite::Value{std::move(cobj)};

    // Depends array.
    jsonlite::Array deps_arr;
    for (const auto &d : s.depends_on)
      deps_arr.push_back(jsonlite::Value{d});
    sobj["depends_on"] = std::move(deps_arr);

    sobj["kind"] = s.kind;
    sobj["step_id"] = s.step_id;
    steps_arr.push_back(jsonlite::Value{std::move(sobj)});
  }
  obj["steps"] = std::move(steps_arr);

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

Plan plan_from_json(const std::string &json) {
  Plan plan;
  auto obj = jsonlite::parse(json, nullptr);

  plan.plan_id = jsonlite::get_string(obj, "plan_id", "");
  plan.plan_version =
      static_cast<uint32_t>(jsonlite::get_u64(obj, "plan_version", 1));
  plan.plan_hash = jsonlite::get_string(obj, "plan_hash", "");

  auto it = obj.find("steps");
  if (it != obj.end() &&
      std::holds_alternative<jsonlite::Array>(it->second.v)) {
    const auto &arr = std::get<jsonlite::Array>(it->second.v);
    for (const auto &sv : arr) {
      if (!std::holds_alternative<jsonlite::Object>(sv.v))
        continue;
      const auto &sobj = std::get<jsonlite::Object>(sv.v);
      PlanStep step;
      step.step_id = jsonlite::get_string(sobj, "step_id", "");
      step.kind = jsonlite::get_string(sobj, "kind", "exec");
      step.depends_on = jsonlite::get_string_array(sobj, "depends_on");

      auto cit = sobj.find("config");
      if (cit != sobj.end() &&
          std::holds_alternative<jsonlite::Object>(cit->second.v)) {
        const auto &cobj = std::get<jsonlite::Object>(cit->second.v);
        step.config.command = jsonlite::get_string(cobj, "command", "");
        step.config.argv = jsonlite::get_string_array(cobj, "argv");
        step.config.workspace_root =
            jsonlite::get_string(cobj, "workspace_root", ".");
        step.config.timeout_ms = jsonlite::get_u64(cobj, "timeout_ms", 5000);
        step.config.data = jsonlite::get_string(cobj, "data", "");
      }
      plan.steps.push_back(std::move(step));
    }
  }

  return plan;
}

std::string plan_compute_hash(const Plan &plan) {
  return hash_domain("plan:", steps_to_json(plan.steps));
}

std::string plan_run_result_to_json(const PlanRunResult &r) {
  jsonlite::Object obj;
  obj["ok"] = r.ok;
  obj["plan_hash"] = r.plan_hash;
  obj["receipt_hash"] = r.receipt_hash;
  obj["run_id"] = r.run_id;

  jsonlite::Object sr_obj;
  for (const auto &[sid, sr] : r.step_results) {
    jsonlite::Object step_obj;
    step_obj["duration_ns"] = sr.duration_ns;
    step_obj["error_code"] = sr.error_code;
    step_obj["ok"] = sr.ok;
    step_obj["result_digest"] = sr.result_digest;
    step_obj["step_id"] = sr.step_id;
    sr_obj[sid] = jsonlite::Value{std::move(step_obj)};
  }
  obj["step_results"] = jsonlite::Value{std::move(sr_obj)};

  obj["steps_completed"] = static_cast<uint64_t>(r.steps_completed);
  obj["steps_total"] = static_cast<uint64_t>(r.steps_total);

  return jsonlite::to_json(jsonlite::Value{std::move(obj)});
}

// ---------------------------------------------------------------------------
// Validation (DAG check)
// ---------------------------------------------------------------------------

PlanValidateResult plan_validate(const Plan &plan) {
  PlanValidateResult result;
  result.ok = true;

  std::set<std::string> step_ids;
  for (const auto &s : plan.steps) {
    if (s.step_id.empty()) {
      result.ok = false;
      result.errors.push_back("empty step_id");
    }
    if (step_ids.count(s.step_id)) {
      result.ok = false;
      result.errors.push_back("duplicate step_id: " + s.step_id);
    }
    step_ids.insert(s.step_id);
  }

  // Check all dependencies reference existing steps.
  for (const auto &s : plan.steps) {
    for (const auto &dep : s.depends_on) {
      if (!step_ids.count(dep)) {
        result.ok = false;
        result.errors.push_back("step " + s.step_id +
                                " depends on unknown step: " + dep);
      }
    }
  }

  // Cycle detection via topological sort (Kahn's algorithm).
  std::map<std::string, int> in_degree;
  std::map<std::string, std::vector<std::string>> successors;
  for (const auto &s : plan.steps) {
    if (in_degree.find(s.step_id) == in_degree.end())
      in_degree[s.step_id] = 0;
    for (const auto &dep : s.depends_on) {
      successors[dep].push_back(s.step_id);
      in_degree[s.step_id]++;
    }
  }

  std::priority_queue<std::string, std::vector<std::string>, std::greater<>>
      ready;
  for (const auto &[id, deg] : in_degree) {
    if (deg == 0)
      ready.push(id);
  }

  size_t visited = 0;
  while (!ready.empty()) {
    auto cur = ready.top();
    ready.pop();
    ++visited;
    for (const auto &succ : successors[cur]) {
      if (--in_degree[succ] == 0)
        ready.push(succ);
    }
  }

  if (visited < plan.steps.size()) {
    result.ok = false;
    result.errors.push_back("cycle detected in dependency graph");
  }

  return result;
}

// ---------------------------------------------------------------------------
// Topological ordering (deterministic)
// ---------------------------------------------------------------------------

std::vector<std::string> plan_topological_order(const Plan &plan) {
  // Kahn's algorithm with lexicographic tie-breaking via min-heap.
  std::map<std::string, int> in_degree;
  std::map<std::string, std::vector<std::string>> successors;

  for (const auto &s : plan.steps) {
    if (in_degree.find(s.step_id) == in_degree.end())
      in_degree[s.step_id] = 0;
    for (const auto &dep : s.depends_on) {
      successors[dep].push_back(s.step_id);
      in_degree[s.step_id]++;
    }
  }

  // Min-heap: smallest step_id first (lexicographic tie-breaking).
  std::priority_queue<std::string, std::vector<std::string>, std::greater<>>
      ready;
  for (const auto &[id, deg] : in_degree) {
    if (deg == 0)
      ready.push(id);
  }

  std::vector<std::string> order;
  order.reserve(plan.steps.size());

  while (!ready.empty()) {
    auto cur = ready.top();
    ready.pop();
    order.push_back(cur);
    for (const auto &succ : successors[cur]) {
      if (--in_degree[succ] == 0)
        ready.push(succ);
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

PlanRunResult plan_execute(const Plan &plan, const std::string &workspace_root,
                           uint64_t logical_time, uint64_t nonce) {
  PlanRunResult result;
  result.plan_hash = plan_compute_hash(plan);
  result.steps_total = static_cast<uint32_t>(plan.steps.size());

  // Compute deterministic run_id.
  {
    jsonlite::Object rid_obj;
    rid_obj["logical_time"] = logical_time;
    rid_obj["nonce"] = nonce;
    rid_obj["plan_hash"] = result.plan_hash;
    result.run_id = hash_domain(
        "plan:", jsonlite::to_json(jsonlite::Value{std::move(rid_obj)}));
  }

  // Validate the plan first.
  auto validation = plan_validate(plan);
  if (!validation.ok) {
    result.ok = false;
    return result;
  }

  // Build step lookup.
  std::map<std::string, const PlanStep *> step_map;
  for (const auto &s : plan.steps)
    step_map[s.step_id] = &s;

  // Track failed steps to skip dependents.
  std::set<std::string> failed_steps;

  // Execute in topological order.
  auto order = plan_topological_order(plan);

  for (const auto &step_id : order) {
    auto it = step_map.find(step_id);
    if (it == step_map.end())
      continue;
    const PlanStep &step = *it->second;

    StepResult sr;
    sr.step_id = step_id;

    // Check if any dependency failed.
    bool dep_failed = false;
    for (const auto &dep : step.depends_on) {
      if (failed_steps.count(dep)) {
        dep_failed = true;
        break;
      }
    }

    if (dep_failed) {
      sr.ok = false;
      sr.error_code = "dependency_failed";
      failed_steps.insert(step_id);
      result.step_results[step_id] = sr;
      continue;
    }

    const auto t0 = std::chrono::steady_clock::now();

    if (step.kind == "exec") {
      ExecutionRequest req;
      req.command = step.config.command;
      req.argv = step.config.argv;
      req.workspace_root =
          workspace_root.empty() ? step.config.workspace_root : workspace_root;
      req.timeout_ms = step.config.timeout_ms;
      req.policy.deterministic = true;
      req.policy.time_mode = "fixed_zero";

      auto exec_result = execute(req);
      sr.ok = exec_result.ok;
      sr.result_digest = exec_result.result_digest;
      sr.error_code = exec_result.error_code;
    } else if (step.kind == "gate") {
      // Gate: check condition. For now, always pass.
      sr.ok = true;
      sr.result_digest = hash_domain("plan:", "gate:" + step_id + ":pass");
    } else if (step.kind == "cas_put") {
      // Stub: CAS put via plan step.
      sr.ok = !step.config.data.empty();
      sr.result_digest = hash_domain("cas:", step.config.data);
      if (!sr.ok)
        sr.error_code = "empty_data";
    } else {
      sr.ok = false;
      sr.error_code = "unknown_step_kind:" + step.kind;
    }

    sr.duration_ns = static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now() - t0)
            .count());

    if (!sr.ok)
      failed_steps.insert(step_id);

    result.step_results[step_id] = sr;
    ++result.steps_completed;
  }

  result.ok = failed_steps.empty();

  // Compute receipt hash.
  std::map<std::string, std::string> step_digests;
  for (const auto &[sid, sr] : result.step_results)
    step_digests[sid] = sr.result_digest;

  auto receipt = receipt_generate(result.run_id, result.plan_hash, "", "",
                                  step_digests, logical_time, "");
  result.receipt_hash = receipt.receipt_hash;

  return result;
}

} // namespace requiem
