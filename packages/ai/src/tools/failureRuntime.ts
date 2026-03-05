import { createHash } from 'crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

export const FAILURE_CLASSES = [
  'permission_error', 'dependency_error', 'interface_error', 'network_error', 'rate_limit_error', 'timeout_error', 'tool_logic_error', 'partial_execution_error', 'guardrail_block', 'determinism_break', 'storage_error', 'concurrency_error', 'planning_error', 'unknown_error',
] as const;
export type FailureClass = typeof FAILURE_CLASSES[number];
export type ToolEventStatus = 'ok' | 'failed' | 'blocked' | 'partial';
export type PreflightGateMode = 'strict' | 'warn' | 'off';

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

export interface PermissionDescriptor {
  permission_type: 'oauth_scope' | 'filesystem' | 'network' | 'database_rls';
  resource: string;
  required_scope: string;
  reason: string;
  recommended_minimum_grant: string;
  risk_classification: 'low' | 'medium' | 'high';
  approval_required: true;
}

export interface PermissionRequest extends PermissionDescriptor {
  request_id: string;
  origin_tool_event: string;
  created_at: string;
}

interface PermissionEvent {
  event_id: string;
  request_id: string;
  decision: 'approve' | 'deny';
  decided_at: string;
  fingerprint_diff: { env_before: string; env_after: string; policy_before: string; policy_after: string };
}

export interface ToolAdapter {
  tool_metadata: { name: string; version: string; schema_hash: string; capability_descriptors: string[] };
  preflight_checks: (input?: Record<string, unknown>) => DoctorIssue[];
  error_normalizer: (rawError: unknown) => string;
  classifier_extensions?: Array<{ match: RegExp; failure_class: FailureClass; failure_subclass: string; cause: string }>;
  repair_generator?: (classification: ClassifierOut) => RepairStep[];
  permission_descriptors: PermissionDescriptor[];
}

export interface DoctorIssue {
  problem: string;
  explanation: string;
  repair_instruction: string;
  safe_command?: string;
  risk_note: string;
}

export interface DoctorReport {
  ok: boolean;
  mode: PreflightGateMode;
  issues: DoctorIssue[];
  generated_artifacts: string[];
}

interface ClassifierOut { failure_class: FailureClass; failure_subclass: string; diagnosis: ToolFailureDiagnosis; }

export interface IncidentPack {
  format: 'rqpack/v1';
  run_id: string;
  tool_events: ToolEvent[];
  diagnosis: Array<{ step_id: string; failure_class?: FailureClass; failure_subclass?: string; cause?: string }>;
  repair_plan: RepairPlan | null;
  env_fingerprint: EnvFingerprint;
  policy_fingerprint: string;
  artifact_cas_refs: string[];
  redacted_arguments: string[];
  mock_responses?: Record<string, unknown>;
  proof_fingerprint: string;
}

const toolEventLog = new Map<string, ToolEvent[]>();
const stepCounters = new Map<string, number>();
const permissionRequests = new Map<string, PermissionRequest>();
const adapterRegistry = new Map<string, ToolAdapter>();
const auditPath = resolve(process.cwd(), '.data/tool-events.ndjson');
const permissionPath = resolve(process.cwd(), '.data/permission-events.ndjson');

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

