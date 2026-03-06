export const FAILURE_CATEGORIES = [
  'CONFIG_MISSING',
  'API_KEY_MISSING',
  'PROVIDER_UNAVAILABLE',
  'MODEL_UNCONFIGURED',
  'ORG_CONFIG_MISSING',
  'WORKSPACE_CONFIG_MISSING',
  'PROJECT_CONFIG_MISSING',
  'PERMISSION_DENIED',
  'TOOL_UNAVAILABLE',
  'TOOL_SCHEMA_MISMATCH',
  'TOOL_CALL_INVALID',
  'NETWORK_TRANSIENT',
  'AUTH_EXPIRED',
  'REPLAY_ARTIFACT_MISSING',
  'PATCH_APPLY_FAILED',
  'REVIEW_MODEL_NOT_ENABLED',
  'FIXER_MODEL_NOT_ENABLED',
  'RATE_LIMITED',
  'UNSUPPORTED_RUNTIME',
  'UNKNOWN_RECOVERABLE',
  'UNKNOWN_FATAL',
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface FailureDiagnosis {
  category: FailureCategory;
  confidence: number;
  likely_cause: string;
  explanation: string;
  recommended_actions: string[];
  auto_remediation_eligible: boolean;
  escalation_required: boolean;
}

export interface ScopeConfig {
  provider_enabled?: boolean;
  provider_name?: string;
  api_key_present?: boolean;
  review_model?: string | null;
  fixer_model?: string | null;
  allow_inheritance?: boolean;
  permissions?: string[];
  repo_bound?: boolean;
}

export interface ConfigurationHierarchy {
  org?: ScopeConfig;
  workspace?: ScopeConfig;
  project?: ScopeConfig;
}

export interface ReadinessResult {
  status: 'Ready' | 'Partial' | 'Blocked' | 'Misconfigured' | 'Inherited' | 'Disabled by policy';
  review_ready: boolean;
  fixer_ready: boolean;
  inherited_from?: 'org' | 'workspace';
  provider_name?: string;
  reasons: string[];
  next_actions: string[];
}

export interface RunFailureSample {
  run_id: string;
  message: string;
  scope: 'org' | 'workspace' | 'project' | 'run';
}

export interface Insight {
  id: string;
  title: string;
  severity: Severity;
  priority: number;
  confidence: number;
  evidence_summary: string;
  affected_scope: 'org' | 'workspace' | 'project' | 'run';
  recommended_action: string;
  manual_trigger_available: boolean;
  auto_trigger_available: boolean;
  auto_trigger_blocked_reason?: string;
  deep_link_target: string;
  state: 'open' | 'snoozed' | 'resolved';
}

function hasPermission(perms: string[] | undefined, required: string): boolean {
  return Boolean(perms?.includes(required));
}

function firstDefined<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function computeReviewFixReadiness(config: ConfigurationHierarchy): ReadinessResult {
  const reasons: string[] = [];
  const nextActions: string[] = [];

  const org = config.org ?? {};
  const workspace = config.workspace ?? {};
  const project = config.project ?? {};

  const inheritedFrom = workspace.allow_inheritance === false ? undefined : project.allow_inheritance === false ? undefined : (project.provider_enabled ?? project.provider_name ?? project.api_key_present ?? project.review_model ?? project.fixer_model)
      ? undefined
      : (workspace.provider_enabled ?? workspace.provider_name ?? workspace.api_key_present ?? workspace.review_model ?? workspace.fixer_model)
        ? 'workspace'
        : 'org';

  const providerEnabled = firstDefined(project.provider_enabled, workspace.provider_enabled, org.provider_enabled) ?? false;
  const providerName = firstDefined(project.provider_name, workspace.provider_name, org.provider_name) ?? 'unconfigured-provider';
  const apiKeyPresent = firstDefined(project.api_key_present, workspace.api_key_present, org.api_key_present) ?? false;
  const reviewModel = firstDefined(project.review_model, workspace.review_model, org.review_model);
  const fixerModel = firstDefined(project.fixer_model, workspace.fixer_model, org.fixer_model);
  const repoBound = firstDefined(project.repo_bound, workspace.repo_bound, org.repo_bound) ?? false;
  const permissions = [...(org.permissions ?? []), ...(workspace.permissions ?? []), ...(project.permissions ?? [])];

  if (!providerEnabled) {
    reasons.push('Model provider is disabled or not configured for this scope hierarchy.');
    nextActions.push('Enable at least one provider at org, workspace, or project scope.');
  }

  if (!apiKeyPresent) {
    reasons.push('No API key/secret reference is configured for the selected provider.');
    nextActions.push('Add provider API key at org/workspace/project settings.');
  }

  if (!reviewModel) {
    reasons.push('Review model routing is not configured.');
    nextActions.push('Set a review model route in configuration.');
  }

  if (!fixerModel) {
    reasons.push('Fixer model routing is not configured.');
    nextActions.push('Set a fixer model route or operate in review-only mode.');
  }

  if (!repoBound) {
    reasons.push('Project repository/worktree is not bound.');
    nextActions.push('Attach repository binding before patch-apply operations.');
  }

  if (!hasPermission(permissions, 'review:trigger')) {
    reasons.push('Missing permission: review:trigger');
    nextActions.push('Grant review trigger capability to actor/workspace role.');
  }

  const reviewReady = providerEnabled && apiKeyPresent && Boolean(reviewModel) && hasPermission(permissions, 'review:trigger');
  const fixerReady =
    reviewReady && Boolean(fixerModel) && repoBound && hasPermission(permissions, 'fixer:trigger') && hasPermission(permissions, 'patch:apply');

  if (!hasPermission(permissions, 'fixer:trigger')) {
    reasons.push('Missing permission: fixer:trigger');
    nextActions.push('Grant fixer trigger capability or keep manual remediation only.');
  }

  if (!hasPermission(permissions, 'patch:apply')) {
    reasons.push('Missing permission: patch:apply');
    nextActions.push('Require approval workflow for patch apply or grant capability.');
  }

  let status: ReadinessResult['status'] = 'Blocked';
  if (reviewReady && fixerReady) {
    status = inheritedFrom ? 'Inherited' : 'Ready';
  } else if (reviewReady && !fixerReady) {
    status = 'Partial';
  } else if (!providerEnabled || !apiKeyPresent) {
    status = 'Blocked';
  } else {
    status = 'Misconfigured';
  }

  return {
    status,
    review_ready: reviewReady,
    fixer_ready: fixerReady,
    inherited_from: inheritedFrom,
    provider_name: providerName,
    reasons,
    next_actions: nextActions,
  };
}

export function diagnoseFailure(message: string): FailureDiagnosis {
  const lowered = message.toLowerCase();

  if (lowered.includes('api key') || lowered.includes('secret') || lowered.includes('token missing')) {
    return {
      category: 'API_KEY_MISSING',
      confidence: 0.94,
      likely_cause: 'Provider credentials were not configured in active scope.',
      explanation: 'Execution could not access model/tool credentials.',
      recommended_actions: ['Add key at org/workspace/project scope', 'Retry execution after secret validation'],
      auto_remediation_eligible: false,
      escalation_required: false,
    };
  }

  if (lowered.includes('permission denied') || lowered.includes('forbidden')) {
    return {
      category: 'PERMISSION_DENIED',
      confidence: 0.93,
      likely_cause: 'Actor role lacks required capability for this action.',
      explanation: 'The workflow was blocked by authorization policy.',
      recommended_actions: ['Request required capability', 'Trigger manual approval flow'],
      auto_remediation_eligible: false,
      escalation_required: true,
    };
  }

  if (lowered.includes('rate limit') || lowered.includes('429')) {
    return {
      category: 'RATE_LIMITED',
      confidence: 0.9,
      likely_cause: 'Provider throttled request volume.',
      explanation: 'Request quota/rate threshold was exceeded.',
      recommended_actions: ['Retry with backoff', 'Switch to fallback provider if allowed'],
      auto_remediation_eligible: true,
      escalation_required: false,
    };
  }

  if (lowered.includes('timeout') || lowered.includes('network') || lowered.includes('econnreset')) {
    return {
      category: 'NETWORK_TRANSIENT',
      confidence: 0.81,
      likely_cause: 'Transient connectivity failure to external tool/provider.',
      explanation: 'Execution failed due to a likely recoverable network condition.',
      recommended_actions: ['Retry failed step', 'Enable auto-retry for transient class'],
      auto_remediation_eligible: true,
      escalation_required: false,
    };
  }

  if (lowered.includes('model') && lowered.includes('not enabled')) {
    return {
      category: 'MODEL_UNCONFIGURED',
      confidence: 0.88,
      likely_cause: 'Configured model is disabled or unavailable in scope.',
      explanation: 'Requested model route is not currently enabled.',
      recommended_actions: ['Select an enabled model', 'Update review/fixer routing'],
      auto_remediation_eligible: false,
      escalation_required: false,
    };
  }

  if (lowered.includes('artifact') && lowered.includes('missing')) {
    return {
      category: 'REPLAY_ARTIFACT_MISSING',
      confidence: 0.86,
      likely_cause: 'Replay dependencies were not persisted for source run.',
      explanation: 'Deterministic replay is unavailable for this run.',
      recommended_actions: ['Run partial replay', 'Enable artifact persistence for future runs'],
      auto_remediation_eligible: false,
      escalation_required: false,
    };
  }

  return {
    category: 'UNKNOWN_RECOVERABLE',
    confidence: 0.42,
    likely_cause: 'No deterministic classifier match from current signal.',
    explanation: 'Failure could not be confidently categorized.',
    recommended_actions: ['Inspect run timeline', 'Trigger manual review'],
    auto_remediation_eligible: false,
    escalation_required: false,
  };
}

export function generateActionableInsights(
  failures: RunFailureSample[],
  readiness: ReadinessResult,
  sampleWindowLabel = '7d',
): Insight[] {
  const insights: Insight[] = [];

  if (failures.length === 0) {
    insights.push({
      id: 'insight-insufficient-failure-data',
      title: 'Not enough failed runs to compute failure trends',
      severity: 'low',
      priority: 1,
      confidence: 0.7,
      evidence_summary: `No failed runs observed in ${sampleWindowLabel} sample window.`,
      affected_scope: 'workspace',
      recommended_action: 'Collect more completed runs or import workflow history for stronger diagnostics.',
      manual_trigger_available: false,
      auto_trigger_available: false,
      auto_trigger_blocked_reason: 'insufficient_data',
      deep_link_target: '/app/executions',
      state: 'open',
    });
  }

  const apiKeyFailures = failures.filter((failure) => diagnoseFailure(failure.message).category === 'API_KEY_MISSING');
  if (apiKeyFailures.length > 0) {
    insights.push({
      id: 'insight-api-key-gap',
      title: 'Repeated failures indicate missing provider API keys',
      severity: 'high',
      priority: 9,
      confidence: 0.9,
      evidence_summary: `${apiKeyFailures.length} failed run(s) map to API_KEY_MISSING diagnosis.`,
      affected_scope: 'workspace',
      recommended_action: 'Configure provider secret and retry affected runs.',
      manual_trigger_available: true,
      auto_trigger_available: false,
      auto_trigger_blocked_reason: 'requires_secret_material',
      deep_link_target: '/settings',
      state: 'open',
    });
  }

  if (!readiness.review_ready) {
    insights.push({
      id: 'insight-review-not-ready',
      title: 'Review trigger is blocked by configuration readiness',
      severity: 'medium',
      priority: 7,
      confidence: 0.95,
      evidence_summary: readiness.reasons.slice(0, 3).join(' '),
      affected_scope: 'project',
      recommended_action: readiness.next_actions[0] ?? 'Open settings and complete review readiness checks.',
      manual_trigger_available: true,
      auto_trigger_available: false,
      auto_trigger_blocked_reason: 'review_not_ready',
      deep_link_target: '/settings',
      state: 'open',
    });
  }

  if (readiness.review_ready && !readiness.fixer_ready) {
    insights.push({
      id: 'insight-fixer-fallback-review-only',
      title: 'Fixer automation unavailable; review-only fallback is active',
      severity: 'medium',
      priority: 6,
      confidence: 0.92,
      evidence_summary: readiness.reasons.join(' '),
      affected_scope: 'project',
      recommended_action: 'Run review manually or enable fixer model and patch permissions.',
      manual_trigger_available: true,
      auto_trigger_available: false,
      auto_trigger_blocked_reason: 'fixer_not_ready',
      deep_link_target: '/app/diagnostics',
      state: 'open',
    });
  }

  return insights;
}
