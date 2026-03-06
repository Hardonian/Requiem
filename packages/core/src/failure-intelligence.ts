/**
 * Failure Intelligence Layer
 *
 * Transforms execution failures into actionable learning signals.
 * Detects patterns, classifies root causes, and proposes automated
 * corrections.
 *
 * Categories:
 *   - environment_mismatch: missing env vars, wrong versions
 *   - tool_permission: tool denied by policy
 *   - api_key_absent: missing API keys / credentials
 *   - rate_limit: external API rate limiting
 *   - tool_schema_mismatch: tool input/output schema violations
 *   - network_failure: connectivity issues
 *   - timeout: execution exceeded time limit
 *   - cas_corruption: CAS integrity failure
 *   - budget_exceeded: cost/resource budget overrun
 */

import { canonicalStringify } from './canonical-json.js';
import { blake3Hex } from './hash.js';

// ---------------------------------------------------------------------------
// Failure Event Schema
// ---------------------------------------------------------------------------

export type FailureCategory =
  | 'environment_mismatch'
  | 'tool_permission'
  | 'api_key_absent'
  | 'rate_limit'
  | 'tool_schema_mismatch'
  | 'network_failure'
  | 'timeout'
  | 'cas_corruption'
  | 'budget_exceeded'
  | 'unknown';

export interface FailureEvent {
  failure_id: string;
  run_id: string;
  tenant_id: string;
  timestamp: string;
  category: FailureCategory;
  tool_id?: string;
  error_message: string;
  error_code?: string;
  context: Record<string, unknown>;
  stack_trace?: string;
  suggested_fix?: FailureFix;
  fingerprint: string; // dedup key
}

export interface FailureFix {
  action: 'set_env' | 'update_policy' | 'retry_with_backoff' | 'switch_provider' | 'add_budget' | 'fix_schema' | 'manual';
  description: string;
  auto_applicable: boolean;
  parameters?: Record<string, string>;
}

export interface FailurePattern {
  pattern_id: string;
  category: FailureCategory;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  affected_tenants: string[];
  affected_tools: string[];
  fingerprint: string;
  suggested_fix: FailureFix;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface FailureAnalytics {
  total_failures: number;
  by_category: Record<FailureCategory, number>;
  top_patterns: FailurePattern[];
  mean_time_to_fix_ms: number;
  auto_fixable_count: number;
  manual_required_count: number;
  trend: 'improving' | 'stable' | 'degrading';
}

// ---------------------------------------------------------------------------
// Failure Classification Engine
// ---------------------------------------------------------------------------

const ENV_VAR_PATTERNS = [
  /missing.*(?:env|environment).*(?:var|variable)/i,
  /(?:OPENAI|ANTHROPIC|AZURE|AWS|GCP|GITHUB|STRIPE|SENTRY)_(?:API_KEY|SECRET|TOKEN)/,
  /undefined.*(?:env|process\.env)/i,
  /environment variable.*not set/i,
];

const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /too many requests/i,
  /429/,
  /quota.*exceeded/i,
  /throttl/i,
];

const PERMISSION_PATTERNS = [
  /permission.*denied/i,
  /policy.*denied/i,
  /unauthorized/i,
  /forbidden/i,
  /403/,
  /access.*denied/i,
];

const NETWORK_PATTERNS = [
  /ECONNREFUSED/,
  /ENOTFOUND/,
  /ETIMEDOUT/,
  /network.*error/i,
  /connection.*reset/i,
  /socket.*hang.*up/i,
];

const TIMEOUT_PATTERNS = [
  /timeout/i,
  /timed.*out/i,
  /deadline.*exceeded/i,
];

const SCHEMA_PATTERNS = [
  /schema.*mismatch/i,
  /invalid.*input/i,
  /validation.*failed/i,
  /unexpected.*type/i,
  /required.*field/i,
];