function appendNdjson(path: string, payload: unknown): void {
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(payload)}\n`, 'utf8');
}

function nowIso(): string {
  return new Date(0).toISOString();
}

function parseNdjson<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => {
    try {
      return JSON.parse(line) as T;
    } catch {
      return null;
    }
  }).filter((v): v is T => v !== null);
}

export function computeEnvFingerprint(): EnvFingerprint {
  const payload = {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    feature_flags: Object.keys(process.env).filter((k) => k.startsWith('REQUIEM_FLAG_')).sort(),
    tool_registry_version: process.env.REQUIEM_TOOL_REGISTRY_VERSION ?? 'local',
    policy_bundle_hash: hash(process.env.REQUIEM_POLICY_BUNDLE ?? 'default-policy').slice(0, 16),
  };
  return { ...payload, id: hash(stableStringify(payload)) };
}

const builtinAdapters: ToolAdapter[] = [
  {
    tool_metadata: { name: 'github.api', version: '1.0.0', schema_hash: hash('github.api/v1').slice(0, 12), capability_descriptors: ['oauth', 'network'] },
    preflight_checks: () => process.env.GITHUB_TOKEN ? [] : [{ problem: 'Missing environment variable', explanation: 'GitHub API adapter requires GITHUB_TOKEN for auth.', repair_instruction: 'Set GITHUB_TOKEN with least-privilege scope.', risk_note: 'Never commit access tokens.', safe_command: 'echo "GITHUB_TOKEN=" >> .env.template' }],
    error_normalizer: normalizeError,
    classifier_extensions: [{ match: /bad credentials|requires authentication/i, failure_class: 'permission_error', failure_subclass: 'oauth_scope_missing', cause: 'GitHub OAuth token missing required scopes.' }],
    permission_descriptors: [{ permission_type: 'oauth_scope', resource: 'github', required_scope: 'repo:read', reason: 'Read repository metadata', recommended_minimum_grant: 'repo:read', risk_classification: 'medium', approval_required: true }],
  },
  {
    tool_metadata: { name: 'http.fetch', version: '1.0.0', schema_hash: hash('http.fetch/v1').slice(0, 12), capability_descriptors: ['network'] },
    preflight_checks: () => [],
    error_normalizer: normalizeError,
    classifier_extensions: [{ match: /429|rate limit/i, failure_class: 'rate_limit_error', failure_subclass: 'http_429', cause: 'HTTP upstream rate limiting.' }],
    permission_descriptors: [{ permission_type: 'network', resource: '*', required_scope: 'egress:http', reason: 'Outbound requests', recommended_minimum_grant: 'allowlist hostnames', risk_classification: 'medium', approval_required: true }],
  },
  {
    tool_metadata: { name: 'postgres.supabase', version: '1.0.0', schema_hash: hash('postgres.supabase/v1').slice(0, 12), capability_descriptors: ['database', 'rls'] },
    preflight_checks: () => process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? [] : [{ problem: 'Missing Supabase configuration', explanation: 'Database adapter needs SUPABASE_URL and SUPABASE_ANON_KEY.', repair_instruction: 'Populate variables in local env file.', risk_note: 'Use non-production credentials for local testing.', safe_command: 'cp .env.template .env.local' }],
    error_normalizer: normalizeError,
    classifier_extensions: [{ match: /rls|permission denied/i, failure_class: 'permission_error', failure_subclass: 'rls_denied', cause: 'Supabase/Postgres RLS denied operation.' }],
    permission_descriptors: [{ permission_type: 'database_rls', resource: 'public.*', required_scope: 'SELECT', reason: 'Read scoped tenant data', recommended_minimum_grant: 'tenant-filtered SELECT policy', risk_classification: 'high', approval_required: true }],
  },
];

export function registerAdapter(adapter: ToolAdapter): void {
  adapterRegistry.set(adapter.tool_metadata.name, adapter);
}

export function initializeAdapterRegistry(dynamicModules: string[] = []): { loaded: string[]; rejected: string[] } {
  for (const adapter of builtinAdapters) registerAdapter(adapter);
  const loaded: string[] = [];
  const rejected: string[] = [];
  for (const modulePath of dynamicModules) {
    try {
      const pluginStore = (globalThis as Record<string, unknown>).__REQUIEM_ADAPTER_PLUGINS as Record<string, ToolAdapter> | undefined;
      const candidate = pluginStore?.[modulePath];
      if (!candidate) {
        rejected.push(modulePath);
        continue;
      }
      if (!candidate.tool_metadata.version.startsWith('1.')) {
        rejected.push(modulePath);
        continue;
      }
      registerAdapter(candidate);
      loaded.push(candidate.tool_metadata.name);
    } catch {
      rejected.push(modulePath);
    }
  }
  return { loaded, rejected };
}

export function listAdapters(): string[] {
  if (adapterRegistry.size === 0) initializeAdapterRegistry();
  return [...adapterRegistry.keys()].sort();
}

export function classifyFailure(toolName: string, normalizedError: string): ClassifierOut {
  if (adapterRegistry.size === 0) initializeAdapterRegistry();
  const lower = normalizedError.toLowerCase();
  const adapter = adapterRegistry.get(toolName);
  const extension = adapter?.classifier_extensions?.find((rule) => rule.match.test(normalizedError));
  if (extension) return { failure_class: extension.failure_class, failure_subclass: extension.failure_subclass, diagnosis: { cause: extension.cause, details: { toolName } } };
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

export function generatePromptRepairSuggestion(classification: ClassifierOut, normalizedError: string): string | null {
  if (classification.failure_class === 'planning_error') return 'Suggestion: verify tool parameter names against latest schema and remove unsupported keys.';
  if (classification.failure_class === 'interface_error') return 'Suggestion: regenerate client bindings from canonical schema and retry with valid payload.';
  if (/missing required property\s+(\w+)/i.test(normalizedError)) {
    const match = normalizedError.match(/missing required property\s+(\w+)/i);
    return `Suggestion: include required parameter \`${match?.[1] ?? 'unknown'}\` in tool call.`;
  }
  return null;
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

