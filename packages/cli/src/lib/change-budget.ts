/**
 * Change Budget Governance (Differentiator C)
 *
 * Semantic diff budgets for controlled AI execution governance.
 * Enforces drift category thresholds per workflow/policy.
 *
 * INVARIANT: Budget checking is deterministic.
 * INVARIANT: Fail-closed (no budget = no approval).
 * INVARIANT: Integrates with existing drift taxonomy.
 */

import {
  type SemanticState,
  type SemanticTransition,
  type DriftCategory,
  DriftCategory as DriftCategoryValue,
  classifyDrift,
  type ChangeVector,
} from './semantic-state-machine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Significance levels for change thresholds.
 */
export type SignificanceLevel = 'critical' | 'major' | 'minor' | 'cosmetic';

/**
 * Budget rule for a specific drift category.
 */
export interface BudgetRule {
  /** Drift category this rule applies to */
  category: DriftCategory;
  /** Maximum allowed significance (inclusive). null = disallowed entirely. */
  maxSignificance: SignificanceLevel | null;
  /** Whether this category requires explicit approval regardless of significance */
  requiresApproval: boolean;
  /** Custom message when this rule is violated */
  violationMessage?: string;
}

/**
 * Change budget definition.
 */
export interface ChangeBudget {
  /** Budget version for migrations */
  version: '1.0.0';
  /** Budget name/identifier */
  name: string;
  /** Rules per drift category */
  rules: Map<DriftCategory, BudgetRule>;
  /** Default rule for categories not explicitly listed */
  defaultRule: Omit<BudgetRule, 'category'>;
  /** When this budget was created */
  createdAt: string;
}

/**
 * Budget check result.
 */
export interface BudgetCheckResult {
  /** Whether the transition is within budget */
  withinBudget: boolean;
  /** Detailed results per drift category */
  categoryResults: CategoryCheckResult[];
  /** Overall summary */
  summary: {
    totalChanges: number;
    allowedChanges: number;
    blockedChanges: number;
    needsApproval: number;
  };
  /** Human-readable explanation */
  explanation: string;
}

