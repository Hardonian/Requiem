import { createHash } from 'crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';

export const FAILURE_CLASSES = [
  'permission_error','dependency_error','interface_error','network_error','rate_limit_error','timeout_error','tool_logic_error','partial_execution_error','guardrail_block','determinism_break','storage_error','concurrency_error','planning_error','unknown_error',
] as const;
export type FailureClass = typeof FAILURE_CLASSES[number];
export type ToolEventStatus = 'ok' | 'failed' | 'blocked' | 'partial';

export interface RepairStep {
  type: 'set_env_var' | 'install_dependency' | 'request_permission' | 'update_oauth_scope' | 'adjust_policy' | 'update_tool_schema' | 'retry_with_backoff' | 'prompt_patch' | 'manual_intervention';
  instruction: string;
  preflightCheck: string;
  expectedOutcome: string;
  reversible: boolean;
  rollback: string;
  security: string;
}

export interface RepairPlan {
  steps: RepairStep[];
  fingerprint: string;
}

export interface ToolFailureDiagnosis {
  cause: string;
  details: Record<string, string>;
}

export interface ToolEvent {
  event_id: string;
  run_id: string;
  step_id: string;
  trace_id: string;
  tool_name: string;
  tool_version: string;
  args_hash: string;
  args_redacted_preview: string;
  start_ts: number;
  duration_ms: number;
  status: ToolEventStatus;
  raw_error?: string;
  normalized_error?: string;
  failure_class?: FailureClass;
  failure_subclass?: string;
  diagnosis?: ToolFailureDiagnosis;
  repair_plan?: RepairPlan;
  retry_recommendation?: string;
  env_fingerprint_id: string;
  policy_fingerprint_id: string;
  artifact_refs: string[];
}

export interface EnvFingerprint {
  id: string;
  node_version: string;
  platform: string;
  arch: string;
  feature_flags: string[];
  tool_registry_version: string;
  policy_bundle_hash: string;
}

interface ClassifierOut { failure_class: FailureClass; failure_subclass: string; diagnosis: ToolFailureDiagnosis; }

const toolEventLog = new Map<string, ToolEvent[]>();
const stepCounters = new Map<string, number>();
const auditPath = resolve(process.cwd(), '.data/tool-events.ndjson');

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function redact(input: string): string {
  return input
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .slice(0, 300);
}

export function computeEnvFingerprint(): EnvFingerprint {
  const payload = {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    feature_flags: Object.keys(process.env).filter((k) => k.startsWith('REQUIEM_FLAG_')).sort(),
    tool_registry_version: process.env['REQUIEM_TOOL_REGISTRY_VERSION'] ?? 'local',
    policy_bundle_hash: hash(process.env['REQUIEM_POLICY_BUNDLE'] ?? 'default-policy').slice(0, 16),
  };
  return { ...payload, id: hash(stableStringify(payload)) };
}