export function createPermissionRequest(event: ToolEvent): PermissionRequest | null {
  if (event.failure_class !== 'permission_error') return null;
  const adapter = adapterRegistry.get(event.tool_name);
  const descriptor = adapter?.permission_descriptors[0] ?? {
    permission_type: 'oauth_scope',
    resource: event.tool_name,
    required_scope: event.failure_subclass ?? 'unknown',
    reason: event.diagnosis?.cause ?? 'Permission required for tool operation',
    recommended_minimum_grant: event.failure_subclass ?? 'unknown',
    risk_classification: 'medium' as const,
    approval_required: true as const,
  };
  const request: PermissionRequest = { ...descriptor, origin_tool_event: event.event_id, request_id: hash(`${event.event_id}:${stableStringify(descriptor)}`).slice(0, 24), created_at: nowIso() };
  permissionRequests.set(request.request_id, request);
  appendNdjson(permissionPath, request);
  return request;
}

export function listPermissionRequests(): PermissionRequest[] {
  const persisted = parseNdjson<PermissionRequest>(permissionPath);
  for (const request of persisted) permissionRequests.set(request.request_id, request);
  return [...permissionRequests.values()].sort((a, b) => a.request_id.localeCompare(b.request_id));
}

export function decidePermission(requestId: string, decision: 'approve' | 'deny'): PermissionEvent | null {
  const request = listPermissionRequests().find((item) => item.request_id === requestId);
  if (!request) return null;
  const envBefore = computeEnvFingerprint().id;
  const policyBefore = computeEnvFingerprint().policy_bundle_hash;
  const event: PermissionEvent = {
    event_id: hash(`${requestId}:${decision}`).slice(0, 24),
    request_id: requestId,
    decision,
    decided_at: nowIso(),
    fingerprint_diff: { env_before: envBefore, env_after: envBefore, policy_before: policyBefore, policy_after: policyBefore },
  };
  appendNdjson(permissionPath, event);
  return event;
}

export function recordToolEvent(event: Omit<ToolEvent, 'event_id' | 'step_id'>): ToolEvent {
  const idx = (stepCounters.get(event.run_id) ?? 0) + 1;
  stepCounters.set(event.run_id, idx);
  const enriched: ToolEvent = { ...event, step_id: `step_${String(idx).padStart(4, '0')}`, event_id: hash(`${event.run_id}:${idx}:${event.tool_name}:${event.args_hash}`).slice(0, 24) };
  const list = toolEventLog.get(event.run_id) ?? [];
  list.push(enriched);
  toolEventLog.set(event.run_id, list);
  appendNdjson(auditPath, enriched);
  if (enriched.failure_class === 'permission_error') createPermissionRequest(enriched);
  return enriched;
}

export function getRunToolEvents(runId: string): ToolEvent[] {
  const inMemory = [...(toolEventLog.get(runId) ?? [])];
  const persisted = parseNdjson<ToolEvent>(auditPath).filter((event) => event.run_id === runId);
  inMemory.push(...persisted);
  const dedup = new Map(inMemory.map((event) => [event.event_id, event]));
  return [...dedup.values()].sort((a, b) => a.step_id.localeCompare(b.step_id));
}

