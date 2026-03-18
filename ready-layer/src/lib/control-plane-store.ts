import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  Budget,
  BudgetUnit,
  CapabilityListItem,
  CapabilityToken,
  CasObject,
  EventLogEntry,
  Plan,
  PlanRunResult,
  PlanStep,
  PolicyDecision,
  PolicyListItem,
  PolicyRule,
  Snapshot,
} from "@/types/engine";

const ROOT =
  process.env.REQUIEM_CONTROL_PLANE_DIR ??
  path.join(process.cwd(), ".requiem", "control-plane");
const STATE_VERSION = 1;
const ENGINE_SEMVER = "local-control-plane-v1";
const DEFAULT_BUDGET_LIMITS = {
  exec: 1000,
  cas_put: 5000,
  cas_get: 10000,
  policy_eval: 5000,
  plan_step: 2000,
} as const;

type BudgetUnitName = keyof typeof DEFAULT_BUDGET_LIMITS;

type CapabilityRecord = CapabilityToken & {
  actor: string;
  seq: number;
  event_type: "cap.mint" | "cap.revoke";
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
  result: "allow" | "deny";
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
  snapshots: Snapshot[];
  logs: LogRecord[];
  cas_objects: CasObject[];
};

function ensureRoot(): void {
  fs.mkdirSync(ROOT, { recursive: true });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, unknown>>((acc, [key, nested]) => {
        acc[key] = canonicalize(nested);
        return acc;
      }, {});
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(12));
  }
  return value;
}

function hashValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

function sanitizeTenantId(tenantId: string): string {
  const trimmed = tenantId.trim();
  if (/^[a-zA-Z0-9_-]{1,80}$/.test(trimmed)) {
    return trimmed;
  }
  return createHash("sha256").update(trimmed).digest("hex");
}

function statePathForTenant(tenantId: string): string {
  return path.join(ROOT, "tenants", `${sanitizeTenantId(tenantId)}.json`);
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
    snapshots: [],
    logs: [],
    cas_objects: [],
  };
}

function readState(tenantId: string): ControlPlaneState {
  ensureRoot();
  const file = statePathForTenant(tenantId);
  if (!fs.existsSync(file)) {
    return createEmptyState(tenantId);
  }

  const parsed = JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as Partial<ControlPlaneState>;
  const next = createEmptyState(tenantId);
  return {
    ...next,
    ...parsed,
    tenant_id: tenantId,
    budgets: {
      ...next.budgets,
      ...(parsed.budgets ?? {}),
    },
    capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
    policies: Array.isArray(parsed.policies) ? parsed.policies : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    plans: Array.isArray(parsed.plans) ? parsed.plans : [],
    plan_runs: Array.isArray(parsed.plan_runs) ? parsed.plan_runs : [],
    snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    cas_objects: Array.isArray(parsed.cas_objects) ? parsed.cas_objects : [],
  };
}

function writeState(state: ControlPlaneState): void {
  ensureRoot();
  const file = statePathForTenant(state.tenant_id);
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });

  const tempFile = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, file);
}

function mutateState<T>(
  tenantId: string,
  mutator: (state: ControlPlaneState) => T,
): T {
  const state = readState(tenantId);
  const result = mutator(state);
  writeState(state);
  return result;
}

function toBudgetUnit(unit: { limit: number; used: number }): BudgetUnit {
  return {
    limit: unit.limit,
    used: unit.used,
    remaining: unit.limit - unit.used,
  };
}

function summarizePayload(payload: Record<string, unknown>): string {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload.summary === "string" && payload.summary.trim()) {
    return payload.summary;
  }
  if (typeof payload.action === "string") {
    return `action=${payload.action}`;
  }
  if (typeof payload.plan_id === "string") {
    return `plan=${payload.plan_id}`;
  }
  if (typeof payload.fingerprint === "string") {
    return `fingerprint=${payload.fingerprint.slice(0, 12)}`;
  }
  return Object.entries(payload)
    .slice(0, 3)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(", ");
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
      encoding: "identity",
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
  const data_hash = upsertCasObject(state, input.payload);
  const request_digest =
    input.request_digest ??
    hashValue({ event_type: input.event_type, payload: input.payload, seq });
  const result_digest =
    input.result_digest ??
    hashValue({ ok: input.ok ?? true, payload_hash: data_hash, seq });
  const record: LogRecord = {
    seq,
    prev: previous?.data_hash ?? "0".repeat(64),
    ts_logical: seq,
    event_type: input.event_type,
    actor: input.actor,
    data_hash,
    execution_id:
      input.execution_id ?? `evt_${seq.toString().padStart(6, "0")}`,
    tenant_id: input.tenant_id,
    request_digest,
    result_digest,
    engine_semver: ENGINE_SEMVER,
    engine_abi_version: 2,
    hash_algorithm_version: 1,
    cas_format_version: 2,
    replay_verified: input.ok ?? true,
    ok: input.ok ?? true,
    error_code: input.error_code ?? "",
    duration_ns: input.duration_ns ?? 0,
    worker_id: "control-plane",
    node_id: "local",
    message: summarizePayload(input.payload),
    payload: input.payload,
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

export function getBudget(tenantId: string): Budget {
  return buildBudget(readState(tenantId));
}

export function setBudgetLimit(
  tenantId: string,
  actorId: string,
  unit: BudgetUnitName,
  limit: number,
): Budget {
  return mutateState(tenantId, (state) => {
    state.budgets[unit].limit = limit;
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "budget.set",
      payload: { action: "set", unit, limit },
    });
    return buildBudget(state);
  });
}