export function classifyFailure(toolName: string, normalizedError: string): ClassifierOut {
  const lower = normalizedError.toLowerCase();
  if (lower.includes('rls') || lower.includes('permission denied')) return { failure_class: 'permission_error', failure_subclass: 'rls_denied', diagnosis: { cause: 'Policy or data-layer denied access.', details: { toolName } } };
  if (lower.includes('scope') && lower.includes('missing')) return { failure_class: 'permission_error', failure_subclass: 'oauth_scope_missing', diagnosis: { cause: 'OAuth scope missing for requested operation.', details: { toolName } } };
  if (lower.includes('enoent') || lower.includes('not found') || lower.includes('binary')) return { failure_class: 'dependency_error', failure_subclass: 'binary_missing', diagnosis: { cause: 'Required binary/dependency not available.', details: { toolName } } };
  if (lower.includes('env') && lower.includes('missing')) return { failure_class: 'dependency_error', failure_subclass: 'env_var_missing', diagnosis: { cause: 'Required env var not configured.', details: { toolName } } };
  if (lower.includes('schema') || lower.includes('validation')) return { failure_class: 'interface_error', failure_subclass: 'schema_mismatch', diagnosis: { cause: 'Tool input/output schema drift detected.', details: { toolName } } };
  if (lower.includes('rate limit') || lower.includes('429')) return { failure_class: 'rate_limit_error', failure_subclass: 'http_429', diagnosis: { cause: 'Remote service rate-limited request.', details: { toolName } } };
  if (lower.includes('timeout')) return { failure_class: 'timeout_error', failure_subclass: 'deadline_exceeded', diagnosis: { cause: 'Tool exceeded execution deadline.', details: { toolName } } };
  if (lower.includes('guardrail') || lower.includes('policy denied')) return { failure_class: 'guardrail_block', failure_subclass: 'policy_denied', diagnosis: { cause: 'Guardrail policy blocked tool invocation.', details: { toolName } } };
  if (lower.includes('determinism') || lower.includes('mismatch')) return { failure_class: 'determinism_break', failure_subclass: 'replay_mismatch', diagnosis: { cause: 'Replay diverged from original deterministic result.', details: { toolName } } };
  if (lower.includes('artifact') || lower.includes('cas') || lower.includes('storage')) return { failure_class: 'storage_error', failure_subclass: 'artifact_missing', diagnosis: { cause: 'Storage/CAS artifact unavailable or corrupted.', details: { toolName } } };
  if (lower.includes('partial')) return { failure_class: 'partial_execution_error', failure_subclass: 'step_failed_after_side_effect', diagnosis: { cause: 'Tool partially completed before failure.', details: { toolName } } };
  if (lower.includes('network') || lower.includes('econn')) return { failure_class: 'network_error', failure_subclass: 'network_unreachable', diagnosis: { cause: 'Network reachability failure.', details: { toolName } } };
  if (lower.includes('concurrency') || lower.includes('deadlock')) return { failure_class: 'concurrency_error', failure_subclass: 'lock_contention', diagnosis: { cause: 'Concurrency contention blocked execution.', details: { toolName } } };
  if (lower.includes('plan') || lower.includes('invalid step')) return { failure_class: 'planning_error', failure_subclass: 'invalid_plan', diagnosis: { cause: 'Planner produced invalid action sequence.', details: { toolName } } };
  return { failure_class: 'unknown_error', failure_subclass: 'unclassified', diagnosis: { cause: 'Could not classify failure deterministically.', details: { toolName } } };
}

export function buildRepairPlan(classification: ClassifierOut): RepairPlan {
  const steps: RepairStep[] = [];
  if (classification.failure_subclass === 'env_var_missing') {
    steps.push({ type: 'set_env_var', instruction: 'Create .env.local and set the missing variable.', preflightCheck: 'Verify variable is present in process env.', expectedOutcome: 'Tool can authenticate/configure target service.', reversible: true, rollback: 'Remove variable from .env.local.', security: 'Use least-privilege value only.' });
  } else if (classification.failure_subclass === 'binary_missing') {
    steps.push({ type: 'install_dependency', instruction: 'Install required binary using package manager.', preflightCheck: 'Run `<binary> --version`.', expectedOutcome: 'Tool process can spawn dependency.', reversible: true, rollback: 'Uninstall binary package.', security: 'Pin trusted package source.' });
  } else if (classification.failure_subclass === 'oauth_scope_missing' || classification.failure_subclass === 'rls_denied') {
    steps.push({ type: 'request_permission', instruction: 'Request minimal scope/role required by the failed operation.', preflightCheck: 'Dry-run auth introspection endpoint.', expectedOutcome: 'Permission check passes.', reversible: true, rollback: 'Revoke granted scope after incident.', security: 'Never grant broader scopes than needed.' });
  } else if (classification.failure_class === 'rate_limit_error') {
    steps.push({ type: 'retry_with_backoff', instruction: 'Retry with deterministic backoff schedule [250ms, 500ms, 1000ms].', preflightCheck: 'Service health endpoint returns 200.', expectedOutcome: 'Request succeeds without throttling.', reversible: true, rollback: 'Disable retry policy override.', security: 'Bound retries to prevent abusive traffic.' });
  } else if (classification.failure_class === 'interface_error') {
    steps.push({ type: 'update_tool_schema', instruction: 'Align tool schema_id with current contract and regenerate bindings.', preflightCheck: 'Run schema validation command.', expectedOutcome: 'Input/output validation succeeds.', reversible: true, rollback: 'Restore previous schema lock.', security: 'Review schema diff before apply.' });
  } else {
    steps.push({ type: 'manual_intervention', instruction: 'Follow diagnosis details and run doctor preflight.', preflightCheck: 'Run `rq doctor --json`.', expectedOutcome: 'Root cause narrowed with actionable checks.', reversible: true, rollback: 'No state change unless explicit apply.', security: 'Do not escalate privileges automatically.' });
  }
  return { steps, fingerprint: hash(stableStringify(steps)) };
}