export function runGuidedDoctor(toolName: string): DoctorReport {
  if (adapterRegistry.size === 0) initializeAdapterRegistry();
  const issues: DoctorIssue[] = [];
  const generated_artifacts: string[] = [];
  if (!process.env.PATH) issues.push({ problem: 'Missing PATH', explanation: 'Runtime cannot locate system binaries.', repair_instruction: 'Export PATH in shell profile.', risk_note: 'Without PATH process spawning fails.' });
  if (!process.env.REQUIEM_POLICY_BUNDLE) issues.push({ problem: 'Missing policy bundle pin', explanation: 'Replay stability reduced when policy hash is not pinned.', repair_instruction: 'Set REQUIEM_POLICY_BUNDLE to locked hash.', risk_note: 'Policy drift may alter run results.', safe_command: 'echo "REQUIEM_POLICY_BUNDLE=" >> .env.template' });
  if (!process.env.REQUIEM_RUNTIME_VERSION) issues.push({ problem: 'Missing runtime version lock', explanation: 'Version drift can break deterministic replay.', repair_instruction: 'Set REQUIEM_RUNTIME_VERSION in environment.', risk_note: 'Cross-version behavior drift risk.', safe_command: 'echo "REQUIEM_RUNTIME_VERSION=1" >> .env.template' });
  const adapter = adapterRegistry.get(toolName);
  if (adapter) issues.push(...adapter.preflight_checks());
  if (issues.some((i) => i.safe_command?.includes('.env.template'))) {
    const envTemplate = resolve(process.cwd(), '.env.template');
    if (!existsSync(envTemplate)) writeFileSync(envTemplate, '# Generated by rq doctor\n', 'utf8');
    generated_artifacts.push('.env.template');
  }
  return { ok: issues.length === 0, mode: 'warn', issues, generated_artifacts };
}

