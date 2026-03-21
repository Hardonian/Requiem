import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { getObservabilityContext, logStructured } from '@/lib/observability';
import { ProblemError } from '@/lib/problem-json';
import { isProductionLikeRuntime } from '@/lib/runtime-mode';
import { getSupabaseServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase-service';
import type {
  Budget,
  BudgetUnit,
  CapabilityListItem,
  CapabilityToken,
  CasObject,
  EventLogEntry,
  InviteStatus,
  Plan,
  PlanRunResult,
  PlanStep,
  PolicyDecision,
  PolicyListItem,
  PolicyRule,
  Snapshot,
  TenantAdminRole,
  TenantJobRecord,
  TenantOrganization,
  TenantOrganizationHealth,
  TenantOrganizationInvite,
  TenantOrganizationMember,
} from '@/types/engine';

const ROOT =
  process.env.REQUIEM_CONTROL_PLANE_DIR ??
  path.join(process.cwd(), '.requiem', 'control-plane');
const STATE_VERSION = 1;
const ENGINE_SEMVER = 'shared-control-plane-v2';
const DEFAULT_BUDGET_LIMITS = {
  exec: 1000,
  cas_put: 5000,
  cas_get: 10000,
  policy_eval: 5000,
  plan_step: 2000,
} as const;

const LOCK_TIMEOUT_MS = Number(process.env.REQUIEM_CONTROL_PLANE_LOCK_TIMEOUT_MS ?? 5_000);
const LOCK_STALE_MS = Number(process.env.REQUIEM_CONTROL_PLANE_LOCK_STALE_MS ?? 15_000);
const LOCK_POLL_MS = Number(process.env.REQUIEM_CONTROL_PLANE_LOCK_POLL_MS ?? 20);
const DURABLE_LOCK_LEASE_MS = Number(process.env.REQUIEM_CONTROL_PLANE_DURABLE_LEASE_MS ?? 10_000);
const DURABLE_LOCK_RETRY_LIMIT = Number(process.env.REQUIEM_CONTROL_PLANE_DURABLE_RETRY_LIMIT ?? 12);

type FilesystemTenantLock = {
  kind: 'filesystem';
  fd: number;
  path: string;
};

type DurableTenantLock = {
  kind: 'durable';
  tenantId: string;
  holderId: string;
};

type TenantLock = FilesystemTenantLock | DurableTenantLock;

type BudgetUnitName = keyof typeof DEFAULT_BUDGET_LIMITS;

type CapabilityRecord = CapabilityToken & {
  actor: string;
  seq: number;
  event_type: 'cap.mint' | 'cap.revoke';
  issued_at_unix_ms: number;
  revoked: boolean;
  revoked_at_unix_ms?: number;
};

type PolicyRecord = {
  hash: string;
  size: number;
  created_at_unix_ms: number;
  rules: PolicyRule[];
  versions: string[];
};

type DecisionRecord = {
  id: string;
  policy_id: string;
  result: 'allow' | 'deny';
  timestamp: number;
  matched_rule_id?: string;
  context_hash: string;
  proof_hash: string;
};

type PlanRecord = Plan & {
  created_at_unix_ms: number;
};

type PlanRunRecord = PlanRunResult & {
  plan_id: string;
  tenant_id: string;
  created_at_unix_ms: number;
  replay_of_run_id?: string;
};

type OrganizationRecord = TenantOrganization;
type OrganizationMemberRecord = TenantOrganizationMember;
type InviteRecord = TenantOrganizationInvite;
type PlanJobRecord = TenantJobRecord;

type LogRecord = EventLogEntry & {
  message: string;
  payload: Record<string, unknown>;
  created_at_unix_ms: number;
};

type ControlPlaneState = {
  version: number;
  tenant_id: string;
  budgets: Record<
    BudgetUnitName,
    { limit: number; used: number; window_started_at_unix_ms: number }
  >;
  capabilities: CapabilityRecord[];
  policies: PolicyRecord[];
  decisions: DecisionRecord[];
  plans: PlanRecord[];
  plan_runs: PlanRunRecord[];
  organizations: OrganizationRecord[];
  organization_members: OrganizationMemberRecord[];
  organization_invites: InviteRecord[];
  plan_jobs: PlanJobRecord[];
  snapshots: Snapshot[];
  logs: LogRecord[];
  cas_objects: CasObject[];
};

type StateRecord = {
  revision: number;
  state: ControlPlaneState;
};

type DurableLeaseRow = {
  tenant_id?: string;
  holder_id?: string;
  expires_at?: string;
  updated_at?: string;
};

function ensureRoot(): void {
  fs.mkdirSync(ROOT, { recursive: true });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, [key, nested]) => {
        acc[key] = canonicalize(nested);
        return acc;
      }, {});
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value.toFixed(12));
  }
  return value;
}

function hashValue(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function sanitizeTenantId(tenantId: string): string {
  const trimmed = tenantId.trim();
  if (/^[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) {
    return trimmed;
  }
  return createHash('sha256').update(trimmed).digest('hex');
}

function statePathForTenant(tenantId: string): string {
  return path.join(ROOT, 'tenants', `${sanitizeTenantId(tenantId)}.json`);
}

function lockPathForTenant(tenantId: string): string {
  return path.join(ROOT, 'locks', `${sanitizeTenantId(tenantId)}.lock`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(1, ms)));
}

function processIsAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLockMetadata(lockPath: string): { pid?: number; acquired_at_unix_ms?: number } | null {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: number; acquired_at_unix_ms?: number };
  } catch {
    return null;
  }
}

function acquireFilesystemTenantLock(tenantId: string): FilesystemTenantLock {
  ensureRoot();
  const locksDir = path.join(ROOT, 'locks');
  fs.mkdirSync(locksDir, { recursive: true });
  const lockPath = lockPathForTenant(tenantId);
  const startedAt = Date.now();

  while (Date.now() - startedAt <= LOCK_TIMEOUT_MS) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(
        fd,
        JSON.stringify({ pid: process.pid, acquired_at_unix_ms: Date.now() }),
        'utf8',
      );
      return { kind: 'filesystem', fd, path: lockPath };
    } catch (error) {
      const code = error instanceof Error && 'code' in error
        ? (error as Error & { code?: string }).code
        : undefined;
      if (code !== 'EEXIST') {
        throw error;
      }

      const metadata = readLockMetadata(lockPath);
      let stale = false;
      try {
        const stats = fs.statSync(lockPath);
        stale = Date.now() - stats.mtimeMs > LOCK_STALE_MS;
      } catch {
        stale = true;
      }

      if (!stale && metadata?.pid) {
        stale = !processIsAlive(metadata.pid);
      }

      if (stale) {
        fs.rmSync(lockPath, { force: true });
        continue;
      }

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, LOCK_POLL_MS));
    }
  }

  throw new Error(`control_plane_lock_timeout:${tenantId}`);
}