/** Classify a failure into a category */
export function classifyFailure(
  errorMessage: string,
  errorCode?: string,
  context?: Record<string, unknown>,
): FailureCategory {
  const msg = errorMessage + (errorCode || '') + JSON.stringify(context || {});

  if (ENV_VAR_PATTERNS.some(p => p.test(msg))) return 'environment_mismatch';
  if (msg.match(/(?:API_KEY|SECRET_KEY|TOKEN|CREDENTIAL)/) && msg.match(/missing|undefined|not.?set/i)) return 'api_key_absent';
  if (RATE_LIMIT_PATTERNS.some(p => p.test(msg))) return 'rate_limit';
  if (PERMISSION_PATTERNS.some(p => p.test(msg))) return 'tool_permission';
  if (NETWORK_PATTERNS.some(p => p.test(msg))) return 'network_failure';
  if (TIMEOUT_PATTERNS.some(p => p.test(msg))) return 'timeout';
  if (SCHEMA_PATTERNS.some(p => p.test(msg))) return 'tool_schema_mismatch';
  if (/cas.*(?:corrupt|integrity|mismatch)/i.test(msg)) return 'cas_corruption';
  if (/budget|cost.*limit|spend.*limit/i.test(msg)) return 'budget_exceeded';

  return 'unknown';
}

/** Generate a suggested fix based on failure category */
export function suggestFix(
  category: FailureCategory,
  context: Record<string, unknown>,
): FailureFix {
  switch (category) {
    case 'environment_mismatch':
    case 'api_key_absent': {
      const varName = extractEnvVarName(context);
      return {
        action: 'set_env',
        description: varName
          ? `Set missing environment variable: ${varName}`
          : 'Configure required environment variables',
        auto_applicable: false,
        parameters: varName ? { variable: varName } : undefined,
      };
    }
    case 'tool_permission':
      return {
        action: 'update_policy',
        description: 'Update policy to grant tool access',
        auto_applicable: false,
        parameters: context.tool_id ? { tool_id: String(context.tool_id) } : undefined,
      };
    case 'rate_limit':
      return {
        action: 'retry_with_backoff',
        description: 'Retry with exponential backoff (2s, 4s, 8s, 16s)',
        auto_applicable: true,
        parameters: { initial_delay_ms: '2000', max_retries: '4' },
      };
    case 'network_failure':
      return {
        action: 'retry_with_backoff',
        description: 'Network error — retry with backoff',
        auto_applicable: true,
        parameters: { initial_delay_ms: '1000', max_retries: '3' },
      };
    case 'timeout':
      return {
        action: 'retry_with_backoff',
        description: 'Execution timed out — increase timeout or retry',
        auto_applicable: false,
        parameters: { suggested_timeout_ms: '60000' },
      };
    case 'tool_schema_mismatch':
      return {
        action: 'fix_schema',
        description: 'Tool input/output does not match expected schema',
        auto_applicable: false,
      };
    case 'cas_corruption':
      return {
        action: 'manual',
        description: 'CAS integrity failure — run verify:integrity to diagnose',
        auto_applicable: false,
      };
    case 'budget_exceeded':
      return {
        action: 'add_budget',
        description: 'Execution exceeded budget — increase limit or optimize usage',
        auto_applicable: false,
      };
    default:
      return {
        action: 'manual',
        description: 'Unknown failure — manual investigation required',
        auto_applicable: false,
      };
  }
}

/** Create a failure event from an error */
export function createFailureEvent(
  runId: string,
  tenantId: string,
  errorMessage: string,
  errorCode?: string,
  context: Record<string, unknown> = {},
  toolId?: string,
): FailureEvent {
  const category = classifyFailure(errorMessage, errorCode, context);
  const fingerprint = blake3Hex(
    canonicalStringify({ category, tool_id: toolId, error_code: errorCode, message_pattern: errorMessage.substring(0, 100) })
  ).substring(0, 32);

  return {
    failure_id: `fail_${blake3Hex(runId + Date.now().toString()).substring(0, 16)}`,
    run_id: runId,
    tenant_id: tenantId,
    timestamp: new Date().toISOString(),
    category,
    tool_id: toolId,
    error_message: errorMessage,
    error_code: errorCode,
    context,
    suggested_fix: suggestFix(category, { ...context, tool_id: toolId }),
    fingerprint,
  };
}

// ---------------------------------------------------------------------------
// Failure Registry (in-memory for now, persisted via event log)
// ---------------------------------------------------------------------------

export class FailureRegistry {
  private events: FailureEvent[] = [];
  private patterns: Map<string, FailurePattern> = new Map();

  record(event: FailureEvent): void {
    this.events.push(event);
    this.updatePattern(event);
  }

