/**
 * Production truth closure tests.
 *
 * Covers:
 * - Durable queue crash/restart recovery (stale lease recovery)
 * - Duplicate execution prevention (lease conflict)
 * - Dead-letter / terminal failure visibility (max attempts → failed)
 * - Authz matrix for admin/operator/viewer boundaries
 * - Membership lifecycle truth (no invite flow exists)
 * - Readiness contract — no overclaim of background execution
 * - Execution taxonomy exported from deployment contract
 * - Job API responses include execution_class metadata
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const originalEnv = { ...process.env };

async function makeRequest(url: string, init: { method?: string; tenantId: string; actorId: string; idempotencyKey?: string; body?: string }) {
  const { createInternalAuthProof, INTERNAL_AUTH_PROOF_HEADER } = await import('../src/lib/internal-auth-proof');
  const proof = await createInternalAuthProof({
    tenantId: init.tenantId,
    actorId: init.actorId,
    method: init.method ?? 'GET',
    pathname: new URL(url).pathname,
  });

  return new NextRequest(url, {
    method: init.method,
    headers: {
      'x-tenant-id': init.tenantId,
      'x-user-id': init.actorId,
      'content-type': 'application/json',
      ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
      ...(proof ? { [INTERNAL_AUTH_PROOF_HEADER]: proof } : {}),
    },
    body: init.body,
  });
}

function setupEnv(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-truth-closure-'));
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    REQUIEM_AUTH_SECRET: 'test-secret',
    REQUIEM_CONTROL_PLANE_DIR: dir,
    REQUIEM_PLAN_JOB_LEASE_MS: '50', // very short lease for testing
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

async function bootstrapOrgWithPlan(tenantId: string, adminId: string) {
  const orgRoute = await import('../src/app/api/tenants/organizations/route');
  const plansRoute = await import('../src/app/api/plans/route');

  // Create org
  await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
    method: 'POST', tenantId, actorId: adminId,
    idempotencyKey: `bootstrap-org-${Date.now()}`,
    body: JSON.stringify({ action: 'create', org_id: 'org-test', name: 'Test Org' }),
  }));

  // Add a plan
  const addPlan = await plansRoute.POST(await makeRequest('http://localhost/api/plans', {
    method: 'POST', tenantId, actorId: adminId,
    idempotencyKey: `bootstrap-plan-${Date.now()}`,
    body: JSON.stringify({
      action: 'add',
      plan_id: 'test-plan',
      steps: [{ step_id: 'step-1', kind: 'exec', depends_on: [], config: { command: 'echo', argv: ['ok'] } }],
    }),
  }));
  const planBody = await addPlan.json() as { data?: { plan?: { plan_hash?: string } } };
  return planBody.data?.plan?.plan_hash ?? '';
}

describe('durable queue crash recovery', () => {
  it('recovers stale leases after simulated process loss', async () => {
    setupEnv();
    const jobsRoute = await import('../src/app/api/tenants/jobs/route');
    const planHash = await bootstrapOrgWithPlan('tenant-crash', 'admin-a');

    // Enqueue a job
    const enqueue = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-crash', actorId: 'admin-a',
      idempotencyKey: 'crash-enqueue-1',
      body: JSON.stringify({ action: 'enqueue', org_id: 'org-test', plan_hash: planHash }),
    }));
    expect(enqueue.status).toBe(200);

    // Claim the job directly (simulate worker start)
    const { claimNextPlanJob } = await import('../src/lib/control-plane-store');
    const claimed = await claimNextPlanJob('tenant-crash', 'admin-a', 'dead-worker-1', 'org-test');
    expect(claimed).toBeTruthy();
    expect(claimed!.status).toBe('running');
    expect(claimed!.lease_owner).toBe('dead-worker-1');

    // Simulate process loss by waiting for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Call recover — should reclaim the stale lease
    const recover = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-crash', actorId: 'admin-a',
      idempotencyKey: 'crash-recover-1',
      body: JSON.stringify({ action: 'recover', org_id: 'org-test' }),
    }));
    expect(recover.status).toBe(200);
    const recoverBody = await recover.json() as { data?: { recovered_jobs?: string[] } };
    expect(recoverBody.data?.recovered_jobs?.length).toBeGreaterThan(0);

    // Job should now be processable by a different worker
    const process = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-crash', actorId: 'admin-a',
      idempotencyKey: 'crash-process-1',
      body: JSON.stringify({ action: 'process', org_id: 'org-test', worker_id: 'recovery-worker-1', limit: 1 }),
    }));
    expect(process.status).toBe(200);
    const processBody = await process.json() as { data?: { jobs?: Array<{ status?: string }> } };
    expect(processBody.data?.jobs?.[0]?.status).toBe('completed');
  });

  it('marks jobs as failed after max attempts exhausted', async () => {
    setupEnv();
    const planHash = await bootstrapOrgWithPlan('tenant-deadletter', 'admin-a');
    const { claimNextPlanJob, enqueuePlanJob, recoverStalePlanJobs, listPlanJobs } = await import('../src/lib/control-plane-store');

    // Enqueue with max_attempts=2
    await enqueuePlanJob('tenant-deadletter', 'admin-a', {
      org_id: 'org-test', plan_hash: planHash, max_attempts: 2,
    });

    // Simulate two failed attempts via lease expiry
    for (let i = 0; i < 2; i++) {
      const job = await claimNextPlanJob('tenant-deadletter', 'admin-a', `worker-${i}`, 'org-test');
      if (!job) break;
      await new Promise((resolve) => setTimeout(resolve, 80));
      await recoverStalePlanJobs('tenant-deadletter', 'admin-a', 'org-test');
    }

    // Job should now be in 'failed' state (dead-lettered)
    const jobs = await listPlanJobs('tenant-deadletter', 'admin-a', 'org-test');
    const failedJob = jobs.find((j) => j.status === 'failed');
    expect(failedJob).toBeTruthy();
    expect(failedJob!.last_error_code).toBe('job_lease_expired_max_attempts');
    expect(failedJob!.attempt_count).toBe(2);
  });
});

describe('duplicate execution prevention', () => {
  it('prevents a second worker from stealing an active lease', async () => {
    setupEnv();
    const planHash = await bootstrapOrgWithPlan('tenant-dup', 'admin-a');
    const { claimNextPlanJob, enqueuePlanJob } = await import('../src/lib/control-plane-store');

    await enqueuePlanJob('tenant-dup', 'admin-a', {
      org_id: 'org-test', plan_hash: planHash,
    });

    // Worker A claims the job
    const jobA = await claimNextPlanJob('tenant-dup', 'admin-a', 'worker-a', 'org-test');
    expect(jobA).toBeTruthy();

    // Worker B should get nothing — the job is already leased
    const jobB = await claimNextPlanJob('tenant-dup', 'admin-a', 'worker-b', 'org-test');
    expect(jobB).toBeNull();
  });
});

describe('authz matrix for admin/operator/viewer', () => {
  it('viewer cannot enqueue jobs', async () => {
    setupEnv();
    const orgRoute = await import('../src/app/api/tenants/organizations/route');
    const planHash = await bootstrapOrgWithPlan('tenant-authz', 'admin-a');

    // Add a viewer
    await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-authz', actorId: 'admin-a',
      idempotencyKey: 'authz-viewer-1',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-test', subject: 'viewer-v', role: 'viewer' }),
    }));

    // Viewer tries to enqueue — should fail
    const jobsRoute = await import('../src/app/api/tenants/jobs/route');
    const enqueue = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-authz', actorId: 'viewer-v',
      idempotencyKey: 'authz-enqueue-1',
      body: JSON.stringify({ action: 'enqueue', org_id: 'org-test', plan_hash: planHash }),
    }));
    expect(enqueue.status).toBeGreaterThanOrEqual(400);
  });

  it('viewer cannot set member roles', async () => {
    setupEnv();
    await bootstrapOrgWithPlan('tenant-authz2', 'admin-a');
    const orgRoute = await import('../src/app/api/tenants/organizations/route');

    // Add a viewer
    await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-authz2', actorId: 'admin-a',
      idempotencyKey: 'authz2-viewer-1',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-test', subject: 'viewer-v', role: 'viewer' }),
    }));

    // Viewer tries to set roles — should fail
    const result = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-authz2', actorId: 'viewer-v',
      idempotencyKey: 'authz2-setmember-1',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-test', subject: 'someone', role: 'operator' }),
    }));
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it('operator cannot delete organization', async () => {
    setupEnv();
    await bootstrapOrgWithPlan('tenant-authz3', 'admin-a');
    const orgRoute = await import('../src/app/api/tenants/organizations/route');

    // Add an operator
    await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-authz3', actorId: 'admin-a',
      idempotencyKey: 'authz3-operator-1',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-test', subject: 'op-o', role: 'operator' }),
    }));

    // Operator tries to delete org — should fail (requires admin)
    const result = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-authz3', actorId: 'op-o',
      idempotencyKey: 'authz3-delete-1',
      body: JSON.stringify({ action: 'delete', org_id: 'org-test' }),
    }));
    expect(result.status).toBeGreaterThanOrEqual(400);
  });

  it('non-member gets denied for all actions', async () => {
    setupEnv();
    await bootstrapOrgWithPlan('tenant-authz4', 'admin-a');
    const adminRoute = await import('../src/app/api/tenants/admin/validate/route');

    const validate = await adminRoute.GET(await makeRequest('http://localhost/api/tenants/admin/validate?org_id=org-test&minimum_role=viewer', {
      tenantId: 'tenant-authz4', actorId: 'stranger',
    }));
    const body = await validate.json() as { data?: { allow?: boolean; reasons?: string[] } };
    expect(body.data?.allow).toBe(false);
    expect(body.data?.reasons).toContain('actor_is_not_an_org_member');
  });
});

describe('membership lifecycle truth', () => {
  it('no invite endpoint exists — membership is set directly via set_member_role', async () => {
    setupEnv();
    const orgRoute = await import('../src/app/api/tenants/organizations/route');

    // Create org
    const create = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-member', actorId: 'admin-a',
      idempotencyKey: 'member-create-1',
      body: JSON.stringify({ action: 'create', org_id: 'org-member', name: 'Member Test Org' }),
    }));
    expect(create.status).toBe(200);

    // Directly set member role — this is the only supported membership path
    const set = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-member', actorId: 'admin-a',
      idempotencyKey: 'member-set-1',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-member', subject: 'bob', role: 'operator' }),
    }));
    expect(set.status).toBe(200);

    // Verify no invite action exists on the schema
    const invalidInvite = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-member', actorId: 'admin-a',
      idempotencyKey: 'member-invite-1',
      body: JSON.stringify({ action: 'invite', org_id: 'org-member', email: 'bob@example.com' }),
    }));
    // Should fail with validation error since 'invite' is not a valid action
    expect(invalidInvite.status).toBeGreaterThanOrEqual(400);
  });
});

describe('readiness contract — no overclaim', () => {
  it('readiness reports durable_queue_available but autonomous_worker_active=false', async () => {
    const controlPlaneDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-readiness-truth-'));
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      REQUIEM_AUTH_SECRET: 'test-secret',
      REQUIEM_CONTROL_PLANE_DIR: controlPlaneDir,
    };

    const { GET } = await import('../src/app/api/readiness/route');
    const response = await GET(new NextRequest('http://localhost/api/readiness'));
    const body = await response.json() as {
      ok: boolean;
      deployment_contract: {
        durable_queue_available: boolean;
        autonomous_worker_active: boolean;
        supported_durability_classes: string[];
        membership_lifecycle: {
          supported: string[];
          not_implemented: string[];
        };
      };
      checks: Array<{ name: string; ok: boolean; detail: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.deployment_contract.durable_queue_available).toBe(true);
    expect(body.deployment_contract.autonomous_worker_active).toBe(false);
    expect(body.deployment_contract.supported_durability_classes).toContain('durable-queued');
    expect(body.deployment_contract.supported_durability_classes).toContain('request-bound');
    expect(body.deployment_contract.membership_lifecycle.supported).toContain('create organization (admin becomes first member)');
    expect(body.deployment_contract.membership_lifecycle.supported).toContain('invite user by email with durable token and expiry');

    // Verify the durable_queue_health check exists and is truthful
    const queueCheck = body.checks.find((c) => c.name === 'durable_queue_health');
    expect(queueCheck).toBeTruthy();
    expect(queueCheck!.detail).toContain('Durable plan-job queue is available');

    fs.rmSync(controlPlaneDir, { recursive: true, force: true });
  });
});

describe('execution taxonomy', () => {
  it('exports a canonical execution taxonomy from deployment contract', async () => {
    const { EXECUTION_TAXONOMY, MEMBERSHIP_LIFECYCLE } = await import('../src/lib/deployment-contract');

    // Verify all required entries exist
    expect(EXECUTION_TAXONOMY.length).toBeGreaterThanOrEqual(4);

    // Verify durable-queued path exists and is truthful
    const durableEntry = EXECUTION_TAXONOMY.find((e) => e.durability_class === 'durable-queued');
    expect(durableEntry).toBeTruthy();
    expect(durableEntry!.survives_process_loss).toBe(true);
    expect(durableEntry!.duplicate_safe).toBe(true);
    expect(durableEntry!.operator_visible_recovery).toBe(true);

    // Verify request-bound path exists
    const requestBound = EXECUTION_TAXONOMY.find((e) => e.durability_class === 'request-bound');
    expect(requestBound).toBeTruthy();
    expect(requestBound!.survives_process_loss).toBe(false);

    // Verify membership lifecycle truth
    expect(MEMBERSHIP_LIFECYCLE.supported.length).toBeGreaterThan(0);
    expect(MEMBERSHIP_LIFECYCLE.not_implemented.length).toBeGreaterThan(0);
    expect(MEMBERSHIP_LIFECYCLE.supported).toContain('invite user by email with durable token and expiry');
    expect(MEMBERSHIP_LIFECYCLE.not_implemented).toContain('billing/payment integration for seat accounting');
  });
});

describe('job API execution_class metadata', () => {
  it('job list response includes execution_class with durability truth', async () => {
    setupEnv();
    const planHash = await bootstrapOrgWithPlan('tenant-jobmeta', 'admin-a');
    const jobsRoute = await import('../src/app/api/tenants/jobs/route');

    // Enqueue a job first
    await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-jobmeta', actorId: 'admin-a',
      idempotencyKey: 'jobmeta-enqueue-1',
      body: JSON.stringify({ action: 'enqueue', org_id: 'org-test', plan_hash: planHash }),
    }));

    // List jobs
    const list = await jobsRoute.GET(await makeRequest('http://localhost/api/tenants/jobs?org_id=org-test', {
      tenantId: 'tenant-jobmeta', actorId: 'admin-a',
    }));
    const listBody = await list.json() as {
      data?: {
        execution_class?: {
          durability_class: string;
          survives_process_loss: boolean;
          autonomous_worker: boolean;
          recovery_mechanism: string;
        };
      };
    };

    expect(listBody.data?.execution_class).toBeTruthy();
    expect(listBody.data!.execution_class!.durability_class).toBe('durable-queued');
    expect(listBody.data!.execution_class!.survives_process_loss).toBe(true);
    expect(listBody.data!.execution_class!.autonomous_worker).toBe(false);
    expect(listBody.data!.execution_class!.recovery_mechanism).toContain('no autonomous background worker');
  });
});
