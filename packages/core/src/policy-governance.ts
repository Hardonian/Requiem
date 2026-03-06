/**
 * Policy Governance System
 *
 * Full policy-as-code layer for the TypeScript control plane.
 * Mirrors the C++ kernel's policy VM with:
 *   - Versioned rule sets
 *   - Deny-by-default evaluation
 *   - Proof of evaluation
 *   - Policy simulation
 *   - Rate limiting
 *   - Budget enforcement
 */

import { canonicalStringify } from './canonical-json.js';
import { blake3Hex, policyProofHash } from './hash.js';

// ---------------------------------------------------------------------------
// Policy Types
// ---------------------------------------------------------------------------

export type PolicyEffect = 'allow' | 'deny';
export type PolicyOperator = 'eq' | 'neq' | 'exists' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte' | 'matches';

export interface PolicyCondition {
  field: string;
  operator: PolicyOperator;
  value: string;
}

export interface PolicyRule {
  rule_id: string;
  name: string;
  description?: string;
  condition: PolicyCondition;
  effect: PolicyEffect;
  priority: number;
  tags?: string[];
}

export interface PolicySet {
  policy_set_id: string;
  version: number;
  name: string;
  description?: string;
  rules: PolicyRule[];
  created_at: string;
  updated_at: string;
  hash: string;
}

export interface PolicyContext {
  tenant_id: string;
  actor_id: string;
  tool_id?: string;
  action?: string;
  resource?: string;
  environment?: Record<string, string>;
  budget_remaining?: number;
  request_count_window?: number;
  [key: string]: unknown;
}

export interface PolicyDecisionProof {
  decision: PolicyEffect;
  matched_rule_id: string;
  matched_rule_name: string;
  context_hash: string;
  rules_hash: string;
  proof_hash: string;
  evaluated_at: string;
  evaluation_duration_ms: number;
  all_evaluated_rules: Array<{
    rule_id: string;
    matched: boolean;
    effect: PolicyEffect;
  }>;
}

// ---------------------------------------------------------------------------
// Rate Limit & Budget Rules
// ---------------------------------------------------------------------------

export interface RateLimitRule {
  rule_id: string;
  tenant_id: string;
  scope: 'global' | 'per_tool' | 'per_actor';
  max_requests: number;
  window_seconds: number;
  current_count?: number;
}

export interface BudgetRule {
  rule_id: string;
  tenant_id: string;
  max_cost_units: number;
  window: 'hourly' | 'daily' | 'monthly';
  current_usage?: number;
}