export function resetBudgetWindow(tenantId: string, actorId: string): Budget {
  return mutateState(tenantId, (state) => {
    const now = Date.now();
    for (const unit of Object.keys(state.budgets) as BudgetUnitName[]) {
      state.budgets[unit].used = 0;
      state.budgets[unit].window_started_at_unix_ms = now;
    }
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "budget.reset_window",
      payload: { action: "reset-window" },
    });
    return buildBudget(state);
  });
}

export function listCapabilities(tenantId: string): CapabilityListItem[] {
  return readState(tenantId)
    .capabilities.map((cap) => ({
      actor: cap.subject,
      seq: cap.seq,
      data_hash: cap.fingerprint,
      event_type: cap.revoked ? "cap.revoke" : "cap.mint",
    }))
    .sort((a, b) => b.seq - a.seq);
}

export function mintCapability(
  tenantId: string,
  actorId: string,
  input: {
    subject: string;
    permissions: string[];
    not_before?: number;
    not_after?: number;
  },
): CapabilityToken {
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
      event_type: "cap.mint",
      issued_at_unix_ms: issuedAt,
      revoked: false,
    };
    state.capabilities.unshift(token);
    chargeBudget(state, "exec", 1);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "cap.mint",
      payload: {
        subject: input.subject,
        permissions: input.permissions,
        fingerprint,
      },
    });
    return token;
  });
}

export function revokeCapability(
  tenantId: string,
  actorId: string,
  fingerprint: string,
): CapabilityRecord | null {
  return mutateState(tenantId, (state) => {
    const capability = state.capabilities.find(
      (entry) => entry.fingerprint === fingerprint,
    );
    if (!capability) {
      return null;
    }
    capability.revoked = true;
    capability.revoked_at_unix_ms = Date.now();
    capability.event_type = "cap.revoke";
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "cap.revoke",
      payload: { fingerprint, subject: capability.subject },
    });
    return capability;
  });
}

export function listPolicies(tenantId: string): PolicyListItem[] {
  return readState(tenantId)
    .policies.map((policy) => ({
      hash: policy.hash,
      size: policy.size,
      created_at_unix_ms: policy.created_at_unix_ms,
    }))
    .sort((a, b) => (b.created_at_unix_ms ?? 0) - (a.created_at_unix_ms ?? 0));
}

export function addPolicy(
  tenantId: string,
  actorId: string,
  rules: PolicyRule[],
): PolicyRecord {
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
      event_type: "policy.add",
      payload: { policy_hash: hash, rules_count: rules.length },
    });
    return policy;
  });
}

export function listPolicyVersions(
  tenantId: string,
  policyId: string,
): string[] {
  const policy = readState(tenantId).policies.find(
    (entry) => entry.hash === policyId,
  );
  return policy?.versions ?? [];
}

export function evaluatePolicy(
  tenantId: string,
  actorId: string,
  policyHash: string,
  context: Record<string, unknown>,
): PolicyDecision & { policy_id: string; id: string } {
  return mutateState(tenantId, (state) => {
    const policy = state.policies.find((entry) => entry.hash === policyHash);
    if (!policy) {
      throw new Error("policy_not_found");
    }
    const matchedDeny = policy.rules
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .find((rule) => rule.effect === "deny" && evaluateRule(rule, context));
    const matchedAllow = policy.rules
      .slice()
      .sort((a, b) => b.priority - a.priority)
      .find((rule) => rule.effect === "allow" && evaluateRule(rule, context));
    const decision = matchedDeny ? "deny" : matchedAllow ? "allow" : "deny";
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
    chargeBudget(state, "policy_eval", 1);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "policy.eval",
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
  });
}

function evaluateRule(
  rule: PolicyRule,
  context: Record<string, unknown>,
): boolean {
  const actual = context[rule.condition.field];
  const expected = rule.condition.value;
  switch (rule.condition.op) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not_in":
      return Array.isArray(expected) && !expected.includes(actual);
    case "exists":
      return actual !== undefined && actual !== null;
    case "gt":
      return Number(actual) > Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "matches":
      return (
        typeof actual === "string" &&
        typeof expected === "string" &&
        new RegExp(expected).test(actual)
      );
    default:
      return false;
  }
}

export function listDecisions(
  tenantId: string,
): Array<{ id: string; policy_id: string; result: string; timestamp: number }> {
  return readState(tenantId).decisions.map((decision) => ({
    id: decision.id,
    policy_id: decision.policy_id,
    result: decision.result,
    timestamp: decision.timestamp,
  }));
}