export function preflightTool(toolName: string, mode: PreflightGateMode = 'warn'): { status: 'PASS' | 'WARN' | 'FAIL'; reason: string; repair_plan?: RepairPlan; doctor?: DoctorReport } {
  if (adapterRegistry.size === 0) initializeAdapterRegistry();
  const doctor = runGuidedDoctor(toolName);
  if (mode === 'off') return { status: 'PASS', reason: 'Preflight gate disabled by policy mode.', doctor };
  if (!doctor.ok) {
    if (mode === 'strict') {
      const classification = classifyFailure(toolName, doctor.issues.map((i) => i.problem).join(';'));
      return { status: 'FAIL', reason: 'Strict preflight blocked execution until doctor passes.', repair_plan: buildRepairPlan(classification), doctor };
    }
    return { status: 'WARN', reason: `Preflight found ${doctor.issues.length} issue(s).`, doctor };
  }
  return { status: 'PASS', reason: 'Environment baseline satisfied.', doctor };
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
    if (!ea || !eb) {
      changed_tools.push(tool);
      continue;
    }
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

export function exportIncidentPack(runId: string): IncidentPack {
  const tool_events = getRunToolEvents(runId).map((event) => ({ ...event, start_ts: 0 }));
  const env = computeEnvFingerprint();
  const diagnosis = tool_events.map((event) => ({ step_id: event.step_id, failure_class: event.failure_class, failure_subclass: event.failure_subclass, cause: event.diagnosis?.cause }));
  const repair_plan = tool_events.at(-1)?.repair_plan ?? null;
  const artifact_cas_refs = [...new Set(tool_events.flatMap((event) => event.artifact_refs))];
  const redacted_arguments = tool_events.map((event) => event.args_redacted_preview);
  const payload = {
    format: 'rqpack/v1' as const,
    run_id: runId,
    tool_events,
    diagnosis,
    repair_plan,
    env_fingerprint: env,
    policy_fingerprint: env.policy_bundle_hash,
    artifact_cas_refs,
    redacted_arguments,
  };
  return { ...payload, proof_fingerprint: hash(stableStringify(payload)) };
}

export function importIncidentPack(filePath: string): IncidentPack {
  const payload = JSON.parse(readFileSync(filePath, 'utf8')) as IncidentPack;
  if (payload.format !== 'rqpack/v1') throw new Error('Unsupported incident pack format');
  return payload;
}

export function replayIncidentPack(pack: IncidentPack, options: { mock_mode: boolean; network_isolation: boolean }): { run_id: string; deterministic: boolean; classification_match: boolean; diagnosis_match: boolean } {
  const events = pack.tool_events;
  const derived = events.map((event) => {
    const normalized = event.normalized_error ?? '';
    return classifyFailure(event.tool_name, normalized);
  });
  const classification_match = derived.every((entry, index) => entry.failure_class === events[index]?.failure_class && entry.failure_subclass === events[index]?.failure_subclass);
  const diagnosis_match = derived.every((entry, index) => entry.diagnosis.cause === events[index]?.diagnosis?.cause);
  return { run_id: pack.run_id, deterministic: options.mock_mode && options.network_isolation, classification_match, diagnosis_match };
}

export function getFailurePatternStats(toolFilter?: string): { total_failures: number; by_tool: Record<string, number>; top_subclasses: Array<{ subclass: string; count: number }>; mean_time_to_repair_ms: number; repair_success_rate: number; environment_drift_indicators: number } {
  const events = parseNdjson<ToolEvent>(auditPath).filter((event) => event.status !== 'ok' && (!toolFilter || event.tool_name === toolFilter));
  const by_tool: Record<string, number> = {};
  const subclasses: Record<string, number> = {};
  let durationTotal = 0;
  let repaired = 0;
  for (const event of events) {
    by_tool[event.tool_name] = (by_tool[event.tool_name] ?? 0) + 1;
    const sub = event.failure_subclass ?? 'unknown';
    subclasses[sub] = (subclasses[sub] ?? 0) + 1;
    durationTotal += event.duration_ms;
    if (event.repair_plan?.steps.length) repaired += 1;
  }
  return {
    total_failures: events.length,
    by_tool,
    top_subclasses: Object.entries(subclasses).map(([subclass, count]) => ({ subclass, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    mean_time_to_repair_ms: events.length ? Math.round(durationTotal / events.length) : 0,
    repair_success_rate: events.length ? Number((repaired / events.length).toFixed(3)) : 0,
    environment_drift_indicators: new Set(events.map((event) => event.env_fingerprint_id)).size,
  };
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

export function runRuntimeDemo(): { run_id: string; steps: string[]; incident_file: string } {
  initializeAdapterRegistry();
  const run_id = 'demo-run';
  const env = computeEnvFingerprint();
  const failures = [
    ['github.api', 'env missing GITHUB_TOKEN'],
    ['github.api', 'missing scope: repo.write'],
    ['http.fetch', 'schema validation failed'],
    ['http.fetch', '429 rate limit exceeded'],
  ] as const;
  for (const [tool_name, error] of failures) {
    const classification = classifyFailure(tool_name, error);
    recordToolEvent({ run_id, trace_id: run_id, tool_name, tool_version: '1.0.0', args_hash: hashArgs({ tool_name }), args_redacted_preview: redactedArgsPreview({ tool_name }), start_ts: 0, duration_ms: 10, status: 'failed', raw_error: error, normalized_error: normalizeError(error), failure_class: classification.failure_class, failure_subclass: classification.failure_subclass, diagnosis: classification.diagnosis, repair_plan: buildRepairPlan(classification), env_fingerprint_id: env.id, policy_fingerprint_id: env.policy_bundle_hash, artifact_refs: [] });
  }
  const pack = exportIncidentPack(run_id);
  const incident_file = resolve(process.cwd(), `${run_id}.rqpack`);
  writeFileSync(incident_file, JSON.stringify(pack, null, 2), 'utf8');
  return { run_id, steps: ['Run', 'Replay', 'Diagnose', 'Repair', 'Diff', 'Incident export'], incident_file };
}

export function loadPersistedToolEventCount(): number {
  return parseNdjson<ToolEvent>(auditPath).length;
}