export interface CategoryCheckResult {
  category: DriftCategory;
  significance: SignificanceLevel;
  allowed: boolean;
  requiresApproval: boolean;
  message: string;
  changeVectors: ChangeVector[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNIFICANCE ORDERING
// ═══════════════════════════════════════════════════════════════════════════════

const SIGNIFICANCE_ORDER: SignificanceLevel[] = ['cosmetic', 'minor', 'major', 'critical'];

function significanceRank(level: SignificanceLevel): number {
  return SIGNIFICANCE_ORDER.indexOf(level);
}

function isSignificanceAllowed(
  actual: SignificanceLevel,
  maxAllowed: SignificanceLevel | null
): boolean {
  if (maxAllowed === null) return false;
  return significanceRank(actual) <= significanceRank(maxAllowed);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a permissive change budget (allow all changes).
 */
export function createPermissiveBudget(name: string): ChangeBudget {
  return {
    version: '1.0.0',
    name,
    rules: new Map(),
    defaultRule: {
      maxSignificance: 'critical',
      requiresApproval: false,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a strict change budget (require approval for most changes).
 */
export function createStrictBudget(name: string): ChangeBudget {
  const rules = new Map<DriftCategory, BudgetRule>();

  // Model and prompt drift always require approval
  rules.set(DriftCategoryValue.ModelDrift, {
    category: DriftCategoryValue.ModelDrift,
    maxSignificance: 'critical',
    requiresApproval: true,
    violationMessage: 'Model changes always require explicit approval',
  });

  rules.set(DriftCategoryValue.PromptDrift, {
    category: DriftCategoryValue.PromptDrift,
    maxSignificance: 'major',
    requiresApproval: true,
    violationMessage: 'Prompt changes require approval',
  });

  // Policy drift requires approval
  rules.set(DriftCategoryValue.PolicyDrift, {
    category: DriftCategoryValue.PolicyDrift,
    maxSignificance: 'major',
    requiresApproval: true,
    violationMessage: 'Policy changes require governance review',
  });

  return {
    version: '1.0.0',
    name,
    rules,
    defaultRule: {
      maxSignificance: 'minor',
      requiresApproval: false,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a production deployment budget.
 * Only allows minor/cosmetic changes without approval.
 */
export function createProductionBudget(name: string): ChangeBudget {
  const rules = new Map<DriftCategory, BudgetRule>();

  // No model changes in production without approval
  rules.set(DriftCategoryValue.ModelDrift, {
    category: DriftCategoryValue.ModelDrift,
    maxSignificance: null, // Disallowed entirely
    requiresApproval: true,
    violationMessage: 'Model changes are BLOCKED in production budget',
  });

  // No prompt changes without approval
  rules.set(DriftCategoryValue.PromptDrift, {
    category: DriftCategoryValue.PromptDrift,
    maxSignificance: null,
    requiresApproval: true,
    violationMessage: 'Prompt changes are BLOCKED in production budget',
  });

  // No policy changes without approval
  rules.set(DriftCategoryValue.PolicyDrift, {
    category: DriftCategoryValue.PolicyDrift,
    maxSignificance: null,
    requiresApproval: true,
    violationMessage: 'Policy changes are BLOCKED in production budget',
  });

  // Context changes allowed if minor
  rules.set(DriftCategoryValue.ContextDrift, {
    category: DriftCategoryValue.ContextDrift,
    maxSignificance: 'minor',
    requiresApproval: false,
    violationMessage: 'Context changes beyond minor significance blocked',
  });

  return {
    version: '1.0.0',
    name,
    rules,
    defaultRule: {
      maxSignificance: 'cosmetic',
      requiresApproval: false,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a custom budget from a simple rule spec.
 */
export interface BudgetRuleSpec {
  category: DriftCategory;
  maxSignificance?: SignificanceLevel | 'none';
  requiresApproval?: boolean;
}

export function createCustomBudget(
  name: string,
  ruleSpecs: BudgetRuleSpec[],
  defaultMaxSignificance: SignificanceLevel = 'major'
): ChangeBudget {
  const rules = new Map<DriftCategory, BudgetRule>();

  for (const spec of ruleSpecs) {
    const maxSig = spec.maxSignificance === 'none' ? null : (spec.maxSignificance ?? 'critical');
    rules.set(spec.category, {
      category: spec.category,
      maxSignificance: maxSig,
      requiresApproval: spec.requiresApproval ?? false,
    });
  }

  return {
    version: '1.0.0',
    name,
    rules,
    defaultRule: {
      maxSignificance: defaultMaxSignificance,
      requiresApproval: false,
    },
    createdAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUDGET CHECKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a transition from one state to another is within budget.
 */
export function checkChangeBudget(
  budget: ChangeBudget,
  fromState: SemanticState | null,
  toState: SemanticState
): BudgetCheckResult {
  // If no from state (genesis), treat as no drift
  if (!fromState) {
    return {
      withinBudget: true,
      categoryResults: [],
      summary: {
        totalChanges: 0,
        allowedChanges: 0,
        blockedChanges: 0,
        needsApproval: 0,
      },
      explanation: 'Genesis state creation—no drift to evaluate.',
    };
  }

  // Classify the drift
  const drift = classifyDrift(fromState.descriptor, toState.descriptor);

  // Check each drift category
  const categoryResults: CategoryCheckResult[] = [];

  for (const category of drift.driftCategories) {
    const rule = budget.rules.get(category) ?? {
      ...budget.defaultRule,
      category,
    };

    // Get the most significant change vector for this category
    const categoryVectors = drift.changeVectors.filter(cv =>
      matchesCategory(cv, category)
    );

    const maxSignificance = categoryVectors.reduce<SignificanceLevel>((max, cv) => {
      return significanceRank(cv.significance) > significanceRank(max) ? cv.significance : max;
    }, 'cosmetic');

    const allowed = isSignificanceAllowed(maxSignificance, rule.maxSignificance);

    let message: string;
    if (!allowed) {
      if (rule.maxSignificance === null) {
        message = rule.violationMessage || `${category} is not allowed by this budget`;
      } else {
        message = rule.violationMessage ||
          `${category} significance ${maxSignificance} exceeds maximum allowed ${rule.maxSignificance}`;
      }
    } else if (rule.requiresApproval) {
      message = `${category} is within significance bounds but requires approval`;
    } else {
      message = `${category} is allowed`;
    }

    categoryResults.push({
      category,
      significance: maxSignificance,
      allowed,
      requiresApproval: allowed && rule.requiresApproval,
      message,
      changeVectors: categoryVectors,
    });
  }

  // If no drift categories but states differ, check for unknown drift
  if (categoryResults.length === 0) {
    const rule = budget.rules.get(DriftCategoryValue.UnknownDrift) ?? {
      ...budget.defaultRule,
      category: DriftCategoryValue.UnknownDrift,
    };

    const allowed = isSignificanceAllowed('cosmetic', rule.maxSignificance);

    categoryResults.push({
      category: DriftCategory.UnknownDrift,
      significance: 'cosmetic',
      allowed,
      requiresApproval: allowed && rule.requiresApproval,
      message: allowed ? 'Unknown drift is allowed' : 'Unknown drift is not allowed',
      changeVectors: [],
    });
  }

  // Calculate summary
  const blockedCount = categoryResults.filter(r => !r.allowed).length;
  const needsApprovalCount = categoryResults.filter(r => r.requiresApproval).length;

  const withinBudget = blockedCount === 0;

  const explanation = generateBudgetExplanation(
    budget.name,
    withinBudget,
    categoryResults,
    blockedCount,
    needsApprovalCount
  );

  return {
    withinBudget,
    categoryResults,
    summary: {
      totalChanges: categoryResults.length,
      allowedChanges: categoryResults.length - blockedCount,
      blockedChanges: blockedCount,
      needsApproval: needsApprovalCount,
    },
    explanation,
  };
}

/**
 * Check budget using transition record (for checking historical transitions).
 */
export function checkTransitionBudget(
  budget: ChangeBudget,
  transition: SemanticTransition
): Omit<BudgetCheckResult, 'categoryResults'> & { categoryResults: Omit<CategoryCheckResult, 'changeVectors'>[] } {
  // Reconstruct check from transition data
  const categoryResults: Omit<CategoryCheckResult, 'changeVectors'>[] = [];

  for (const category of transition.driftCategories) {
    const rule = budget.rules.get(category as DriftCategory) ?? {
      ...budget.defaultRule,
      category: category as DriftCategory,
    };

    // Get max significance from change vectors in transition
    const categoryVectors = transition.changeVectors.filter(cv =>
      matchesCategory(cv, category as DriftCategory)
    );

    const maxSignificance = categoryVectors.reduce<SignificanceLevel>((max, cv) => {
      return significanceRank(cv.significance) > significanceRank(max) ? cv.significance : max;
    }, 'cosmetic');

    const allowed = isSignificanceAllowed(maxSignificance, rule.maxSignificance);

    let message: string;
    if (!allowed) {
      if (rule.maxSignificance === null) {
        message = rule.violationMessage || `${category} is not allowed by this budget`;
      } else {
        message = rule.violationMessage ||
          `${category} significance ${maxSignificance} exceeds maximum allowed ${rule.maxSignificance}`;
      }
    } else if (rule.requiresApproval) {
      message = `${category} is within significance bounds but requires approval`;
    } else {
      message = `${category} is allowed`;
    }

    categoryResults.push({
      category: category as DriftCategory,
      significance: maxSignificance,
      allowed,
      requiresApproval: allowed && rule.requiresApproval,
      message,
    });
  }

  const blockedCount = categoryResults.filter(r => !r.allowed).length;
  const needsApprovalCount = categoryResults.filter(r => r.requiresApproval).length;
  const withinBudget = blockedCount === 0;

  return {
    withinBudget,
    categoryResults,
    summary: {
      totalChanges: categoryResults.length,
      allowedChanges: categoryResults.length - blockedCount,
      blockedChanges: blockedCount,
      needsApproval: needsApprovalCount,
    },
    explanation: generateBudgetExplanation(
      budget.name,
      withinBudget,
      categoryResults as CategoryCheckResult[],
      blockedCount,
      needsApprovalCount
    ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function matchesCategory(changeVector: ChangeVector, category: DriftCategory): boolean {
  // Map change vector paths to drift categories
  const pathCategoryMap: Record<string, DriftCategory> = {
    'modelId': DriftCategory.ModelDrift,
    'promptTemplate': DriftCategory.PromptDrift,
    'policySnapshotId': DriftCategory.PolicyDrift,
    'contextSnapshotId': DriftCategory.ContextDrift,
    'runtimeId': DriftCategory.RuntimeDrift,
    'evalSnapshotId': DriftCategory.EvalDrift,
    'metadata': DriftCategory.UnknownDrift,
  };

  return pathCategoryMap[changeVector.path] === category;
}

function generateBudgetExplanation(
  budgetName: string,
  withinBudget: boolean,
  categoryResults: CategoryCheckResult[],
  blockedCount: number,
  needsApprovalCount: number
): string {
  const parts: string[] = [];

  if (withinBudget && needsApprovalCount === 0) {
    parts.push(`✓ Transition is WITHIN budget "${budgetName}".`);
  } else if (withinBudget && needsApprovalCount > 0) {
    parts.push(`⚠ Transition is within budget "${budgetName}" but REQUIRES APPROVAL for ${needsApprovalCount} categor${needsApprovalCount === 1 ? 'y' : 'ies'}.`);
  } else {
    parts.push(`✗ Transition EXCEEDS budget "${budgetName}" with ${blockedCount} blocked categor${blockedCount === 1 ? 'y' : 'ies'}.`);
  }

  // Add details for blocked/approval-needed categories
  const noteworthy = categoryResults.filter(r => !r.allowed || r.requiresApproval);
  if (noteworthy.length > 0) {
    parts.push('Details:');
    for (const r of noteworthy) {
      const icon = !r.allowed ? '✗' : '⚠';
      parts.push(`  ${icon} ${r.category}: ${r.message}`);
    }
  }

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function serializeBudget(budget: ChangeBudget): string {
  const obj = {
    version: budget.version,
    name: budget.name,
    rules: Array.from(budget.rules.entries()).map(([category, rule]) => ({
      category,
      maxSignificance: rule.maxSignificance,
      requiresApproval: rule.requiresApproval,
      violationMessage: rule.violationMessage,
    })),
    defaultRule: budget.defaultRule,
    createdAt: budget.createdAt,
  };
  return JSON.stringify(obj, null, 2);
}

export function deserializeBudget(json: string): ChangeBudget {
  const obj = JSON.parse(json);
  const rules = new Map<DriftCategory, BudgetRule>();

  for (const rule of obj.rules) {
    rules.set(rule.category, {
      category: rule.category,
      maxSignificance: rule.maxSignificance,
      requiresApproval: rule.requiresApproval,
      violationMessage: rule.violationMessage,
    });
  }

  return {
    version: obj.version,
    name: obj.name,
    rules,
    defaultRule: obj.defaultRule,
    createdAt: obj.createdAt,
  };
}