// ---------------------------------------------------------------------------
// Policy Engine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  private policySets: Map<string, PolicySet> = new Map();
  private rateLimitCounters: Map<string, { count: number; window_start: number }> = new Map();

  /** Load a policy set */
  loadPolicySet(policySet: PolicySet): void {
    // Compute hash from rules
    const hash = blake3Hex(canonicalStringify(policySet.rules));
    this.policySets.set(policySet.policy_set_id, { ...policySet, hash });
  }

  /** Evaluate context against all loaded policies (deny-by-default) */
  evaluate(context: PolicyContext, policySetId?: string): PolicyDecisionProof {
    const startTime = Date.now();

    // Collect applicable rules
    let allRules: PolicyRule[] = [];
    let rulesHash: string;

    if (policySetId) {
      const ps = this.policySets.get(policySetId);
      if (!ps) {
        return this.buildDenyProof(context, 'policy_set_not_found', '(none)', startTime, []);
      }
      allRules = ps.rules;
      rulesHash = ps.hash;
    } else {
      // Evaluate all policy sets
      for (const ps of this.policySets.values()) {
        allRules.push(...ps.rules);
      }
      rulesHash = blake3Hex(canonicalStringify(allRules));
    }

    // Sort by priority descending (highest priority first)
    const sorted = [...allRules].sort((a, b) => b.priority - a.priority);

    // Evaluate each rule
    const evaluated: Array<{ rule_id: string; matched: boolean; effect: PolicyEffect }> = [];
    let matchedRule: PolicyRule | undefined;

    for (const rule of sorted) {
      const matched = this.evaluateCondition(rule.condition, context);
      evaluated.push({ rule_id: rule.rule_id, matched, effect: rule.effect });
      if (matched && !matchedRule) {
        matchedRule = rule;
      }
    }

    // Deny-by-default: if no rule matches, deny
    if (!matchedRule) {
      return this.buildDenyProof(context, 'default_deny', rulesHash, startTime, evaluated);
    }

    const contextHash = blake3Hex(canonicalStringify(context));
    const decision: PolicyDecisionProof = {
      decision: matchedRule.effect,
      matched_rule_id: matchedRule.rule_id,
      matched_rule_name: matchedRule.name,
      context_hash: contextHash,
      rules_hash: rulesHash,
      proof_hash: '', // computed below
      evaluated_at: new Date().toISOString(),
      evaluation_duration_ms: Date.now() - startTime,
      all_evaluated_rules: evaluated,
    };

    decision.proof_hash = policyProofHash(canonicalStringify(decision));
    return decision;
  }

  /** Simulate a hypothetical execution without side effects */
  simulate(context: PolicyContext, hypotheticalRules?: PolicyRule[]): PolicyDecisionProof {
    if (hypotheticalRules) {
      const tempEngine = new PolicyEngine();
      tempEngine.loadPolicySet({
        policy_set_id: 'simulation',
        version: 0,
        name: 'Simulation',
        rules: hypotheticalRules,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        hash: '',
      });
      return tempEngine.evaluate(context, 'simulation');
    }
    return this.evaluate(context);
  }

  /** Check rate limit */
  checkRateLimit(rule: RateLimitRule): { allowed: boolean; remaining: number; reset_at: number } {
    const key = `${rule.tenant_id}:${rule.scope}:${rule.rule_id}`;
    const now = Date.now();
    const windowMs = rule.window_seconds * 1000;

    let counter = this.rateLimitCounters.get(key);
    if (!counter || (now - counter.window_start) > windowMs) {
      counter = { count: 0, window_start: now };
      this.rateLimitCounters.set(key, counter);
    }

    counter.count++;
    const remaining = Math.max(0, rule.max_requests - counter.count);
    const resetAt = counter.window_start + windowMs;

    return {
      allowed: counter.count <= rule.max_requests,
      remaining,
      reset_at: resetAt,
    };
  }

  /** Check budget */
  checkBudget(rule: BudgetRule, additionalCost: number): { allowed: boolean; remaining: number } {
    const currentUsage = rule.current_usage || 0;
    const afterUsage = currentUsage + additionalCost;
    return {
      allowed: afterUsage <= rule.max_cost_units,
      remaining: Math.max(0, rule.max_cost_units - afterUsage),
    };
  }

  /** Get all loaded policy sets */
  getPolicySets(): PolicySet[] {
    return Array.from(this.policySets.values());
  }

  /** Export policies as testable JSON */
  exportRules(): PolicyRule[] {
    const rules: PolicyRule[] = [];
    for (const ps of this.policySets.values()) {
      rules.push(...ps.rules);
    }
    return rules;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const fieldValue = this.resolveField(condition.field, context);

    switch (condition.operator) {
      case 'eq':
        return String(fieldValue) === condition.value;
      case 'neq':
        return String(fieldValue) !== condition.value;
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'in':
        return condition.value.split(',').map(s => s.trim()).includes(String(fieldValue));
      case 'not_in':
        return !condition.value.split(',').map(s => s.trim()).includes(String(fieldValue));
      case 'gt':
        return Number(fieldValue) > Number(condition.value);
      case 'lt':
        return Number(fieldValue) < Number(condition.value);
      case 'gte':
        return Number(fieldValue) >= Number(condition.value);
      case 'lte':
        return Number(fieldValue) <= Number(condition.value);
      case 'matches':
        try {
          return new RegExp(condition.value).test(String(fieldValue));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private resolveField(field: string, context: PolicyContext): unknown {
    const parts = field.split('.');
    let current: unknown = context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private buildDenyProof(
    context: PolicyContext,
    ruleId: string,
    rulesHash: string,
    startTime: number,
    evaluated: Array<{ rule_id: string; matched: boolean; effect: PolicyEffect }>,
  ): PolicyDecisionProof {
    const contextHash = blake3Hex(canonicalStringify(context));
    const decision: PolicyDecisionProof = {
      decision: 'deny',
      matched_rule_id: ruleId,
      matched_rule_name: ruleId === 'default_deny' ? 'Default Deny' : ruleId,
      context_hash: contextHash,
      rules_hash: rulesHash,
      proof_hash: '',
      evaluated_at: new Date().toISOString(),
      evaluation_duration_ms: Date.now() - startTime,
      all_evaluated_rules: evaluated,
    };
    decision.proof_hash = policyProofHash(canonicalStringify(decision));
    return decision;
  }
}

// ---------------------------------------------------------------------------
// Policy Versioning
// ---------------------------------------------------------------------------

/** Create a new policy set with auto-versioning */
export function createPolicySet(
  name: string,
  rules: PolicyRule[],
  existingVersion?: number,
): PolicySet {
  const now = new Date().toISOString();
  return {
    policy_set_id: `ps_${blake3Hex(name + now).substring(0, 16)}`,
    version: (existingVersion || 0) + 1,
    name,
    rules,
    created_at: now,
    updated_at: now,
    hash: blake3Hex(canonicalStringify(rules)),
  };
}
