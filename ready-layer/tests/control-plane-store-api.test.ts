import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const originalEnv = { ...process.env };

function authHeaders(tenantId: string): Record<string, string> {
  return {
    authorization: "Bearer tenant-secret",
    "x-tenant-id": tenantId,
    "x-actor-id": `actor-${tenantId}`,
    "content-type": "application/json",
  };
}

function setupEnv(): string {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), "ready-layer-control-plane-"),
  );
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    REQUIEM_AUTH_SECRET: "tenant-secret",
    REQUIEM_CONTROL_PLANE_DIR: dir,
  };
  return dir;
}

afterEach(() => {
  const dir = process.env.REQUIEM_CONTROL_PLANE_DIR;
  vi.resetModules();
  process.env = { ...originalEnv };
  if (dir) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("control-plane store backed APIs", () => {
  it("persists budget mutations without cross-tenant bleed or demo headers", async () => {
    setupEnv();
    const { GET, POST } = await import("../src/app/api/budgets/route");

    const initial = await GET(
      new NextRequest("http://localhost/api/budgets", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const initialBody = (await initial.json()) as {
      data?: { budget?: { budgets?: { exec?: { limit?: number } } } };
    };
    expect(initial.status).toBe(200);
    expect(initial.headers.get("x-requiem-mode")).toBeNull();
    expect(initialBody.data?.budget?.budgets?.exec?.limit).toBe(1000);

    const updated = await POST(
      new NextRequest("http://localhost/api/budgets", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "budget-set-1",
        },
        body: JSON.stringify({ action: "set", unit: "exec", limit: 321 }),
      }),
    );
    expect(updated.status).toBe(200);

    const reread = await GET(
      new NextRequest("http://localhost/api/budgets", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const rereadBody = (await reread.json()) as {
      data?: { budget?: { budgets?: { exec?: { limit?: number } } } };
    };
    expect(rereadBody.data?.budget?.budgets?.exec?.limit).toBe(321);

    const tenantB = await GET(
      new NextRequest("http://localhost/api/budgets", {
        headers: authHeaders("tenant-b"),
      }),
    );
    const tenantBBody = (await tenantB.json()) as {
      data?: { budget?: { budgets?: { exec?: { limit?: number } } } };
    };
    expect(tenantBBody.data?.budget?.budgets?.exec?.limit).toBe(1000);
  });

  it("supports capability mint and revoke on the same tenant only", async () => {
    setupEnv();
    const capsRoute = await import("../src/app/api/caps/route");

    const mint = await capsRoute.POST(
      new NextRequest("http://localhost/api/caps", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "cap-mint-1",
        },
        body: JSON.stringify({
          action: "mint",
          subject: "svc-api",
          permissions: ["exec.run", "plan.run"],
        }),
      }),
    );
    const mintBody = (await mint.json()) as { data?: { fingerprint?: string } };
    expect(mint.status).toBe(200);
    expect(mintBody.data?.fingerprint).toBeTruthy();

    const listA = await capsRoute.GET(
      new NextRequest("http://localhost/api/caps", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const listABody = (await listA.json()) as {
      data?: { data?: Array<{ actor: string; data_hash: string }> };
    };
    expect(listABody.data?.data).toHaveLength(1);
    expect(listABody.data?.data?.[0]?.actor).toBe("svc-api");

    const listB = await capsRoute.GET(
      new NextRequest("http://localhost/api/caps", {
        headers: authHeaders("tenant-b"),
      }),
    );
    const listBBody = (await listB.json()) as { data?: { data?: unknown[] } };
    expect(listBBody.data?.data ?? []).toHaveLength(0);

    const revoke = await capsRoute.POST(
      new NextRequest("http://localhost/api/caps", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "cap-revoke-1",
        },
        body: JSON.stringify({
          action: "revoke",
          fingerprint: mintBody.data?.fingerprint,
        }),
      }),
    );
    expect(revoke.status).toBe(200);

    const postRevoke = await capsRoute.GET(
      new NextRequest("http://localhost/api/caps", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const postRevokeBody = (await postRevoke.json()) as {
      data?: { data?: Array<{ event_type: string }> };
    };
    expect(postRevokeBody.data?.data?.[0]?.event_type).toBe("cap.revoke");
  });

  it("records policy decisions, runs, and snapshots with tenant-scoped history", async () => {
    setupEnv();
    const policiesRoute = await import("../src/app/api/policies/route");
    const decisionsRoute = await import("../src/app/api/decisions/route");
    const plansRoute = await import("../src/app/api/plans/route");
    const runsRoute = await import("../src/app/api/runs/route");
    const diffRoute = await import("../src/app/api/runs/[runId]/diff/route");
    const snapshotsRoute = await import("../src/app/api/snapshots/route");
    const logsRoute = await import("../src/app/api/logs/route");

    const addPolicy = await policiesRoute.POST(
      new NextRequest("http://localhost/api/policies", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "policy-add-1",
        },
        body: JSON.stringify({
          action: "add",
          rules: [
            {
              rule_id: "deny-delete",
              effect: "deny",
              priority: 100,
              condition: { field: "operation", op: "eq", value: "delete" },
            },
          ],
        }),
      }),
    );
    const addPolicyBody = (await addPolicy.json()) as {
      data?: { policy_hash?: string };
    };
    const policyHash = addPolicyBody.data?.policy_hash;
    expect(policyHash).toBeTruthy();

    const evalPolicy = await policiesRoute.POST(
      new NextRequest("http://localhost/api/policies", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "policy-eval-1",
        },
        body: JSON.stringify({
          action: "eval",
          policy_hash: policyHash,
          context: { operation: "delete" },
        }),
      }),
    );
    const evalBody = (await evalPolicy.json()) as {
      data?: { decision?: { decision?: string } };
    };
    expect(evalBody.data?.decision?.decision).toBe("deny");

    const decisions = await decisionsRoute.GET(
      new NextRequest("http://localhost/api/decisions", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const decisionsBody = (await decisions.json()) as {
      data?: Array<{ policy_id: string }>;
    };
    expect(decisionsBody.data?.[0]?.policy_id).toBe(policyHash);

    const addPlan = await plansRoute.POST(
      new NextRequest("http://localhost/api/plans", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "plan-add-1",
        },
        body: JSON.stringify({
          action: "add",
          plan_id: "nightly-check",
          steps: [
            {
              step_id: "step-1",
              kind: "exec",
              depends_on: [],
              config: { command: "echo", argv: ["hello"] },
            },
            {
              step_id: "step-2",
              kind: "gate",
              depends_on: ["step-1"],
              config: { policy: "allow" },
            },
          ],
        }),
      }),
    );
    const addPlanBody = (await addPlan.json()) as {
      data?: { plan?: { plan_hash?: string } };
    };
    const planHash = addPlanBody.data?.plan?.plan_hash;
    expect(planHash).toBeTruthy();

    const runPlan = await plansRoute.POST(
      new NextRequest("http://localhost/api/plans", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "plan-run-1",
        },
        body: JSON.stringify({ action: "run", plan_hash: planHash }),
      }),
    );
    const runBody = (await runPlan.json()) as {
      data?: { result?: { run_id?: string } };
    };
    const runId = runBody.data?.result?.run_id;
    expect(runId).toBeTruthy();

    const runs = await runsRoute.GET(
      new NextRequest("http://localhost/api/runs", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const runsBody = (await runs.json()) as {
      data?: Array<{ run_id: string }>;
    };
    expect(runsBody.data?.[0]?.run_id).toBe(runId);

    const diff = await diffRoute.GET(
      new NextRequest(`http://localhost/api/runs/${runId}/diff?with=${runId}`, {
        headers: authHeaders("tenant-a"),
      }),
      { params: Promise.resolve({ runId: runId ?? "" }) },
    );
    const diffBody = (await diff.json()) as {
      data?: { deterministic?: boolean };
    };
    expect(diffBody.data?.deterministic).toBe(true);

    const createSnapshot = await snapshotsRoute.POST(
      new NextRequest("http://localhost/api/snapshots", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "snapshot-create-1",
        },
        body: JSON.stringify({ action: "create" }),
      }),
    );
    const createSnapshotBody = (await createSnapshot.json()) as {
      data?: { snapshot?: { snapshot_hash?: string } };
    };
    const snapshotHash = createSnapshotBody.data?.snapshot?.snapshot_hash;
    expect(snapshotHash).toBeTruthy();

    const logs = await logsRoute.GET(
      new NextRequest("http://localhost/api/logs?q=plan.run.complete", {
        headers: authHeaders("tenant-a"),
      }),
    );
    const logsBody = (await logs.json()) as {
      data?: { data?: Array<{ event_type: string }> };
    };
    expect(
      logsBody.data?.data?.some(
        (entry) => entry.event_type === "plan.run.complete",
      ),
    ).toBe(true);

    const missingConfirmation = await snapshotsRoute.POST(
      new NextRequest("http://localhost/api/snapshots", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "snapshot-restore-unsafe",
        },
        body: JSON.stringify({
          action: "restore",
          snapshot_hash: snapshotHash,
        }),
      }),
    );
    expect(missingConfirmation.status).toBe(409);

    const restore = await snapshotsRoute.POST(
      new NextRequest("http://localhost/api/snapshots", {
        method: "POST",
        headers: {
          ...authHeaders("tenant-a"),
          "idempotency-key": "snapshot-restore-safe",
        },
        body: JSON.stringify({
          action: "restore",
          snapshot_hash: snapshotHash,
          force: true,
        }),
      }),
    );
    expect(restore.status).toBe(200);
  });
});