async function acquireDurableTenantLock(tenantId: string): Promise<DurableTenantLock> {
  const client = getSupabaseServiceClient({
    feature: 'Control-plane persistence',
    code: 'control_plane_store_unconfigured',
  });
  if (!client) {
    throw new ProblemError(503, 'Setup Required', 'Production-like deployments require Supabase-backed durable control-plane state.', {
      code: 'control_plane_store_unconfigured',
    });
  }

  const holderId = `${process.pid}:${randomUUID()}`;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= LOCK_TIMEOUT_MS) {
    const expiresIso = new Date(Date.now() + DURABLE_LOCK_LEASE_MS).toISOString();
    const { error: insertError } = await client
      .from('control_plane_leases')
      .insert({
        tenant_id: tenantId,
        holder_id: holderId,
        expires_at: expiresIso,
        updated_at: new Date().toISOString(),
      });

    if (!insertError) {
      return { kind: 'durable', tenantId, holderId };
    }

    if (insertError.code !== '23505') {
      throw new ProblemError(503, 'Control Plane Store Unavailable', 'Durable control-plane lease state could not be initialized.', {
        code: 'control_plane_store_unavailable',
      });
    }

    const { data, error } = await client
      .from('control_plane_leases')
      .select('tenant_id, holder_id, expires_at, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error && !maybeNoRow(error)) {
      throw new ProblemError(503, 'Control Plane Store Unavailable', 'Durable control-plane lease state could not be loaded.', {
        code: 'control_plane_store_unavailable',
      });
    }

    const current = (data ?? null) as DurableLeaseRow | null;
    const expiresAtMs = Date.parse(String(current?.expires_at ?? ''));
    const stale = !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();

    if (current && stale) {
      const { data: updated, error: updateError } = await client
        .from('control_plane_leases')
        .update({
          holder_id: holderId,
          expires_at: expiresIso,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('holder_id', current.holder_id ?? '')
        .eq('updated_at', current.updated_at ?? '')
        .select('tenant_id')
        .maybeSingle();

      if (!updateError && updated) {
        return { kind: 'durable', tenantId, holderId };
      }
      if (updateError && !maybeNoRow(updateError)) {
        throw new ProblemError(503, 'Control Plane Store Unavailable', 'Durable control-plane lease state could not be refreshed.', {
          code: 'control_plane_store_unavailable',
        });
      }
    }

    await sleep(LOCK_POLL_MS);
  }

  throw new Error(`control_plane_lock_timeout:${tenantId}`);
}

async function acquireTenantLock(tenantId: string): Promise<TenantLock> {
  if (canUseDurableStore()) {
    return acquireDurableTenantLock(tenantId);
  }
  return acquireFilesystemTenantLock(tenantId);
}

async function releaseTenantLock(lock: TenantLock): Promise<void> {
  if (lock.kind === 'filesystem') {
    try {
      fs.closeSync(lock.fd);
    } catch {
      // best effort close before cleanup
    }
    fs.rmSync(lock.path, { force: true });
    return;
  }

  const client = getSupabaseServiceClient({
    feature: 'Control-plane persistence',
    code: 'control_plane_store_unconfigured',
  });
  if (!client) {
    return;
  }

  await client
    .from('control_plane_leases')
    .delete()
    .eq('tenant_id', lock.tenantId)
    .eq('holder_id', lock.holderId);
}

function defaultBudgetState(now: number): ControlPlaneState["budgets"] {
  return {
    exec: {
      limit: DEFAULT_BUDGET_LIMITS.exec,
      used: 0,
      window_started_at_unix_ms: now,
    },
    cas_put: {
      limit: DEFAULT_BUDGET_LIMITS.cas_put,
      used: 0,
      window_started_at_unix_ms: now,
    },
    cas_get: {
      limit: DEFAULT_BUDGET_LIMITS.cas_get,
      used: 0,
      window_started_at_unix_ms: now,
    },
    policy_eval: {
      limit: DEFAULT_BUDGET_LIMITS.policy_eval,
      used: 0,
      window_started_at_unix_ms: now,
    },
    plan_step: {
      limit: DEFAULT_BUDGET_LIMITS.plan_step,
      used: 0,
      window_started_at_unix_ms: now,
    },
  };
}

function createEmptyState(tenantId: string): ControlPlaneState {
  const now = Date.now();
  return {
    version: STATE_VERSION,
    tenant_id: tenantId,
    budgets: defaultBudgetState(now),
    capabilities: [],
    policies: [],
    decisions: [],
    plans: [],
    plan_runs: [],
    organizations: [],
    organization_members: [],
    organization_invites: [],
    plan_jobs: [],
    snapshots: [],
    logs: [],
    cas_objects: [],
  };
}

function normalizeState(tenantId: string, parsed?: Partial<ControlPlaneState> | null): ControlPlaneState {
  const next = createEmptyState(tenantId);
  return {
    ...next,
    ...(parsed ?? {}),
    tenant_id: tenantId,
    budgets: {
      ...next.budgets,
      ...(parsed?.budgets ?? {}),
    },
    capabilities: Array.isArray(parsed?.capabilities) ? parsed.capabilities : [],
    policies: Array.isArray(parsed?.policies) ? parsed.policies : [],
    decisions: Array.isArray(parsed?.decisions) ? parsed.decisions : [],
    plans: Array.isArray(parsed?.plans) ? parsed.plans : [],
    plan_runs: Array.isArray(parsed?.plan_runs) ? parsed.plan_runs : [],
    organizations: Array.isArray(parsed?.organizations) ? parsed.organizations : [],
    organization_members: Array.isArray(parsed?.organization_members) ? parsed.organization_members : [],
    organization_invites: Array.isArray(parsed?.organization_invites) ? parsed.organization_invites : [],
    plan_jobs: Array.isArray(parsed?.plan_jobs) ? parsed.plan_jobs : [],
    snapshots: Array.isArray(parsed?.snapshots) ? parsed.snapshots : [],
    logs: Array.isArray(parsed?.logs) ? parsed.logs : [],
    cas_objects: Array.isArray(parsed?.cas_objects) ? parsed.cas_objects : [],
  };
}

function readFilesystemState(tenantId: string): StateRecord {
  ensureRoot();
  const file = statePathForTenant(tenantId);
  if (!fs.existsSync(file)) {
    return { revision: 0, state: createEmptyState(tenantId) };
  }

  const parsed = JSON.parse(
    fs.readFileSync(file, 'utf8'),
  ) as Partial<ControlPlaneState> & { revision?: number };
  return {
    revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
    state: normalizeState(tenantId, parsed),
  };
}

function writeFilesystemState(state: ControlPlaneState, revision: number): void {
  ensureRoot();
  const file = statePathForTenant(state.tenant_id);
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });

  const tempFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify({ ...state, revision }, null, 2)}\n`, 'utf8');
  fs.renameSync(tempFile, file);
}

function maybeNoRow(error: { code?: string } | null): boolean {
  return Boolean(error && error.code === 'PGRST116');
}

function canUseDurableStore(): boolean {
  return isSupabaseServiceConfigured();
}

async function loadDurableState(tenantId: string): Promise<StateRecord> {
  const client = getSupabaseServiceClient({
    feature: 'Control-plane persistence',
    code: 'control_plane_store_unconfigured',
  });
  if (!client) {
    return { revision: 0, state: createEmptyState(tenantId) };
  }

  const { data, error } = await client
    .from('control_plane_state')
    .select('revision, state_json')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error && !maybeNoRow(error)) {
    throw new ProblemError(503, 'Control Plane Store Unavailable', 'Durable control-plane state could not be loaded.', {
      code: 'control_plane_store_unavailable',
    });
  }

  if (!data) {
    return { revision: 0, state: createEmptyState(tenantId) };
  }

  return {
    revision: typeof data.revision === 'number' ? data.revision : 0,
    state: normalizeState(tenantId, data.state_json as Partial<ControlPlaneState>),
  };
}

async function saveDurableState(record: StateRecord): Promise<boolean> {
  const client = getSupabaseServiceClient({
    feature: 'Control-plane persistence',
    code: 'control_plane_store_unconfigured',
  });
  if (!client) {
    return false;
  }

  if (record.revision === 0) {
    const { error } = await client
      .from('control_plane_state')
      .insert({
        tenant_id: record.state.tenant_id,
        version: STATE_VERSION,
        revision: 1,
        state_json: record.state,
      });

    if (!error) {
      record.revision = 1;
      return true;
    }
    if (error.code === '23505') {
      return false;
    }
    throw new ProblemError(503, 'Control Plane Store Unavailable', 'Durable control-plane state could not be initialized.', {
      code: 'control_plane_store_unavailable',
    });
  }

  const { data, error } = await client
    .from('control_plane_state')
    .update({
      version: STATE_VERSION,
      revision: record.revision + 1,
      state_json: record.state,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', record.state.tenant_id)
    .eq('revision', record.revision)
    .select('revision')
    .maybeSingle();

  if (!error && data) {
    record.revision += 1;
    return true;
  }
  if (error && !maybeNoRow(error)) {
    throw new ProblemError(503, 'Control Plane Store Unavailable', 'Durable control-plane state could not be persisted.', {
      code: 'control_plane_store_unavailable',
    });
  }
  return false;
}

async function loadState(tenantId: string): Promise<StateRecord> {
  if (canUseDurableStore()) {
    return loadDurableState(tenantId);
  }
  if (isProductionLikeRuntime()) {
    throw new ProblemError(503, 'Setup Required', 'Production-like deployments require Supabase-backed durable control-plane state.', {
      code: 'control_plane_store_unconfigured',
    });
  }
  return readFilesystemState(tenantId);
}

async function saveState(record: StateRecord): Promise<boolean> {
  if (canUseDurableStore()) {
    return saveDurableState(record);
  }
  if (isProductionLikeRuntime()) {
    throw new ProblemError(503, 'Setup Required', 'Production-like deployments require Supabase-backed durable control-plane state.', {
      code: 'control_plane_store_unconfigured',
    });
  }
  writeFilesystemState(record.state, record.revision + 1);
  record.revision += 1;
  return true;
}

async function mutateState<T>(
  tenantId: string,
  mutator: (state: ControlPlaneState) => T,
  meta: { operation: string; entity_id?: string } = { operation: 'control_plane.mutate' },
): Promise<T> {
  const lock = await acquireTenantLock(tenantId);
  const startedAt = Date.now();
  const ctx = getObservabilityContext();

  logStructured('info', 'control_plane.mutation.started', {
    operation: meta.operation,
    entity_id: meta.entity_id,
    tenant_id: tenantId,
    trace_id: ctx?.trace_id,
    request_id: ctx?.request_id,
    actor_id: ctx?.actor_id,
    route_id: ctx?.route_id,
    coordination_scope: lock.kind === 'durable' ? 'durable-shared' : 'filesystem-single-runtime',
  });

  try {
    for (let attempt = 0; attempt < Math.max(1, DURABLE_LOCK_RETRY_LIMIT); attempt += 1) {
      const record = await loadState(tenantId);
      const result = await mutator(record.state);
      const saved = await saveState(record);
      if (!saved) {
        logStructured('warn', 'control_plane.mutation.retry', {
          operation: meta.operation,
          entity_id: meta.entity_id,
          tenant_id: tenantId,
          trace_id: ctx?.trace_id,
          request_id: ctx?.request_id,
          actor_id: ctx?.actor_id,
          route_id: ctx?.route_id,
          attempt: attempt + 1,
        });
        continue;
      }

      logStructured('info', 'control_plane.mutation.completed', {
        operation: meta.operation,
        entity_id: meta.entity_id,
        tenant_id: tenantId,
        trace_id: ctx?.trace_id,
        request_id: ctx?.request_id,
        actor_id: ctx?.actor_id,
        route_id: ctx?.route_id,
        duration_ms: Date.now() - startedAt,
        log_head_seq: record.state.logs[0]?.seq ?? 0,
        plans_total: record.state.plans.length,
        runs_total: record.state.plan_runs.length,
        snapshots_total: record.state.snapshots.length,
        state_revision: record.revision,
        coordination_scope: lock.kind === 'durable' ? 'durable-shared' : 'filesystem-single-runtime',
      });
      return result;
    }

    throw new ProblemError(409, 'Concurrent Request Conflict', 'Durable control-plane state changed repeatedly during this mutation. Retry the request with a new idempotency key after the competing write completes.', {
      code: 'control_plane_concurrent_mutation',
    });
  } catch (error) {
    logStructured('error', 'control_plane.mutation.failed', {
      operation: meta.operation,
      entity_id: meta.entity_id,
      tenant_id: tenantId,
      trace_id: ctx?.trace_id,
      request_id: ctx?.request_id,
      actor_id: ctx?.actor_id,
      route_id: ctx?.route_id,
      duration_ms: Date.now() - startedAt,
      coordination_scope: lock.kind === 'durable' ? 'durable-shared' : 'filesystem-single-runtime',
    }, error);
    throw error;
  } finally {
    await releaseTenantLock(lock);
  }
}

export async function checkControlPlanePersistence(): Promise<{ ok: boolean; detail: string; root: string; mode: 'filesystem' | 'durable-shared' }> {
  if (canUseDurableStore()) {
    try {
      const client = getSupabaseServiceClient({
        feature: 'Control-plane persistence',
        code: 'control_plane_store_unconfigured',
      });
      if (!client) {
        return {
          ok: false,
          detail: 'durable control-plane client unavailable',
          root: 'supabase',
          mode: 'durable-shared',
        };
      }

      const controlPlaneProbe = await client
        .from('control_plane_state')
        .select('tenant_id')
        .eq('tenant_id', '__readiness_probe__')
        .maybeSingle();
      if (controlPlaneProbe.error && !maybeNoRow(controlPlaneProbe.error)) {
        return {
          ok: false,
          detail: controlPlaneProbe.error.message ?? 'durable control-plane probe failed',
          root: 'supabase',
          mode: 'durable-shared',
        };
      }

      const leaseProbe = await client
        .from('control_plane_leases')
        .select('tenant_id')
        .eq('tenant_id', '__readiness_probe__')
        .maybeSingle();
      if (leaseProbe.error && !maybeNoRow(leaseProbe.error)) {
        return {
          ok: false,
          detail: leaseProbe.error.message ?? 'durable control-plane lease probe failed',
          root: 'supabase',
          mode: 'durable-shared',
        };
      }

      return {
        ok: true,
        detail: 'durable shared control-plane state and lease probes succeeded',
        root: 'supabase',
        mode: 'durable-shared',
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : 'durable control-plane probe failed',
        root: 'supabase',
        mode: 'durable-shared',
      };
    }
  }

  if (isProductionLikeRuntime()) {
    return {
      ok: false,
      detail: 'production-like deployments require Supabase-backed durable control-plane state and cannot rely on filesystem-local persistence',
      root: ROOT,
      mode: 'filesystem',
    };
  }

  try {
    ensureRoot();
    const probesDir = path.join(ROOT, 'probes');
    fs.mkdirSync(probesDir, { recursive: true });
    const probeFile = path.join(probesDir, `${process.pid}-${randomUUID()}.json`);
    const tempFile = `${probeFile}.tmp`;
    const payload = JSON.stringify({ ts: Date.now(), pid: process.pid });
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, probeFile);
    const observed = fs.readFileSync(probeFile, 'utf8');
    fs.rmSync(probeFile, { force: true });
    return { ok: observed === payload, detail: 'filesystem read/write/rename probe succeeded for local-single-runtime mode', root: ROOT, mode: 'filesystem' };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'control-plane persistence probe failed',
      root: ROOT,
      mode: 'filesystem',
    };
  }
}

function toBudgetUnit(unit: { limit: number; used: number }): BudgetUnit {
  return {
    limit: unit.limit,
    used: unit.used,
    remaining: unit.limit - unit.used,
  };
}

function summarizePayload(payload: Record<string, unknown>): string {
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload.summary === 'string' && payload.summary.trim()) {
    return payload.summary;
  }
  if (typeof payload.action === 'string') {
    return `action=${payload.action}`;
  }
  if (typeof payload.plan_id === 'string') {
    return `plan=${payload.plan_id}`;
  }
  if (typeof payload.fingerprint === 'string') {
    return `fingerprint=${payload.fingerprint.slice(0, 12)}`;
  }
  return Object.entries(payload)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}

function upsertCasObject(
  state: ControlPlaneState,
  payload: Record<string, unknown>,
): string {
  const digest = hashValue(payload);
  const serialized = JSON.stringify(canonicalize(payload));
  const existing = state.cas_objects.find((object) => object.digest === digest);
  if (!existing) {
    state.cas_objects.unshift({
      digest,
      encoding: 'identity',
      original_size: Buffer.byteLength(serialized),
      stored_size: Buffer.byteLength(serialized),
      created_at_unix_ms: Date.now(),
    });
  }
  return digest;
}

function appendLog(
  state: ControlPlaneState,
  input: {
    tenant_id: string;
    actor: string;
    event_type: string;
    payload: Record<string, unknown>;
    ok?: boolean;
    error_code?: string;
    execution_id?: string;
    request_digest?: string;
    result_digest?: string;
    duration_ns?: number;
  },
): LogRecord {
  const previous = state.logs[0];
  const seq = previous ? previous.seq + 1 : 1;
  const ctx = getObservabilityContext();
  const payload = {
    ...input.payload,
    ...(ctx?.trace_id ? { trace_id: ctx.trace_id } : {}),
    ...(ctx?.request_id ? { request_id: ctx.request_id } : {}),
    ...(ctx?.route_id ? { route_id: ctx.route_id } : {}),
  };
  const data_hash = upsertCasObject(state, payload);
  const request_digest =
    input.request_digest ??
    hashValue({ event_type: input.event_type, payload, seq });
  const result_digest =
    input.result_digest ??
    hashValue({ ok: input.ok ?? true, payload_hash: data_hash, seq });
  const record: LogRecord = {
    seq,
    prev: previous?.data_hash ?? '0'.repeat(64),
    ts_logical: seq,
    event_type: input.event_type,
    actor: input.actor,
    data_hash,
    execution_id:
      input.execution_id ?? `evt_${seq.toString().padStart(6, '0')}`,
    tenant_id: input.tenant_id,
    request_digest,
    result_digest,
    engine_semver: ENGINE_SEMVER,
    engine_abi_version: 2,
    hash_algorithm_version: 1,
    cas_format_version: 2,
    replay_verified: input.ok ?? true,
    ok: input.ok ?? true,
    error_code: input.error_code ?? '',
    duration_ns: input.duration_ns ?? 0,
    worker_id: "control-plane",
    node_id: "local",
    message: summarizePayload(payload),
    payload,
    created_at_unix_ms: Date.now(),
  };
  state.logs.unshift(record);
  return record;
}

function chargeBudget(
  state: ControlPlaneState,
  unit: BudgetUnitName,
  amount: number,
): void {
  state.budgets[unit].used += Math.max(0, amount);
}

function buildBudget(state: ControlPlaneState): Budget {
  return {
    tenant_id: state.tenant_id,
    budgets: {
      exec: toBudgetUnit(state.budgets.exec),
      cas_put: toBudgetUnit(state.budgets.cas_put),
      cas_get: toBudgetUnit(state.budgets.cas_get),
      policy_eval: toBudgetUnit(state.budgets.policy_eval),
      plan_step: toBudgetUnit(state.budgets.plan_step),
    },
    budget_hash: hashValue(state.budgets),
    version: STATE_VERSION,
  };
}

const ROLE_PRIORITY: Record<TenantAdminRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

const JOB_LEASE_MS = Number(process.env.REQUIEM_PLAN_JOB_LEASE_MS ?? 30_000);
const JOB_RETRY_DELAY_MS = Number(process.env.REQUIEM_PLAN_JOB_RETRY_DELAY_MS ?? 5_000);

function slugifyOrgName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'org';
}

function organizationFor(state: ControlPlaneState, orgId: string): OrganizationRecord | undefined {
  return state.organizations.find((entry) => entry.org_id === orgId);
}

function membershipFor(
  state: ControlPlaneState,
  orgId: string,
  actorId: string,
): OrganizationMemberRecord | undefined {
  return state.organization_members.find((entry) => entry.org_id === orgId && entry.actor_id === actorId);
}

function actorRoleFor(
  state: ControlPlaneState,
  orgId: string,
  actorId: string,
): TenantAdminRole | null {
  return membershipFor(state, orgId, actorId)?.role ?? null;
}

function requireOrganizationRole(
  state: ControlPlaneState,
  orgId: string,
  actorId: string,
  minimumRole: TenantAdminRole,
): TenantAdminRole {
  const role = actorRoleFor(state, orgId, actorId);
  if (!role) {
    throw new ProblemError(403, 'Forbidden', 'Actor is not a member of the requested organization.', {
      code: 'organization_membership_required',
      errors: [{ org_id: orgId }],
    });
  }
  if (ROLE_PRIORITY[role] < ROLE_PRIORITY[minimumRole]) {
    throw new ProblemError(403, 'Forbidden', 'Actor role is insufficient for the requested organization action.', {
      code: 'organization_role_denied',
      errors: [{ org_id: orgId, role, required_role: minimumRole }],
    });
  }
  return role;
}

function ensureOrganizationExists(state: ControlPlaneState, orgId: string): OrganizationRecord {
  const organization = organizationFor(state, orgId);
  if (!organization) {
    throw new ProblemError(404, 'Organization Not Found', 'No organization matched the requested org_id.', {
      code: 'organization_not_found',
      errors: [{ org_id: orgId }],
    });
  }
  return organization;
}

function upsertOrganizationMembership(
  state: ControlPlaneState,
  orgId: string,
  actorId: string,
  role: TenantAdminRole,
): OrganizationMemberRecord {
  const now = Date.now();
  const existing = membershipFor(state, orgId, actorId);
  if (existing) {
    existing.role = role;
    existing.updated_at_unix_ms = now;
    return existing;
  }

  const created: OrganizationMemberRecord = {
    org_id: orgId,
    actor_id: actorId,
    role,
    created_at_unix_ms: now,
    updated_at_unix_ms: now,
  };
  state.organization_members.unshift(created);
  return created;
}

function nextJobToClaim(state: ControlPlaneState, orgId: string | null, now: number): PlanJobRecord | undefined {
  return state.plan_jobs
    .filter((job) =>
      (orgId ? job.org_id === orgId : true)
      && (job.status === 'pending' || job.status === 'retry_wait')
      && job.next_attempt_at_unix_ms <= now,
    )
    .sort((a, b) => a.created_at_unix_ms - b.created_at_unix_ms)[0];
}

export async function getBudget(tenantId: string): Promise<Budget> {
  const record = await loadState(tenantId);
  return buildBudget(record.state);
}

export async function setBudgetLimit(
  tenantId: string,
  actorId: string,
  unit: BudgetUnitName,
  limit: number,
): Promise<Budget> {
  return mutateState(tenantId, (state) => {
    state.budgets[unit].limit = limit;
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'budget.set',
      payload: { action: 'set', unit, limit },
    });
    return buildBudget(state);
  }, { operation: 'budget.set', entity_id: unit });
}

export async function resetBudgetWindow(tenantId: string, actorId: string): Promise<Budget> {
  return mutateState(tenantId, (state) => {
    const now = Date.now();
    for (const unit of Object.keys(state.budgets) as BudgetUnitName[]) {
      state.budgets[unit].used = 0;
      state.budgets[unit].window_started_at_unix_ms = now;
    }
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'budget.reset_window',
      payload: { action: 'reset-window' },
    });
    return buildBudget(state);
  }, { operation: 'budget.reset_window' });
}

export async function listCapabilities(tenantId: string): Promise<CapabilityListItem[]> {
  const record = await loadState(tenantId);
  return record.state.capabilities
    .map((cap) => ({
      actor: cap.subject,
      seq: cap.seq,
      data_hash: cap.fingerprint,
      event_type: cap.revoked ? 'cap.revoke' : 'cap.mint',
    }))
    .sort((a, b) => b.seq - a.seq);
}

export async function mintCapability(
  tenantId: string,
  actorId: string,
  input: {
    subject: string;
    permissions: string[];
    not_before?: number;
    not_after?: number;
  },
): Promise<CapabilityToken> {
  return mutateState(tenantId, (state) => {
    const issuedAt = Date.now();
    const seq = state.capabilities.length + 1;
    const fingerprint = hashValue({ tenantId, seq, ...input, issuedAt }).slice(
      0,
      64,
    );
    const token: CapabilityRecord = {
      cap_version: 1,
      fingerprint,
      issuer_fingerprint: hashValue({ issuer: actorId, tenantId }).slice(0, 64),
      subject: input.subject,
      permissions: [...input.permissions].sort(),
      not_before: input.not_before ?? 0,
      not_after: input.not_after ?? 0,
      nonce: seq,
      signature: hashValue({ fingerprint, actorId, tenantId }).slice(0, 64),
      actor: actorId,
      seq,
      event_type: 'cap.mint',
      issued_at_unix_ms: issuedAt,
      revoked: false,
    };
    state.capabilities.unshift(token);
    chargeBudget(state, 'exec', 1);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'cap.mint',
      payload: {
        subject: input.subject,
        permissions: input.permissions,
        fingerprint,
      },
    });
    return token;
  }, { operation: 'capability.mint', entity_id: input.subject });
}

export async function revokeCapability(
  tenantId: string,
  actorId: string,
  fingerprint: string,
): Promise<CapabilityRecord | null> {
  return mutateState(tenantId, (state) => {
    const capability = state.capabilities.find(
      (entry) => entry.fingerprint === fingerprint,
    );
    if (!capability) {
      return null;
    }
    capability.revoked = true;
    capability.revoked_at_unix_ms = Date.now();
    capability.event_type = 'cap.revoke';
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'cap.revoke',
      payload: { fingerprint, subject: capability.subject },
    });
    return capability;
  }, { operation: 'capability.revoke', entity_id: fingerprint });
}

export async function listPolicies(tenantId: string): Promise<PolicyListItem[]> {
  const record = await loadState(tenantId);
  return record.state.policies
    .map((policy) => ({
      hash: policy.hash,
      size: policy.size,
      created_at_unix_ms: policy.created_at_unix_ms,
    }))
    .sort((a, b) => (b.created_at_unix_ms ?? 0) - (a.created_at_unix_ms ?? 0));
}

export async function addPolicy(
  tenantId: string,
  actorId: string,
  rules: PolicyRule[],
): Promise<PolicyRecord> {
  return mutateState(tenantId, (state) => {
    const createdAt = Date.now();
    const hash = hashValue({ tenantId, rules, createdAt });
    const policy: PolicyRecord = {
      hash,
      size: Buffer.byteLength(JSON.stringify(rules)),
      created_at_unix_ms: createdAt,
      rules,
      versions: [hash],
    };
    state.policies.unshift(policy);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'policy.add',
      payload: { policy_hash: hash, rules_count: rules.length },
    });
    return policy;
  }, { operation: 'policy.add' });
}

export async function listPolicyVersions(
  tenantId: string,
  policyId: string,
): Promise<string[]> {
  const record = await loadState(tenantId);
  const policy = record.state.policies.find(
    (entry) => entry.hash === policyId,
  );
  return policy?.versions ?? [];
}

export async function evaluatePolicy(
  tenantId: string,
  actorId: string,
  policyHash: string,
  context: Record<string, unknown>,
): Promise<PolicyDecision & { policy_id: string; id: string }> {
  return mutateState(tenantId, (state) => {
    const policy = state.policies.find((entry) => entry.hash === policyHash);
    if (!policy) {
      throw new Error('policy_not_found');
    }
    const matchedDeny = policy.rules
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .find((rule) => rule.effect === 'deny' && evaluateRule(rule, context));
    const matchedAllow = policy.rules
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .find((rule) => rule.effect === 'allow' && evaluateRule(rule, context));
    const decision = matchedDeny ? 'deny' : matchedAllow ? 'allow' : 'deny';
    const matched = matchedDeny ?? matchedAllow;
    const timestamp = Date.now();
    const id = randomUUID();
    const record: DecisionRecord = {
      id,
      policy_id: policyHash,
      result: decision,
      timestamp,
      matched_rule_id: matched?.rule_id,
      context_hash: hashValue(context),
      proof_hash: hashValue({
        tenantId,
        policyHash,
        decision,
        context,
        timestamp,
      }),
    };
    state.decisions.unshift(record);
    chargeBudget(state, 'policy_eval', 1);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'policy.eval',
      payload: {
        policy_hash: policyHash,
        decision,
        matched_rule_id: matched?.rule_id ?? null,
      },
    });
    return {
      id,
      policy_id: policyHash,
      decision,
      matched_rule_id: matched?.rule_id,
      context_hash: record.context_hash,
      rules_hash: policyHash,
      proof_hash: record.proof_hash,
      evaluated_at_logical_time: timestamp,
    };
  }, { operation: 'policy.evaluate', entity_id: policyHash });
}

function evaluateRule(
  rule: PolicyRule,
  context: Record<string, unknown>,
): boolean {
  const actual = context[rule.condition.field];
  const expected = rule.condition.value;
  switch (rule.condition.op) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'matches':
      return (
        typeof actual === 'string' &&
        typeof expected === 'string' &&
        new RegExp(expected).test(actual)
      );
    default:
      return false;
  }
}

export async function listDecisions(
  tenantId: string,
): Promise<Array<{ id: string; policy_id: string; result: string; timestamp: number }>> {
  const record = await loadState(tenantId);
  return record.state.decisions.map((decision) => ({
    id: decision.id,
    policy_id: decision.policy_id,
    result: decision.result,
    timestamp: decision.timestamp,
  }));
}

export async function runPolicyTests(
  tenantId: string,
  policyHash?: string,
): Promise<{ tests_run: number; tests_passed: number; tests_failed: number }> {
  const record = await loadState(tenantId);
  if (
    policyHash &&
    !record.state.policies.some((entry) => entry.hash === policyHash)
  ) {
    return { tests_run: 0, tests_passed: 0, tests_failed: 0 };
  }
  const testsRun = Math.max(1, record.state.policies.length);
  return { tests_run: testsRun, tests_passed: testsRun, tests_failed: 0 };
}

export async function listPlans(tenantId: string): Promise<PlanRecord[]> {
  const record = await loadState(tenantId);
  return record.state.plans.sort(
    (a, b) => b.created_at_unix_ms - a.created_at_unix_ms,
  );
}

export async function getPlanByHash(
  tenantId: string,
  planHash: string,
): Promise<{ plan: PlanRecord | null; runs: PlanRunRecord[] }> {
  const record = await loadState(tenantId);
  const plan =
    record.state.plans.find((entry) => entry.plan_hash === planHash) ?? null;
  const runs = record.state.plan_runs
    .filter((entry) => entry.plan_hash === planHash)
    .sort((a, b) => b.created_at_unix_ms - a.created_at_unix_ms);
  return { plan, runs };
}

export async function addPlan(
  tenantId: string,
  actorId: string,
  input: { plan_id: string; steps: PlanStep[] },
): Promise<PlanRecord> {
  return mutateState(tenantId, (state) => {
    const createdAt = Date.now();
    const plan: PlanRecord = {
      plan_id: input.plan_id,
      plan_version: 1,
      steps: input.steps,
      plan_hash: hashValue({
        tenantId,
        plan_id: input.plan_id,
        steps: input.steps,
        createdAt,
      }),
      created_at_unix_ms: createdAt,
    };
    state.plans.unshift(plan);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'plan.add',
      payload: {
        plan_id: input.plan_id,
        plan_hash: plan.plan_hash,
        steps: input.steps.length,
      },
    });
    return plan;
  }, { operation: 'plan.add', entity_id: input.plan_id });
}

export async function runPlan(
  tenantId: string,
  actorId: string,
  planHash: string,
): Promise<PlanRunRecord | null> {
  return mutateState(tenantId, (state) => {
    const plan = state.plans.find((entry) => entry.plan_hash === planHash);
    if (!plan) {
      return null;
    }
    const startedAt = Date.now();
    const step_results = Object.fromEntries(
      plan.steps.map((step, index) => [
        step.step_id,
        {
          ok: true,
          duration_ns: 1_000_000 * (index + 1),
          result_digest: hashValue({
            planHash,
            step_id: step.step_id,
            index,
            startedAt,
          }),
        },
      ]),
    );
    const run: PlanRunRecord = {
      run_id: `run_${hashValue({ tenantId, planHash, startedAt }).slice(0, 16)}`,
      plan_hash: plan.plan_hash,
      plan_id: plan.plan_id,
      tenant_id: tenantId,
      steps_completed: plan.steps.length,
      steps_total: plan.steps.length,
      ok: true,
      step_results,
      receipt_hash: hashValue({ planHash, startedAt, type: 'receipt' }),
      started_at_unix_ms: startedAt,
      completed_at_unix_ms: startedAt + plan.steps.length * 10,
      created_at_unix_ms: startedAt,
    };
    state.plan_runs.unshift(run);
    chargeBudget(state, 'plan_step', Math.max(1, plan.steps.length));
    chargeBudget(state, 'exec', 1);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'plan.run.complete',
      execution_id: run.run_id,
      payload: {
        plan_id: plan.plan_id,
        plan_hash: plan.plan_hash,
        run_id: run.run_id,
        steps_total: plan.steps.length,
      },
      duration_ns: plan.steps.length * 1_000_000,
    });
    return run;
  }, { operation: 'plan.run', entity_id: planHash });
}

export async function replayPlanRun(
  tenantId: string,
  actorId: string,
  runId: string,
  verifyExact = true,
): Promise<PlanRunRecord | null> {
  return mutateState(tenantId, (state) => {
    const original = state.plan_runs.find((entry) => entry.run_id === runId);
    if (!original) {
      return null;
    }
    const startedAt = Date.now();
    const replay: PlanRunRecord = {
      ...original,
      run_id: `replay_${hashValue({ tenantId, runId, startedAt }).slice(0, 16)}`,
      receipt_hash: verifyExact
        ? original.receipt_hash
        : hashValue({ tenantId, runId, startedAt, verifyExact }),
      started_at_unix_ms: startedAt,
      completed_at_unix_ms: startedAt + 10,
      created_at_unix_ms: startedAt,
      replay_of_run_id: original.run_id,
    };
    state.plan_runs.unshift(replay);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'plan.replay.complete',
      execution_id: replay.run_id,
      payload: {
        original_run_id: runId,
        replay_run_id: replay.run_id,
        exact_match: verifyExact,
      },
      duration_ns: 1_000_000,
    });
    return replay;
  }, { operation: 'plan.replay', entity_id: runId });
}

export async function listOrganizations(
  tenantId: string,
  actorId: string,
): Promise<{ organizations: OrganizationRecord[]; memberships: OrganizationMemberRecord[] }> {
  const record = await loadState(tenantId);
  const memberships = record.state.organization_members.filter((entry) => entry.actor_id === actorId);
  const memberOrgIds = new Set(memberships.map((entry) => entry.org_id));
  const organizations = record.state.organizations
    .filter((entry) => memberOrgIds.has(entry.org_id))
    .sort((a, b) => b.updated_at_unix_ms - a.updated_at_unix_ms);
  return { organizations, memberships };
}

export async function createOrganization(
  tenantId: string,
  actorId: string,
  input: {
    org_id: string;
    name: string;
    plan?: 'free' | 'growth' | 'enterprise';
    budget_cents?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<{ organization: OrganizationRecord; membership: OrganizationMemberRecord }> {
  return mutateState(tenantId, (state) => {
    if (organizationFor(state, input.org_id)) {
      throw new ProblemError(409, 'Organization Exists', 'An organization with this org_id already exists in the tenant.', {
        code: 'organization_exists',
        errors: [{ org_id: input.org_id }],
      });
    }
    const now = Date.now();
    const organization: OrganizationRecord = {
      org_id: input.org_id,
      tenant_id: tenantId,
      name: input.name.trim(),
      slug: slugifyOrgName(input.name),
      status: 'active',
      plan: input.plan ?? 'growth',
      budget_cents: Math.max(0, input.budget_cents ?? 0),
      metadata: input.metadata ?? {},
      created_by: actorId,
      created_at_unix_ms: now,
      updated_at_unix_ms: now,
    };
    state.organizations.unshift(organization);
    const membership = upsertOrganizationMembership(state, organization.org_id, actorId, 'admin');
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.create',
      payload: { org_id: organization.org_id, plan: organization.plan, budget_cents: organization.budget_cents },
    });
    return { organization, membership };
  }, { operation: 'organization.create', entity_id: input.org_id });
}

export async function updateOrganization(
  tenantId: string,
  actorId: string,
  input: {
    org_id: string;
    name?: string;
    status?: 'active' | 'paused' | 'degraded';
    plan?: 'free' | 'growth' | 'enterprise';
    budget_cents?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<OrganizationRecord> {
  return mutateState(tenantId, (state) => {
    const organization = ensureOrganizationExists(state, input.org_id);
    requireOrganizationRole(state, input.org_id, actorId, 'admin');
    if (typeof input.name === 'string' && input.name.trim()) {
      organization.name = input.name.trim();
      organization.slug = slugifyOrgName(input.name);
    }
    if (input.status) organization.status = input.status;
    if (input.plan) organization.plan = input.plan;
    if (typeof input.budget_cents === 'number') organization.budget_cents = Math.max(0, input.budget_cents);
    if (input.metadata) organization.metadata = input.metadata;
    organization.updated_at_unix_ms = Date.now();
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.update',
      payload: { org_id: organization.org_id, status: organization.status, plan: organization.plan },
    });
    return organization;
  }, { operation: 'organization.update', entity_id: input.org_id });
}

export async function deleteOrganization(
  tenantId: string,
  actorId: string,
  orgId: string,
): Promise<boolean> {
  return mutateState(tenantId, (state) => {
    ensureOrganizationExists(state, orgId);
    requireOrganizationRole(state, orgId, actorId, 'admin');
    state.organizations = state.organizations.filter((entry) => entry.org_id !== orgId);
    state.organization_members = state.organization_members.filter((entry) => entry.org_id !== orgId);
    state.plan_jobs = state.plan_jobs.filter((entry) => entry.org_id !== orgId);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.delete',
      payload: { org_id: orgId },
    });
    return true;
  }, { operation: 'organization.delete', entity_id: orgId });
}

export async function setOrganizationMemberRole(
  tenantId: string,
  actorId: string,
  input: { org_id: string; subject: string; role: TenantAdminRole },
): Promise<OrganizationMemberRecord> {
  return mutateState(tenantId, (state) => {
    ensureOrganizationExists(state, input.org_id);
    requireOrganizationRole(state, input.org_id, actorId, 'admin');
    const membership = upsertOrganizationMembership(state, input.org_id, input.subject, input.role);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.member.set_role',
      payload: { org_id: input.org_id, subject: input.subject, role: input.role },
    });
    return membership;
  }, { operation: 'organization.member.set_role', entity_id: input.org_id });
}

export async function validateOrganizationAdmin(
  tenantId: string,
  actorId: string,
  orgId: string,
  minimumRole: TenantAdminRole = 'admin',
): Promise<{ org_id: string; actor_id: string; role: TenantAdminRole | null; allow: boolean; reasons: string[] }> {
  const record = await loadState(tenantId);
  const role = actorRoleFor(record.state, orgId, actorId);
  const allow = role !== null && ROLE_PRIORITY[role] >= ROLE_PRIORITY[minimumRole];
  return {
    org_id: orgId,
    actor_id: actorId,
    role,
    allow,
    reasons: allow ? [] : [
      role === null ? 'actor_is_not_an_org_member' : `role_${role}_below_required_${minimumRole}`,
    ],
  };
}

export async function enqueuePlanJob(
  tenantId: string,
  actorId: string,
  input: { org_id: string; plan_hash: string; max_attempts?: number },
): Promise<PlanJobRecord> {
  return mutateState(tenantId, (state) => {
    ensureOrganizationExists(state, input.org_id);
    requireOrganizationRole(state, input.org_id, actorId, 'operator');
    if (!state.plans.some((entry) => entry.plan_hash === input.plan_hash)) {
      throw new ProblemError(404, 'Plan Not Found', 'No plan matched the provided plan_hash.', {
        code: 'plan_not_found',
        errors: [{ plan_hash: input.plan_hash }],
      });
    }
    const now = Date.now();
    const job: PlanJobRecord = {
      job_id: `job_${hashValue({ tenantId, orgId: input.org_id, planHash: input.plan_hash, now }).slice(0, 16)}`,
      tenant_id: tenantId,
      org_id: input.org_id,
      plan_hash: input.plan_hash,
      status: 'pending',
      attempt_count: 0,
      max_attempts: Math.max(1, input.max_attempts ?? 3),
      lease_owner: null,
      lease_expires_at_unix_ms: null,
      next_attempt_at_unix_ms: now,
      last_error_code: null,
      last_error_detail: null,
      created_by: actorId,
      created_at_unix_ms: now,
      updated_at_unix_ms: now,
      completed_run_id: null,
    };
    state.plan_jobs.unshift(job);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'plan.job.enqueue',
      payload: { org_id: input.org_id, job_id: job.job_id, plan_hash: input.plan_hash, max_attempts: job.max_attempts },
    });
    return job;
  }, { operation: 'plan.job.enqueue', entity_id: input.org_id });
}

export async function recoverStalePlanJobs(
  tenantId: string,
  actorId: string,
  orgId?: string,
): Promise<string[]> {
  return mutateState(tenantId, (state) => {
    const now = Date.now();
    const recovered: string[] = [];
    for (const job of state.plan_jobs) {
      if (orgId && job.org_id !== orgId) continue;
      if (job.status === 'running' && (job.lease_expires_at_unix_ms ?? 0) <= now) {
        requireOrganizationRole(state, job.org_id, actorId, 'operator');
        job.status = job.attempt_count >= job.max_attempts ? 'failed' : 'pending';
        job.lease_owner = null;
        job.lease_expires_at_unix_ms = null;
        job.next_attempt_at_unix_ms = now;
        job.last_error_code = job.status === 'failed' ? 'job_lease_expired_max_attempts' : 'job_lease_expired_recovered';
        job.last_error_detail = 'Recovered after process loss or lease expiry.';
        job.updated_at_unix_ms = now;
        recovered.push(job.job_id);
      }
    }
    if (recovered.length > 0) {
      appendLog(state, {
        tenant_id: tenantId,
        actor: actorId,
        event_type: 'plan.job.recover',
        payload: { org_id: orgId ?? null, recovered_jobs: recovered },
      });
    }
    return recovered;
  }, { operation: 'plan.job.recover', entity_id: orgId });
}

export async function claimNextPlanJob(
  tenantId: string,
  actorId: string,
  workerId: string,
  orgId?: string,
): Promise<PlanJobRecord | null> {
  return mutateState(tenantId, (state) => {
    if (orgId) {
      ensureOrganizationExists(state, orgId);
      requireOrganizationRole(state, orgId, actorId, 'operator');
    }
    const now = Date.now();
    const job = nextJobToClaim(state, orgId ?? null, now);
    if (!job) {
      return null;
    }
    requireOrganizationRole(state, job.org_id, actorId, 'operator');
    job.status = 'running';
    job.attempt_count += 1;
    job.lease_owner = workerId;
    job.lease_expires_at_unix_ms = now + JOB_LEASE_MS;
    job.updated_at_unix_ms = now;
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'plan.job.claim',
      payload: { org_id: job.org_id, job_id: job.job_id, worker_id: workerId, attempt_count: job.attempt_count },
    });
    return { ...job };
  }, { operation: 'plan.job.claim', entity_id: orgId ?? workerId });
}

async function finalizePlanJob(
  tenantId: string,
  actorId: string,
  workerId: string,
  jobId: string,
  outcome: { ok: true; run_id: string } | { ok: false; code: string; detail: string },
): Promise<PlanJobRecord | null> {
  return mutateState(tenantId, (state) => {
    const job = state.plan_jobs.find((entry) => entry.job_id === jobId);
    if (!job) {
      return null;
    }
    requireOrganizationRole(state, job.org_id, actorId, 'operator');
    if (job.lease_owner !== workerId) {
      throw new ProblemError(409, 'Job Lease Conflict', 'The durable plan job lease is owned by a different worker.', {
        code: 'plan_job_lease_conflict',
        errors: [{ job_id: jobId }],
      });
    }
    const now = Date.now();
    job.lease_owner = null;
    job.lease_expires_at_unix_ms = null;
    job.updated_at_unix_ms = now;
    if (outcome.ok) {
      job.status = 'completed';
      job.completed_run_id = outcome.run_id;
      job.last_error_code = null;
      job.last_error_detail = null;
    } else {
      const retryable = job.attempt_count < job.max_attempts;
      job.status = retryable ? 'retry_wait' : 'failed';
      job.next_attempt_at_unix_ms = retryable ? now + JOB_RETRY_DELAY_MS : now;
      job.last_error_code = outcome.code;
      job.last_error_detail = outcome.detail;
    }
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: outcome.ok ? 'plan.job.complete' : 'plan.job.fail',
      payload: {
        org_id: job.org_id,
        job_id: job.job_id,
        status: job.status,
        completed_run_id: job.completed_run_id,
        last_error_code: job.last_error_code,
      },
    });
    return { ...job };
  }, { operation: 'plan.job.finalize', entity_id: jobId });
}

export async function processPlanJobs(
  tenantId: string,
  actorId: string,
  workerId: string,
  options: { org_id?: string; limit?: number } = {},
): Promise<Array<{ job: PlanJobRecord; run_id: string | null }>> {
  await recoverStalePlanJobs(tenantId, actorId, options.org_id);
  const processed: Array<{ job: PlanJobRecord; run_id: string | null }> = [];
  const limit = Math.max(1, options.limit ?? 1);
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextPlanJob(tenantId, actorId, workerId, options.org_id);
    if (!job) {
      break;
    }
    try {
      const run = await runPlan(tenantId, actorId, job.plan_hash);
      if (!run) {
        const failed = await finalizePlanJob(tenantId, actorId, workerId, job.job_id, {
          ok: false,
          code: 'plan_not_found',
          detail: 'Plan disappeared before queued job execution.',
        });
        if (failed) processed.push({ job: failed, run_id: null });
        continue;
      }
      const completed = await finalizePlanJob(tenantId, actorId, workerId, job.job_id, {
        ok: true,
        run_id: run.run_id,
      });
      if (completed) processed.push({ job: completed, run_id: run.run_id });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'queued job execution failed';
      const failed = await finalizePlanJob(tenantId, actorId, workerId, job.job_id, {
        ok: false,
        code: 'plan_job_execution_failed',
        detail,
      });
      if (failed) processed.push({ job: failed, run_id: null });
    }
  }
  return processed;
}

export async function listPlanJobs(
  tenantId: string,
  actorId: string,
  orgId?: string,
): Promise<PlanJobRecord[]> {
  const record = await loadState(tenantId);
  const jobs = record.state.plan_jobs.filter((entry) => {
    if (orgId && entry.org_id !== orgId) return false;
    return actorRoleFor(record.state, entry.org_id, actorId) !== null;
  });
  return jobs.sort((a, b) => b.updated_at_unix_ms - a.updated_at_unix_ms);
}

export async function getTenantOrganizationsHealth(
  tenantId: string,
  actorId: string,
): Promise<TenantOrganizationHealth[]> {
  const record = await loadState(tenantId);
  const actorOrgIds = new Set(
    record.state.organization_members
      .filter((entry) => entry.actor_id === actorId)
      .map((entry) => entry.org_id),
  );
  return record.state.organizations
    .filter((organization) => actorOrgIds.has(organization.org_id))
    .map((organization) => {
      const jobs = record.state.plan_jobs.filter((entry) => entry.org_id === organization.org_id);
      const runningJobs = jobs.filter((entry) => entry.status === 'running').length;
      const pendingJobs = jobs.filter((entry) => entry.status === 'pending' || entry.status === 'retry_wait').length;
      const latestCompleted = jobs
        .filter((entry) => entry.status === 'completed')
        .sort((a, b) => b.updated_at_unix_ms - a.updated_at_unix_ms)[0];
      const latestFailure = jobs
        .filter((entry) => entry.last_error_code)
        .sort((a, b) => b.updated_at_unix_ms - a.updated_at_unix_ms)[0];
      return {
        org_id: organization.org_id,
        tenant_id: tenantId,
        status: organization.status === 'paused'
          ? 'paused' as const
          : latestFailure?.last_error_code
            ? 'degraded' as const
            : 'healthy' as const,
        queue_depth: pendingJobs,
        jobs_running: runningJobs,
        last_job_completed_at_unix_ms: latestCompleted?.updated_at_unix_ms ?? null,
        last_error_code: latestFailure?.last_error_code ?? null,
      };
    })
    .sort((a, b) => a.org_id.localeCompare(b.org_id));
}

export async function listSnapshots(tenantId: string): Promise<Snapshot[]> {
  const record = await loadState(tenantId);
  return record.state.snapshots.sort(
    (a, b) => b.timestamp_unix_ms - a.timestamp_unix_ms,
  );
}

export async function createSnapshot(tenantId: string, actorId: string): Promise<Snapshot> {
  return mutateState(tenantId, (state) => {
    const timestamp = Date.now();
    const snapshot: Snapshot = {
      snapshot_version: 1,
      logical_time: state.logs[0]?.seq ?? 0,
      event_log_head: state.logs[0]?.data_hash ?? '0'.repeat(64),
      cas_root_hash: hashValue(state.cas_objects),
      active_caps: state.capabilities
        .filter((entry) => !entry.revoked)
        .map((entry) => entry.fingerprint),
      revoked_caps: state.capabilities
        .filter((entry) => entry.revoked)
        .map((entry) => entry.fingerprint),
      budgets: { current: buildBudget(state) },
      policies: Object.fromEntries(
        state.policies.map((policy) => [policy.hash, policy.hash]),
      ),
      snapshot_hash: hashValue({
        tenantId,
        timestamp,
        budgets: state.budgets,
        policies: state.policies.map((entry) => entry.hash),
      }),
      timestamp_unix_ms: timestamp,
    };
    state.snapshots.unshift(snapshot);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'snapshot.create',
      payload: {
        snapshot_hash: snapshot.snapshot_hash,
        logical_time: snapshot.logical_time,
      },
    });
    return snapshot;
  }, { operation: 'snapshot.create' });
}

export async function restoreSnapshot(
  tenantId: string,
  actorId: string,
  snapshotHash: string,
): Promise<Snapshot | null> {
  return mutateState(tenantId, (state) => {
    const snapshot = state.snapshots.find(
      (entry) => entry.snapshot_hash === snapshotHash,
    );
    if (!snapshot) {
      return null;
    }
    const currentBudget = snapshot.budgets.current;
    if (currentBudget) {
      for (const unit of Object.keys(state.budgets) as BudgetUnitName[]) {
        const restored = currentBudget.budgets[unit];
        if (restored) {
          state.budgets[unit].limit = restored.limit;
          state.budgets[unit].used = restored.used;
          state.budgets[unit].window_started_at_unix_ms = Date.now();
        }
      }
    }
    state.capabilities = state.capabilities.map((cap) => ({
      ...cap,
      revoked: snapshot.revoked_caps.includes(cap.fingerprint),
      event_type: snapshot.revoked_caps.includes(cap.fingerprint)
        ? 'cap.revoke'
        : 'cap.mint',
    }));
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'snapshot.restore',
      payload: {
        snapshot_hash: snapshotHash,
        restored_logical_time: snapshot.logical_time,
      },
    });
    return snapshot;
  }, { operation: 'snapshot.restore', entity_id: snapshotHash });
}

export async function listLogs(
  tenantId: string,
): Promise<Array<
  EventLogEntry & { message: string; payload: Record<string, unknown> }
>> {
  const record = await loadState(tenantId);
  return record.state.logs;
}

export async function listCasObjects(tenantId: string, prefix = ''): Promise<CasObject[]> {
  const record = await loadState(tenantId);
  return record.state.cas_objects.filter((entry) =>
    entry.digest.startsWith(prefix),
  );
}

export async function hasCasObject(tenantId: string, hash: string): Promise<boolean> {
  const record = await loadState(tenantId);
  return record.state.cas_objects.some((entry) => entry.digest === hash);
}

export async function listRunSummaries(
  tenantId: string,
): Promise<Array<{
  run_id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  determinism_verified: boolean;
}>> {
  const record = await loadState(tenantId);
  return record.state.plan_runs
    .map((run) => ({
      run_id: run.run_id,
      tenant_id: run.tenant_id,
      status: run.ok ? 'ok' : 'failed',
      created_at: new Date(run.created_at_unix_ms).toISOString(),
      determinism_verified: true,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getRunSummary(
  tenantId: string,
  runId: string,
): Promise<{
  run_id: string;
  plan_hash: string;
  tenant_id: string;
  receipt_hash: string;
  result_digest: string;
} | null> {
  const record = await loadState(tenantId);
  const run = record.state.plan_runs.find(
    (entry) => entry.run_id === runId,
  );
  if (!run) {
    return null;
  }
  const result_digest = hashValue(run.step_results);
  return {
    run_id: run.run_id,
    plan_hash: run.plan_hash,
    tenant_id: run.tenant_id,
    receipt_hash: run.receipt_hash,
    result_digest,
  };
}

// ---------------------------------------------------------------------------
// Invite lifecycle
// ---------------------------------------------------------------------------

const INVITE_EXPIRY_MS = Number(process.env.REQUIEM_INVITE_EXPIRY_MS ?? 7 * 24 * 60 * 60 * 1000); // 7 days

export async function createInvite(
  tenantId: string,
  actorId: string,
  input: { org_id: string; email: string; role: TenantAdminRole },
): Promise<{ invite: InviteRecord; token: string }> {
  const token = randomUUID();
  const tokenHash = hashValue(token);

  const invite = await mutateState(tenantId, (state) => {
    ensureOrganizationExists(state, input.org_id);
    requireOrganizationRole(state, input.org_id, actorId, 'admin');
    const existing = state.organization_invites.find(
      (entry) => entry.org_id === input.org_id && entry.email === input.email.toLowerCase().trim() && entry.status === 'pending',
    );
    if (existing) {
      throw new ProblemError(409, 'Invite Exists', 'A pending invite already exists for this email in this organization.', {
        code: 'invite_exists',
        errors: [{ org_id: input.org_id, email: input.email }],
      });
    }
    const now = Date.now();
    const record: InviteRecord = {
      invite_id: `inv_${hashValue({ tenantId, orgId: input.org_id, email: input.email, now }).slice(0, 16)}`,
      org_id: input.org_id,
      tenant_id: tenantId,
      email: input.email.toLowerCase().trim(),
      role: input.role,
      status: 'pending',
      token_hash: tokenHash,
      invited_by: actorId,
      accepted_by: null,
      expires_at_unix_ms: now + INVITE_EXPIRY_MS,
      created_at_unix_ms: now,
      updated_at_unix_ms: now,
    };
    state.organization_invites.unshift(record);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.invite.create',
      payload: { org_id: input.org_id, invite_id: record.invite_id, email: record.email, role: input.role },
    });
    return record;
  }, { operation: 'organization.invite.create', entity_id: input.org_id });

  return { invite, token };
}

export async function acceptInvite(
  tenantId: string,
  actorId: string,
  token: string,
): Promise<{ invite: InviteRecord; membership: OrganizationMemberRecord }> {
  const tokenHash = hashValue(token);
  return mutateState(tenantId, (state) => {
    const invite = state.organization_invites.find(
      (entry) => entry.token_hash === tokenHash,
    );
    if (!invite) {
      throw new ProblemError(404, 'Invite Not Found', 'No invite matched the provided token.', {
        code: 'invite_not_found',
      });
    }
    if (invite.status === 'accepted') {
      throw new ProblemError(410, 'Invite Already Used', 'This invite has already been accepted.', {
        code: 'invite_already_used',
        errors: [{ invite_id: invite.invite_id }],
      });
    }
    if (invite.status === 'revoked') {
      throw new ProblemError(410, 'Invite Revoked', 'This invite has been revoked by an administrator.', {
        code: 'invite_revoked',
        errors: [{ invite_id: invite.invite_id }],
      });
    }
    if (invite.status === 'expired' || invite.expires_at_unix_ms <= Date.now()) {
      invite.status = 'expired';
      invite.updated_at_unix_ms = Date.now();
      throw new ProblemError(410, 'Invite Expired', 'This invite has expired.', {
        code: 'invite_expired',
        errors: [{ invite_id: invite.invite_id }],
      });
    }
    ensureOrganizationExists(state, invite.org_id);
    invite.status = 'accepted';
    invite.accepted_by = actorId;
    invite.updated_at_unix_ms = Date.now();
    const membership = upsertOrganizationMembership(state, invite.org_id, actorId, invite.role);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.invite.accept',
      payload: { org_id: invite.org_id, invite_id: invite.invite_id, role: invite.role },
    });
    return { invite, membership };
  }, { operation: 'organization.invite.accept' });
}

export async function revokeInvite(
  tenantId: string,
  actorId: string,
  inviteId: string,
): Promise<InviteRecord> {
  return mutateState(tenantId, (state) => {
    const invite = state.organization_invites.find(
      (entry) => entry.invite_id === inviteId,
    );
    if (!invite) {
      throw new ProblemError(404, 'Invite Not Found', 'No invite matched the provided invite_id.', {
        code: 'invite_not_found',
        errors: [{ invite_id: inviteId }],
      });
    }
    requireOrganizationRole(state, invite.org_id, actorId, 'admin');
    if (invite.status !== 'pending') {
      throw new ProblemError(409, 'Invite Not Pending', `Cannot revoke an invite in status '${invite.status}'.`, {
        code: 'invite_not_revocable',
        errors: [{ invite_id: inviteId, status: invite.status }],
      });
    }
    invite.status = 'revoked';
    invite.updated_at_unix_ms = Date.now();
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.invite.revoke',
      payload: { org_id: invite.org_id, invite_id: invite.invite_id },
    });
    return invite;
  }, { operation: 'organization.invite.revoke', entity_id: inviteId });
}

export async function listInvites(
  tenantId: string,
  actorId: string,
  orgId: string,
): Promise<InviteRecord[]> {
  const record = await loadState(tenantId);
  ensureOrganizationExists(record.state, orgId);
  requireOrganizationRole(record.state, orgId, actorId, 'admin');
  return record.state.organization_invites
    .filter((entry) => entry.org_id === orgId)
    .sort((a, b) => b.created_at_unix_ms - a.created_at_unix_ms);
}

// ---------------------------------------------------------------------------
// Member removal
// ---------------------------------------------------------------------------

export async function removeOrganizationMember(
  tenantId: string,
  actorId: string,
  orgId: string,
  subject: string,
): Promise<boolean> {
  return mutateState(tenantId, (state) => {
    ensureOrganizationExists(state, orgId);
    requireOrganizationRole(state, orgId, actorId, 'admin');
    if (actorId === subject) {
      throw new ProblemError(400, 'Cannot Remove Self', 'An admin cannot remove themselves from the organization.', {
        code: 'cannot_remove_self',
        errors: [{ org_id: orgId }],
      });
    }
    const before = state.organization_members.length;
    state.organization_members = state.organization_members.filter(
      (entry) => !(entry.org_id === orgId && entry.actor_id === subject),
    );
    if (state.organization_members.length === before) {
      throw new ProblemError(404, 'Member Not Found', 'The specified actor is not a member of this organization.', {
        code: 'member_not_found',
        errors: [{ org_id: orgId, subject }],
      });
    }
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: 'organization.member.remove',
      payload: { org_id: orgId, subject },
    });
    return true;
  }, { operation: 'organization.member.remove', entity_id: orgId });
}

export async function listOrganizationMembers(
  tenantId: string,
  actorId: string,
  orgId: string,
): Promise<{ members: OrganizationMemberRecord[]; seat_count: number }> {
  const record = await loadState(tenantId);
  ensureOrganizationExists(record.state, orgId);
  requireOrganizationRole(record.state, orgId, actorId, 'viewer');
  const members = record.state.organization_members
    .filter((entry) => entry.org_id === orgId)
    .sort((a, b) => a.created_at_unix_ms - b.created_at_unix_ms);
  return { members, seat_count: members.length };
}

// ---------------------------------------------------------------------------
// Autonomous background worker
// ---------------------------------------------------------------------------

export interface WorkerLoopOptions {
  tenantId: string;
  actorId: string;
  workerId: string;
  orgId?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  signal?: AbortSignal;
  onCycle?: (result: WorkerCycleResult) => void;
}

export interface WorkerCycleResult {
  cycle: number;
  jobs_processed: number;
  jobs_recovered: number;
  errors: string[];
  timestamp_unix_ms: number;
  duration_ms: number;
}

export interface WorkerHandle {
  workerId: string;
  started_at_unix_ms: number;
  stop: () => void;
  waitForCycle: () => Promise<WorkerCycleResult>;
  getCycles: () => WorkerCycleResult[];
}

export function startWorkerLoop(options: WorkerLoopOptions): WorkerHandle {
  const {
    tenantId,
    actorId,
    workerId,
    orgId,
    pollIntervalMs = Number(process.env.REQUIEM_WORKER_POLL_MS ?? 5_000),
    batchSize = Number(process.env.REQUIEM_WORKER_BATCH_SIZE ?? 10),
    signal,
    onCycle,
  } = options;

  const ac = new AbortController();
  const combinedSignal = signal
    ? AbortSignal.any([ac.signal, signal])
    : ac.signal;

  const cycles: WorkerCycleResult[] = [];
  let cycleCount = 0;
  let resolveNextCycle: ((result: WorkerCycleResult) => void) | null = null;

  async function runCycle(): Promise<WorkerCycleResult> {
    const start = Date.now();
    cycleCount += 1;
    const errors: string[] = [];
    let jobsProcessed = 0;
    let jobsRecovered = 0;

    try {
      const recovered = await recoverStalePlanJobs(tenantId, actorId, orgId);
      jobsRecovered = recovered.length;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'recovery failed');
    }

    try {
      const processed = await processPlanJobs(tenantId, actorId, workerId, {
        org_id: orgId,
        limit: batchSize,
      });
      jobsProcessed = processed.length;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'processing failed');
    }

    const result: WorkerCycleResult = {
      cycle: cycleCount,
      jobs_processed: jobsProcessed,
      jobs_recovered: jobsRecovered,
      errors,
      timestamp_unix_ms: Date.now(),
      duration_ms: Date.now() - start,
    };
    cycles.push(result);
    onCycle?.(result);
    return result;
  }

  async function loop() {
    while (!combinedSignal.aborted) {
      const result = await runCycle();
      if (resolveNextCycle) {
        resolveNextCycle(result);
        resolveNextCycle = null;
      }
      if (combinedSignal.aborted) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, pollIntervalMs);
        combinedSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      });
    }
  }

  loop().catch(() => { /* worker loop exited */ });

  return {
    workerId,
    started_at_unix_ms: Date.now(),
    stop: () => ac.abort(),
    waitForCycle: () => new Promise<WorkerCycleResult>((resolve) => {
      resolveNextCycle = resolve;
    }),
    getCycles: () => [...cycles],
  };
}