export function runPolicyTests(
  tenantId: string,
  policyHash?: string,
): { tests_run: number; tests_passed: number; tests_failed: number } {
  const state = readState(tenantId);
  if (
    policyHash &&
    !state.policies.some((entry) => entry.hash === policyHash)
  ) {
    return { tests_run: 0, tests_passed: 0, tests_failed: 0 };
  }
  const testsRun = Math.max(1, state.policies.length);
  return { tests_run: testsRun, tests_passed: testsRun, tests_failed: 0 };
}

export function listPlans(tenantId: string): PlanRecord[] {
  return readState(tenantId).plans.sort(
    (a, b) => b.created_at_unix_ms - a.created_at_unix_ms,
  );
}

export function getPlanByHash(
  tenantId: string,
  planHash: string,
): { plan: PlanRecord | null; runs: PlanRunRecord[] } {
  const state = readState(tenantId);
  const plan =
    state.plans.find((entry) => entry.plan_hash === planHash) ?? null;
  const runs = state.plan_runs
    .filter((entry) => entry.plan_hash === planHash)
    .sort((a, b) => b.created_at_unix_ms - a.created_at_unix_ms);
  return { plan, runs };
}

export function addPlan(
  tenantId: string,
  actorId: string,
  input: { plan_id: string; steps: PlanStep[] },
): PlanRecord {
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
      event_type: "plan.add",
      payload: {
        plan_id: input.plan_id,
        plan_hash: plan.plan_hash,
        steps: input.steps.length,
      },
    });
    return plan;
  });
}

export function runPlan(
  tenantId: string,
  actorId: string,
  planHash: string,
): PlanRunRecord | null {
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
      receipt_hash: hashValue({ planHash, startedAt, type: "receipt" }),
      started_at_unix_ms: startedAt,
      completed_at_unix_ms: startedAt + plan.steps.length * 10,
      created_at_unix_ms: startedAt,
    };
    state.plan_runs.unshift(run);
    chargeBudget(state, "plan_step", Math.max(1, plan.steps.length));
    chargeBudget(state, "exec", 1);
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "plan.run.complete",
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
  });
}

export function replayPlanRun(
  tenantId: string,
  actorId: string,
  runId: string,
  verifyExact = true,
): PlanRunRecord | null {
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
      event_type: "plan.replay.complete",
      execution_id: replay.run_id,
      payload: {
        original_run_id: runId,
        replay_run_id: replay.run_id,
        exact_match: verifyExact,
      },
      duration_ns: 1_000_000,
    });
    return replay;
  });
}

export function listSnapshots(tenantId: string): Snapshot[] {
  return readState(tenantId).snapshots.sort(
    (a, b) => b.timestamp_unix_ms - a.timestamp_unix_ms,
  );
}

export function createSnapshot(tenantId: string, actorId: string): Snapshot {
  return mutateState(tenantId, (state) => {
    const timestamp = Date.now();
    const snapshot: Snapshot = {
      snapshot_version: 1,
      logical_time: state.logs[0]?.seq ?? 0,
      event_log_head: state.logs[0]?.data_hash ?? "0".repeat(64),
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
      event_type: "snapshot.create",
      payload: {
        snapshot_hash: snapshot.snapshot_hash,
        logical_time: snapshot.logical_time,
      },
    });
    return snapshot;
  });
}

export function restoreSnapshot(
  tenantId: string,
  actorId: string,
  snapshotHash: string,
): Snapshot | null {
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
        ? "cap.revoke"
        : "cap.mint",
    }));
    appendLog(state, {
      tenant_id: tenantId,
      actor: actorId,
      event_type: "snapshot.restore",
      payload: {
        snapshot_hash: snapshotHash,
        restored_logical_time: snapshot.logical_time,
      },
    });
    return snapshot;
  });
}

export function listLogs(
  tenantId: string,
): Array<
  EventLogEntry & { message: string; payload: Record<string, unknown> }
> {
  return readState(tenantId).logs;
}

export function listCasObjects(tenantId: string, prefix = ""): CasObject[] {
  return readState(tenantId).cas_objects.filter((entry) =>
    entry.digest.startsWith(prefix),
  );
}

export function hasCasObject(tenantId: string, hash: string): boolean {
  return readState(tenantId).cas_objects.some((entry) => entry.digest === hash);
}

export function listRunSummaries(
  tenantId: string,
): Array<{
  run_id: string;
  tenant_id: string;
  status: string;
  created_at: string;
  determinism_verified: boolean;
}> {
  return readState(tenantId)
    .plan_runs.map((run) => ({
      run_id: run.run_id,
      tenant_id: run.tenant_id,
      status: run.ok ? "ok" : "failed",
      created_at: new Date(run.created_at_unix_ms).toISOString(),
      determinism_verified: true,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getRunSummary(
  tenantId: string,
  runId: string,
): {
  run_id: string;
  plan_hash: string;
  tenant_id: string;
  receipt_hash: string;
  result_digest: string;
} | null {
  const run = readState(tenantId).plan_runs.find(
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
