/**
 * Policy Simulation Engine — Deterministic policy evaluation
 *
 * INVARIANT: All evaluations are deterministic
 * INVARIANT: No external state during evaluation
 * INVARIANT: Results are stable for same inputs
 */

export interface PolicyRule {
  id: string;
  name: string;
  condition: (ctx: PolicyContext) => boolean;
  action: 'allow' | 'deny' | 'modify';
  reason: string;
  priority: number;
}

export interface PolicyContext {
  runId: string;
  tenantId: string;
  inputFingerprint: string;
  outputFingerprint: string | null;
  toolName: string;
  costCents: number;
  latencyMs: number;
  tags: string[];
  custom: Record<string, unknown>;
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  reason: string;
  severity: 'error' | 'warning';
}

export interface PolicySimulationResult {
  runId: string;
  policyName: string;
  wouldAllow: boolean;
  wouldBlock: boolean;
  wouldModify: boolean;
  violations: PolicyViolation[];
  modifications: Array<{ field: string; from: unknown; to: unknown }>;
  appliedRules: string[];
  skippedRules: string[];
  resultHash: string;
  evaluatedAt: string; // Display only
}

// Pre-defined policy profiles
export const POLICY_PROFILES: Record<string, PolicyRule[]> = {
  strict: [
    {
      id: 'strict-cost',
      name: 'Cost Limit',
      condition: (ctx) => ctx.costCents > 1000,
      action: 'deny',
      reason: 'Cost exceeds $10 limit',
      priority: 100,
    },
    {
      id: 'strict-latency',
      name: 'Latency Limit',
      condition: (ctx) => ctx.latencyMs > 30000,
      action: 'deny',
      reason: 'Latency exceeds 30s limit',
      priority: 90,
    },
    {
      id: 'strict-output',
      name: 'Output Verification',
      condition: (ctx) => !ctx.outputFingerprint,
      action: 'deny',
      reason: 'Missing output fingerprint',
      priority: 80,
    },
  ],
  lenient: [
    {
      id: 'lenient-cost',
      name: 'Cost Warning',
      condition: (ctx) => ctx.costCents > 5000,
      action: 'modify',
      reason: 'High cost - adding review flag',
      priority: 50,
    },
    {
      id: 'lenient-latency',
      name: 'Latency Warning',
      condition: (ctx) => ctx.latencyMs > 60000,
      action: 'modify',
      reason: 'High latency - adding cache hint',
      priority: 40,
    },
  ],
  enterprise: [
    {
      id: 'ent-gdpr',
      name: 'GDPR Compliance',
      condition: (ctx) => ctx.tags.includes('pii') && !ctx.tags.includes('gdpr-approved'),
      action: 'deny',
      reason: 'PII processing requires GDPR approval',
      priority: 1000,
    },
    {
      id: 'ent-audit',
      name: 'Audit Trail',
      condition: () => true,
      action: 'modify',
      reason: 'Adding audit metadata',
      priority: 10,
    },
  ],
};

/**
 * Simulate policy evaluation for a run
 */
export function simulatePolicy(
  runId: string,
  policyName: string,
  context: PolicyContext,
  customRules?: PolicyRule[]
): PolicySimulationResult {
  const rules = customRules || POLICY_PROFILES[policyName] || [];

  // Sort by priority (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  const violations: PolicyViolation[] = [];
  const modifications: Array<{ field: string; from: unknown; to: unknown }> = [];
  const appliedRules: string[] = [];
  const skippedRules: string[] = [];

  let wouldAllow = true;
  let wouldBlock = false;
  let wouldModify = false;

  for (const rule of sortedRules) {
    try {
      const matches = rule.condition(context);

      if (matches) {
        appliedRules.push(rule.id);

        switch (rule.action) {
          case 'deny':
            wouldAllow = false;
            wouldBlock = true;
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              reason: rule.reason,
              severity: 'error',
            });
            break;

          case 'modify':
            wouldModify = true;
            modifications.push({
              field: `policy_${rule.id}`,
              from: undefined,
              to: rule.reason,
            });
            violations.push({
              ruleId: rule.id,
              ruleName: rule.name,
              reason: rule.reason,
              severity: 'warning',
            });
            break;

          case 'allow':
            // Explicit allow can override deny in some policies
            break;
        }
      } else {
        skippedRules.push(rule.id);
      }
    } catch (e) {
      // Rule evaluation error - treat as violation
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        reason: `Evaluation error: ${(e as Error).message}`,
        severity: 'error',
      });
    }
  }

  // Build result
  const result: PolicySimulationResult = {
    runId,
    policyName,
    wouldAllow,
    wouldBlock,
    wouldModify,
    violations,
    modifications,
    appliedRules,
    skippedRules,
    resultHash: '', // Will be set below
    evaluatedAt: new Date().toISOString(),
  };

  // Compute deterministic hash
  result.resultHash = computePolicyHash(result);

  return result;
}

/**
 * Compute deterministic policy result hash
 */
function computePolicyHash(result: Omit<PolicySimulationResult, 'resultHash' | 'evaluatedAt'>): string {
  const stableObj = {
    runId: result.runId,
    policyName: result.policyName,
    wouldAllow: result.wouldAllow,
    wouldBlock: result.wouldBlock,
    wouldModify: result.wouldModify,
    violationCount: result.violations.length,
    modificationCount: result.modifications.length,
    appliedRules: [...result.appliedRules].sort(),
  };

  const json = JSON.stringify(stableObj, Object.keys(stableObj).sort());

  // Simple hash function for determinism
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Format policy simulation result as table
 */
export function formatPolicyResultAsTable(result: PolicySimulationResult): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ POLICY SIMULATION                                          │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Run ID:      ${result.runId.substring(0, 40).padEnd(40)}│`,
    `│  Policy:      ${result.policyName.padEnd(40)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Result:      ${result.wouldBlock ? '❌ WOULD BLOCK' : result.wouldModify ? '⚠️  WOULD MODIFY' : '✅ WOULD ALLOW'}`.padEnd(61) + '│',
    `│  Rules Applied: ${result.appliedRules.length.toString().padEnd(38)}│`,
    `│  Rules Skipped: ${result.skippedRules.length.toString().padEnd(38)}│`,
  ];

  if (result.violations.length > 0) {
    lines.push('├────────────────────────────────────────────────────────────┤');
    lines.push('│  VIOLATIONS                                                │');
    for (const v of result.violations) {
      const icon = v.severity === 'error' ? '❌' : '⚠️';
      lines.push(`│  ${icon} ${v.ruleName.substring(0, 52).padEnd(52)}│`);
      lines.push(`│     ${v.reason.substring(0, 55).padEnd(55)}│`);
    }
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Result Hash: ${result.resultHash.substring(0, 16)}...`.padEnd(61) + '│');
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

/**
 * List available policy profiles
 */
export function listPolicyProfiles(): string[] {
  return Object.keys(POLICY_PROFILES);
}

