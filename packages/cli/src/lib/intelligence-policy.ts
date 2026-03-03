export interface IntelligencePolicyConfig {
  testsPassThreshold: number;
  budgetWithinThreshold: number;
  policyAllowThreshold: number;
  enforceCaseReuseVerification: boolean;
  mode: 'warn' | 'deny';
}

export interface GateDecision {
  allow: boolean;
  required_checks: string[];
  warnings: string[];
}

export function loadIntelligencePolicyConfig(): IntelligencePolicyConfig {
  return {
    testsPassThreshold: Number(process.env.REQUIEM_CONFIDENCE_TESTS_THRESHOLD ?? '0.7'),
    budgetWithinThreshold: Number(process.env.REQUIEM_CONFIDENCE_BUDGET_THRESHOLD ?? '0.65'),
    policyAllowThreshold: Number(process.env.REQUIEM_CONFIDENCE_POLICY_THRESHOLD ?? '0.8'),
    enforceCaseReuseVerification: (process.env.REQUIEM_CASE_REUSE_VERIFY ?? 'true') === 'true',
    mode: (process.env.REQUIEM_CONFIDENCE_GATE_MODE as 'warn' | 'deny') || 'warn',
  };
}

export function evaluateConfidenceGate(action: string, claimType: string, probability: number): GateDecision {
  const cfg = loadIntelligencePolicyConfig();
  const required: string[] = [];
  const warnings: string[] = [];

  if (action === 'apply_patch' && claimType === 'TESTS_PASS' && probability < cfg.testsPassThreshold) {
    required.push('run_targeted_tests', 'generate_second_independent_plan');
    warnings.push(`TESTS_PASS confidence ${probability.toFixed(2)} below threshold ${cfg.testsPassThreshold.toFixed(2)}`);
  }
  if (claimType === 'BUDGET_WITHIN' && probability < cfg.budgetWithinThreshold) {
    required.push('run_spend_simulation');
    warnings.push(`BUDGET_WITHIN confidence ${probability.toFixed(2)} below threshold ${cfg.budgetWithinThreshold.toFixed(2)}`);
  }
  if (claimType === 'POLICY_ALLOW' && probability < cfg.policyAllowThreshold) {
    required.push('policy_dry_run_with_denial_reasons');
    warnings.push(`POLICY_ALLOW confidence ${probability.toFixed(2)} below threshold ${cfg.policyAllowThreshold.toFixed(2)}`);
  }

  const allow = cfg.mode === 'deny' ? required.length === 0 : true;
  return { allow, required_checks: required, warnings };
}

export function evaluateCaseReusePolicy(params: { testsVerified: boolean; buildVerified: boolean }): GateDecision {
  const cfg = loadIntelligencePolicyConfig();
  if (!cfg.enforceCaseReuseVerification) {
    return { allow: true, required_checks: [], warnings: [] };
  }

  const required: string[] = [];
  if (!params.testsVerified) required.push('targeted_tests_required');
  if (!params.buildVerified) required.push('targeted_build_required');

  const allow = cfg.mode === 'deny' ? required.length === 0 : true;
  return {
    allow,
    required_checks: required,
    warnings: required.length > 0 ? ['Case reuse requires targeted verification before apply.'] : [],
  };
}