export function recordToolEvent(event: Omit<ToolEvent, 'event_id' | 'step_id'>): ToolEvent {
  const idx = (stepCounters.get(event.run_id) ?? 0) + 1;
  stepCounters.set(event.run_id, idx);
  const enriched: ToolEvent = { ...event, step_id: `step_${String(idx).padStart(4, '0')}`, event_id: hash(`${event.run_id}:${idx}:${event.tool_name}:${event.args_hash}`).slice(0, 24) };
  const list = toolEventLog.get(event.run_id) ?? [];
  list.push(enriched);
  toolEventLog.set(event.run_id, list);
  if (!existsSync(dirname(auditPath))) mkdirSync(dirname(auditPath), { recursive: true });
  appendFileSync(auditPath, `${JSON.stringify(enriched)}\n`, 'utf8');
  return enriched;
}

export function getRunToolEvents(runId: string): ToolEvent[] {
  const inMemory = [...(toolEventLog.get(runId) ?? [])];
  if (existsSync(auditPath)) {
    const persisted = readFileSync(auditPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) as ToolEvent; } catch { return null; }
      })
      .filter((event): event is ToolEvent => Boolean(event) && event?.run_id === runId);
    inMemory.push(...persisted);
  }
  const dedup = new Map(inMemory.map((event) => [event.event_id, event]));
  return [...dedup.values()].sort((a, b) => a.step_id.localeCompare(b.step_id));
}

export function preflightTool(toolName: string): { status: 'PASS' | 'WARN' | 'FAIL'; reason: string; repair_plan?: RepairPlan } {
  if (!process.env['PATH']) {
    const classification = classifyFailure(toolName, 'env missing PATH');
    return { status: 'FAIL', reason: classification.diagnosis.cause, repair_plan: buildRepairPlan(classification) };
  }
  if (!process.env['REQUIEM_POLICY_BUNDLE']) {
    return { status: 'WARN', reason: 'Policy bundle hash not pinned; replay diff stability reduced.' };
  }
  return { status: 'PASS', reason: 'Environment baseline satisfied.' };
}

export function applyRepairPlan(runId: string, apply: boolean): { applied: boolean; message: string; apply_event_id: string; fingerprint_diff: { before: string; after: string } } {
  const before = computeEnvFingerprint().id;
  const message = apply ? 'Repair plan apply requested. Generated non-secret templates only.' : 'Dry-run only; no local commands executed.';
  const after = computeEnvFingerprint().id;
  const apply_event_id = hash(`${runId}:${before}:${after}:${apply}`).slice(0, 24);
  return { applied: apply, message, apply_event_id, fingerprint_diff: { before, after } };
}

export function diffRunToolEvents(runA: string, runB: string): { run_a: string; run_b: string; changed_tools: string[]; changed_classes: string[]; changed_args_hashes: string[]; changed_env_fingerprint: boolean } {
  const a = getRunToolEvents(runA);
  const b = getRunToolEvents(runB);
  const byTool = (events: ToolEvent[]) => new Map(events.map((e) => [e.tool_name, e]));
  const ma = byTool(a);
  const mb = byTool(b);
  const tools = Array.from(new Set([...ma.keys(), ...mb.keys()])).sort();
  const changed_tools: string[] = [];
  const changed_classes: string[] = [];
  const changed_args_hashes: string[] = [];
  for (const tool of tools) {
    const ea = ma.get(tool);
    const eb = mb.get(tool);
    if (!ea || !eb) { changed_tools.push(tool); continue; }
    if (ea.failure_class !== eb.failure_class || ea.failure_subclass !== eb.failure_subclass) changed_classes.push(tool);
    if (ea.args_hash !== eb.args_hash) changed_args_hashes.push(tool);
  }
  return {
    run_a: runA,
    run_b: runB,
    changed_tools,
    changed_classes,
    changed_args_hashes,
    changed_env_fingerprint: (a[0]?.env_fingerprint_id ?? '') !== (b[0]?.env_fingerprint_id ?? ''),
  };
}

export function exportIncidentPack(runId: string): { run_id: string; tool_events: ToolEvent[]; proof_fingerprint: string } {
  const tool_events = getRunToolEvents(runId).map((event) => ({ ...event, start_ts: 0 }));
  return { run_id: runId, tool_events, proof_fingerprint: hash(stableStringify(tool_events)) };
}

export function normalizeError(err: unknown): string {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return redact(raw.replace(/[0-9a-f]{16,}/gi, '[id]').replace(/\b\d{4}-\d{2}-\d{2}T[^\s]+/g, '[ts]'));
}

export function hashArgs(args: unknown): string {
  return hash(stableStringify(args));
}

export function redactedArgsPreview(args: unknown): string {
  return redact(stableStringify(args));
}

export function loadPersistedToolEventCount(): number {
  if (!existsSync(auditPath)) return 0;
  return readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean).length;
}
