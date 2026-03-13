/**
 * Policy Engine Reproducibility Tests
 *
 * Verifies CLAIM_POLICY_DETERMINISM:
 * - policy(input) → decision is deterministic
 * - policy_hash, input_hash, decision_hash, proof_hash match across replay
 * - Deny-by-default behavior
 * - Budget enforcement before execution
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalHash, hashDomain, canonicalStringify } from '../../packages/hash/src/canonical_hash.js';

// ---------------------------------------------------------------------------
// Policy Engine (pure-function, deterministic evaluation)
// ---------------------------------------------------------------------------

interface PolicyRule {
  rule_id: string;
  field: string;
  operator: 'eq' | 'neq' | 'exists' | 'in' | 'gt' | 'lt' | 'matches';
  value: string;
  effect: 'allow' | 'deny';
  priority: number;
}

interface PolicyContext {
  tool_id: string;
  tenant_id: string;
  actor_id: string;
  environment: string;
  [key: string]: string;
}

interface PolicyDecision {
  decision: 'allow' | 'deny';
  matched_rule_id: string;
  context_hash: string;
  rules_hash: string;
  proof_hash: string;
  evaluated_at_logical_time: number;
}

interface BudgetState {
  remaining_cents: number;
  window: 'hourly' | 'daily' | 'monthly';
  cost_per_unit: number;
}

function evaluatePolicy(
  rules: PolicyRule[],
  context: PolicyContext,
  logicalTime: number,
): PolicyDecision {
  const contextHash = hashDomain('pol:', canonicalStringify(context));
  const rulesHash = hashDomain('pol:', canonicalStringify(rules));

  // Sort rules by priority (deterministic ordering)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  let matchedRule: PolicyRule | null = null;
  for (const rule of sortedRules) {
    const fieldValue = context[rule.field];
    let matches = false;

    switch (rule.operator) {
      case 'eq': matches = fieldValue === rule.value; break;
      case 'neq': matches = fieldValue !== rule.value; break;
      case 'exists': matches = fieldValue !== undefined; break;
      case 'in': matches = rule.value.split(',').includes(fieldValue); break;
      case 'gt': matches = Number(fieldValue) > Number(rule.value); break;
      case 'lt': matches = Number(fieldValue) < Number(rule.value); break;
      case 'matches': matches = new RegExp(rule.value).test(fieldValue || ''); break;
    }

    if (matches) {
      matchedRule = rule;
      break;
    }
  }

  const decision: 'allow' | 'deny' = matchedRule ? matchedRule.effect : 'deny';
  const matchedRuleId = matchedRule ? matchedRule.rule_id : 'default_deny';

  const decisionRecord = {
    decision,
    matched_rule_id: matchedRuleId,
    context_hash: contextHash,
    rules_hash: rulesHash,
    evaluated_at_logical_time: logicalTime,
  };

  const proofHash = hashDomain('pol:', canonicalStringify(decisionRecord));

  return {
    ...decisionRecord,
    proof_hash: proofHash,
  };
}

function checkBudget(budget: BudgetState, costUnits: number): {
  allowed: boolean;
  remaining_after: number;
} {
  const totalCost = costUnits * budget.cost_per_unit;
  if (totalCost > budget.remaining_cents) {
    return { allowed: false, remaining_after: budget.remaining_cents };
  }
  return { allowed: true, remaining_after: budget.remaining_cents - totalCost };
}

// ---------------------------------------------------------------------------
// Test Rules
// ---------------------------------------------------------------------------

const TEST_RULES: PolicyRule[] = [
  { rule_id: 'deny_dangerous', field: 'tool_id', operator: 'in', value: 'rm,drop_db,format', effect: 'deny', priority: 1 },
  { rule_id: 'allow_echo', field: 'tool_id', operator: 'eq', value: 'echo', effect: 'allow', priority: 10 },
  { rule_id: 'allow_read', field: 'tool_id', operator: 'eq', value: 'read_file', effect: 'allow', priority: 10 },
  { rule_id: 'deny_prod', field: 'environment', operator: 'eq', value: 'production', effect: 'deny', priority: 5 },
  { rule_id: 'allow_staging', field: 'environment', operator: 'eq', value: 'staging', effect: 'allow', priority: 20 },
];

const TEST_CONTEXT: PolicyContext = {
  tool_id: 'echo',
  tenant_id: 'tenant_001',
  actor_id: 'actor_001',
  environment: 'staging',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Policy Reproducibility — Deterministic Evaluation', () => {
  it('same inputs produce identical decisions', () => {
    const decision1 = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);
    const decision2 = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);

    assert.equal(decision1.decision, decision2.decision);
    assert.equal(decision1.matched_rule_id, decision2.matched_rule_id);
    assert.equal(decision1.context_hash, decision2.context_hash);
    assert.equal(decision1.rules_hash, decision2.rules_hash);
    assert.equal(decision1.proof_hash, decision2.proof_hash);
  });

  it('N evaluations produce identical proof hashes', () => {
    const N = 200;
    const referenceDecision = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);

    for (let i = 0; i < N; i++) {
      const decision = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);
      assert.equal(decision.proof_hash, referenceDecision.proof_hash,
        `Evaluation ${i} proof_hash mismatch`);
    }
  });

  it('different logical times produce different proof hashes', () => {
    const d1 = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);
    const d2 = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 1);

    assert.notEqual(d1.proof_hash, d2.proof_hash,
      'Different logical times must produce different proof hashes');
    assert.equal(d1.decision, d2.decision, 'Decision should be the same');
  });

  it('hash components are independently verifiable', () => {
    const decision = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);

    // Verify context_hash
    const expectedContextHash = hashDomain('pol:', canonicalStringify(TEST_CONTEXT));
    assert.equal(decision.context_hash, expectedContextHash);

    // Verify rules_hash
    const expectedRulesHash = hashDomain('pol:', canonicalStringify(TEST_RULES));
    assert.equal(decision.rules_hash, expectedRulesHash);

    // Verify proof_hash
    const decisionRecord = {
      decision: decision.decision,
      matched_rule_id: decision.matched_rule_id,
      context_hash: decision.context_hash,
      rules_hash: decision.rules_hash,
      evaluated_at_logical_time: decision.evaluated_at_logical_time,
    };
    const expectedProofHash = hashDomain('pol:', canonicalStringify(decisionRecord));
    assert.equal(decision.proof_hash, expectedProofHash);
  });
});

describe('Policy Reproducibility — Deny-by-Default', () => {
  it('unknown tool with no matching environment is denied', () => {
    const context: PolicyContext = {
      tool_id: 'unknown_tool',
      tenant_id: 'tenant_001',
      actor_id: 'actor_001',
      environment: 'unknown_env',
    };
    const decision = evaluatePolicy(TEST_RULES, context, 0);
    assert.equal(decision.decision, 'deny');
    assert.equal(decision.matched_rule_id, 'default_deny');
  });

  it('empty rules means deny all', () => {
    const decision = evaluatePolicy([], TEST_CONTEXT, 0);
    assert.equal(decision.decision, 'deny');
    assert.equal(decision.matched_rule_id, 'default_deny');
  });

  it('dangerous tools are denied even with matching allow rules', () => {
    const context: PolicyContext = {
      tool_id: 'rm',
      tenant_id: 'tenant_001',
      actor_id: 'actor_001',
      environment: 'staging',
    };
    const decision = evaluatePolicy(TEST_RULES, context, 0);
    assert.equal(decision.decision, 'deny');
    assert.equal(decision.matched_rule_id, 'deny_dangerous');
  });
});

describe('Policy Reproducibility — Priority Ordering', () => {
  it('higher priority rules are evaluated first', () => {
    // Production environment is denied at priority 5
    // Staging is allowed at priority 20
    // Priority 5 < 20, so deny_prod matches first for production
    const prodContext: PolicyContext = {
      tool_id: 'echo',
      tenant_id: 'tenant_001',
      actor_id: 'actor_001',
      environment: 'production',
    };
    const decision = evaluatePolicy(TEST_RULES, prodContext, 0);
    assert.equal(decision.decision, 'deny');
    assert.equal(decision.matched_rule_id, 'deny_prod');
  });

  it('rule ordering is deterministic regardless of input order', () => {
    const shuffledRules = [TEST_RULES[3], TEST_RULES[0], TEST_RULES[4], TEST_RULES[1], TEST_RULES[2]];
    const d1 = evaluatePolicy(TEST_RULES, TEST_CONTEXT, 0);
    const d2 = evaluatePolicy(shuffledRules, TEST_CONTEXT, 0);

    // Same rules (just reordered) should produce same decision
    assert.equal(d1.decision, d2.decision);
    assert.equal(d1.matched_rule_id, d2.matched_rule_id);
  });
});

describe('Policy Reproducibility — Budget Enforcement', () => {
  it('allows operation within budget', () => {
    const budget: BudgetState = { remaining_cents: 1000, window: 'hourly', cost_per_unit: 10 };
    const result = checkBudget(budget, 5);
    assert.ok(result.allowed);
    assert.equal(result.remaining_after, 950);
  });

  it('denies operation exceeding budget', () => {
    const budget: BudgetState = { remaining_cents: 10, window: 'hourly', cost_per_unit: 10 };
    const result = checkBudget(budget, 5);
    assert.ok(!result.allowed, 'Over-budget operation must be denied');
    assert.equal(result.remaining_after, 10, 'Budget must not change on denial');
  });

  it('budget check is deterministic', () => {
    const budget: BudgetState = { remaining_cents: 100, window: 'daily', cost_per_unit: 5 };
    const r1 = checkBudget(budget, 10);
    const r2 = checkBudget(budget, 10);
    assert.equal(r1.allowed, r2.allowed);
    assert.equal(r1.remaining_after, r2.remaining_after);
  });

  it('zero remaining means hard deny', () => {
    const budget: BudgetState = { remaining_cents: 0, window: 'monthly', cost_per_unit: 1 };
    const result = checkBudget(budget, 1);
    assert.ok(!result.allowed, 'Zero budget must result in hard deny');
  });
});

describe('Policy Reproducibility — Replay Matching', () => {
  it('policy decisions match across simulated replay', () => {
    // Original execution
    const originalDecisions: PolicyDecision[] = [];
    for (let i = 0; i < 10; i++) {
      const context: PolicyContext = {
        tool_id: i % 2 === 0 ? 'echo' : 'read_file',
        tenant_id: 'tenant_001',
        actor_id: 'actor_001',
        environment: 'staging',
      };
      originalDecisions.push(evaluatePolicy(TEST_RULES, context, i));
    }

    // Replay
    const replayDecisions: PolicyDecision[] = [];
    for (let i = 0; i < 10; i++) {
      const context: PolicyContext = {
        tool_id: i % 2 === 0 ? 'echo' : 'read_file',
        tenant_id: 'tenant_001',
        actor_id: 'actor_001',
        environment: 'staging',
      };
      replayDecisions.push(evaluatePolicy(TEST_RULES, context, i));
    }

    // Compare
    for (let i = 0; i < 10; i++) {
      assert.equal(originalDecisions[i].decision, replayDecisions[i].decision, `Decision ${i} mismatch`);
      assert.equal(originalDecisions[i].proof_hash, replayDecisions[i].proof_hash, `Proof hash ${i} mismatch`);
      assert.equal(originalDecisions[i].context_hash, replayDecisions[i].context_hash, `Context hash ${i} mismatch`);
      assert.equal(originalDecisions[i].rules_hash, replayDecisions[i].rules_hash, `Rules hash ${i} mismatch`);
    }
  });
});