  private updatePattern(event: FailureEvent): void {
    const existing = this.patterns.get(event.fingerprint);
    if (existing) {
      existing.occurrence_count++;
      existing.last_seen = event.timestamp;
      if (!existing.affected_tenants.includes(event.tenant_id)) {
        existing.affected_tenants.push(event.tenant_id);
      }
      if (event.tool_id && !existing.affected_tools.includes(event.tool_id)) {
        existing.affected_tools.push(event.tool_id);
      }
      // Escalate severity based on occurrence count
      if (existing.occurrence_count >= 50) existing.severity = 'critical';
      else if (existing.occurrence_count >= 20) existing.severity = 'high';
      else if (existing.occurrence_count >= 5) existing.severity = 'medium';
    } else {
      this.patterns.set(event.fingerprint, {
        pattern_id: `pat_${event.fingerprint.substring(0, 16)}`,
        category: event.category,
        occurrence_count: 1,
        first_seen: event.timestamp,
        last_seen: event.timestamp,
        affected_tenants: [event.tenant_id],
        affected_tools: event.tool_id ? [event.tool_id] : [],
        fingerprint: event.fingerprint,
        suggested_fix: event.suggested_fix || suggestFix(event.category, event.context),
        severity: 'low',
      });
    }
  }

  getAnalytics(): FailureAnalytics {
    const byCategory = {} as Record<FailureCategory, number>;
    for (const event of this.events) {
      byCategory[event.category] = (byCategory[event.category] || 0) + 1;
    }

    const patterns = Array.from(this.patterns.values());
    const topPatterns = patterns
      .sort((a, b) => b.occurrence_count - a.occurrence_count)
      .slice(0, 10);

    const autoFixable = this.events.filter(e => e.suggested_fix?.auto_applicable).length;

    // Trend: compare last 100 vs previous 100
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (this.events.length >= 200) {
      const recent = this.events.slice(-100).length;
      const previous = this.events.slice(-200, -100).length;
      if (recent < previous * 0.8) trend = 'improving';
      else if (recent > previous * 1.2) trend = 'degrading';
    }

    return {
      total_failures: this.events.length,
      by_category: byCategory,
      top_patterns: topPatterns,
      mean_time_to_fix_ms: 0, // populated when fixes are tracked
      auto_fixable_count: autoFixable,
      manual_required_count: this.events.length - autoFixable,
      trend,
    };
  }

  getPatterns(): FailurePattern[] {
    return Array.from(this.patterns.values());
  }

  getEventsByCategory(category: FailureCategory): FailureEvent[] {
    return this.events.filter(e => e.category === category);
  }

  getEventsByTenant(tenantId: string): FailureEvent[] {
    return this.events.filter(e => e.tenant_id === tenantId);
  }

  getEventsByTool(toolId: string): FailureEvent[] {
    return this.events.filter(e => e.tool_id === toolId);
  }

  size(): number {
    return this.events.length;
  }
}

// ---------------------------------------------------------------------------
// Retry Policy Engine
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  max_retries: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  retryable_categories: FailureCategory[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_retries: 4,
  initial_delay_ms: 2000,
  max_delay_ms: 16000,
  backoff_multiplier: 2,
  retryable_categories: ['rate_limit', 'network_failure', 'timeout'],
};

/** Determine if a failure should be retried and compute delay */
export function shouldRetry(
  event: FailureEvent,
  attemptNumber: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): { retry: boolean; delay_ms: number } {
  if (attemptNumber >= policy.max_retries) {
    return { retry: false, delay_ms: 0 };
  }

  if (!policy.retryable_categories.includes(event.category)) {
    return { retry: false, delay_ms: 0 };
  }

  const delay = Math.min(
    policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attemptNumber),
    policy.max_delay_ms,
  );

  return { retry: true, delay_ms: delay };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractEnvVarName(context: Record<string, unknown>): string | undefined {
  const msg = JSON.stringify(context);
  const match = msg.match(/(?:OPENAI|ANTHROPIC|AZURE|AWS|GCP|GITHUB|STRIPE|SENTRY)_(?:API_KEY|SECRET_KEY|TOKEN|SECRET|ACCESS_KEY)/);
  return match?.[0];
}
