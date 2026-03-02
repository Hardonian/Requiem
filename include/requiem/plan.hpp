#pragma once

// requiem/plan.hpp — Plan graph: DAG schema + deterministic scheduler.
//
// KERNEL_SPEC §10: A plan is a DAG of steps executed in topological order
// with lexicographic tie-breaking for determinism.
//
// INVARIANTS:
//   INV-DETERMINISTIC-SCHEDULE: Steps execute in topological+lexicographic
//   order. INV-REPLAY: Same plan + same inputs → identical receipt_hash.

#include <cstdint>
#include <map>
#include <string>
#include <vector>

namespace requiem {

// Configuration for a single plan step.
struct PlanStepConfig {
  std::string command;
  std::vector<std::string> argv;
  std::string workspace_root{"."};
  uint64_t timeout_ms{5000};
  std::string data; // For cas_put or policy_eval steps
};

// A single step in the plan DAG.
struct PlanStep {
  std::string step_id;
  std::string kind; // exec, cas_put, policy_eval, gate
  std::vector<std::string> depends_on;
  PlanStepConfig config;
};

// A complete plan (DAG of steps).
struct Plan {
  std::string plan_id;
  uint32_t plan_version{1};
  std::vector<PlanStep> steps;
  std::string plan_hash; // H("plan:", canonical_json(steps))
};

// Result of a single step execution.
struct StepResult {
  std::string step_id;
  bool ok{false};
  std::string result_digest;
  std::string error_code;
  uint64_t duration_ns{0};
};

// Result of a complete plan run.
struct PlanRunResult {
  std::string
      run_id; // Deterministic: H("plan:", {plan_hash, logical_time, nonce})
  std::string plan_hash;
  uint32_t steps_completed{0};
  uint32_t steps_total{0};
  bool ok{false};
  std::map<std::string, StepResult> step_results;
  std::string receipt_hash; // H("rcpt:", canonical_json(run_receipt))
};

// Serialize a plan to canonical JSON.
std::string plan_to_json(const Plan &plan);

// Parse a plan from JSON.
Plan plan_from_json(const std::string &json);

// Compute the plan hash: H("plan:", canonical_json(steps))
std::string plan_compute_hash(const Plan &plan);

// Serialize a plan run result to JSON.
std::string plan_run_result_to_json(const PlanRunResult &result);

// Validate a plan DAG (no cycles, all dependencies exist).
struct PlanValidateResult {
  bool ok{false};
  std::vector<std::string> errors;
};
PlanValidateResult plan_validate(const Plan &plan);

// Execute a plan deterministically.
// Runs steps in topological+lexicographic order.
// Each step records its result. If a step fails, subsequent dependent steps are
// skipped. Returns the complete run result with receipt hash.
PlanRunResult plan_execute(const Plan &plan, const std::string &workspace_root,
                           uint64_t logical_time = 0, uint64_t nonce = 0);

// Compute deterministic topological ordering with lexicographic tie-breaking.
std::vector<std::string> plan_topological_order(const Plan &plan);

// ---------------------------------------------------------------------------
// PHASE A: Additional plan operations
// ---------------------------------------------------------------------------

// Add a plan to the store.
Plan plan_add(const std::string& plan_id, const std::string& steps_json);

// List all stored plans (optionally filtered by tenant).
std::vector<Plan> plan_list(const std::string& tenant_id = "");

// Result of showing a plan with its execution history.
struct PlanShowResult {
  Plan plan;
  std::vector<PlanRunResult> runs;
};

// Show plan details and execution history.
PlanShowResult plan_show(const std::string& plan_hash);

// Result of replaying a plan run.
struct PlanReplayResult {
  bool ok{false};
  std::string original_run_id;
  std::string replay_run_id;
  bool exact_match{false};
  std::string receipt_hash_original;
  std::string receipt_hash_replay;
  std::string error;
};

// Replay a plan run for verification.
PlanReplayResult plan_replay(const std::string& run_id, bool verify_exact);

// Serialize plan steps to JSON array.
std::string plan_steps_to_json(const std::vector<PlanStep>& steps);

} // namespace requiem
