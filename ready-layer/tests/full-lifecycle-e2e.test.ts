/**
 * Full end-to-end lifecycle tests — no mocks, no stubs, all real.
 *
 * Tests:
 * 1. Autonomous background worker starts, processes jobs, stops
 * 2. Invite → accept → role assignment → revoke lifecycle
 * 3. Member removal without org deletion
 * 4. Seat visibility / member listing
 * 5. Invite expiry and already-used handling
 * 6. Stub routes now return real data
 * 7. Worker + invite + job queue integration
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-e2e-'));
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    REQUIEM_AUTH_SECRET: 'test-secret',
    REQUIEM_CONTROL_PLANE_DIR: dir,
    REQUIEM_PLAN_JOB_LEASE_MS: '50',
    REQUIEM_WORKER_POLL_MS: '50',
    REQUIEM_INVITE_EXPIRY_MS: '500',
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

async function bootstrapOrg(tenantId: string, adminId: string) {
  const orgRoute = await import('../src/app/api/tenants/organizations/route');
  const plansRoute = await import('../src/app/api/plans/route');

  await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
    method: 'POST', tenantId, actorId: adminId,
    idempotencyKey: `bootstrap-org-${Date.now()}`,
    body: JSON.stringify({ action: 'create', org_id: 'org-e2e', name: 'E2E Org' }),
  }));

  const addPlan = await plansRoute.POST(await makeRequest('http://localhost/api/plans', {
    method: 'POST', tenantId, actorId: adminId,
    idempotencyKey: `bootstrap-plan-${Date.now()}`,
    body: JSON.stringify({
      action: 'add', plan_id: 'e2e-plan',
      steps: [{ step_id: 'step-1', kind: 'exec', depends_on: [], config: { command: 'echo', argv: ['ok'] } }],
    }),
  }));
  const planBody = await addPlan.json() as { data?: { plan?: { plan_hash?: string } } };
  return planBody.data?.plan?.plan_hash ?? '';
}

describe('autonomous background worker', () => {
  it('starts, processes queued jobs automatically, and stops', async () => {
    setupEnv();
    const planHash = await bootstrapOrg('tenant-worker', 'admin-a');
    const jobsRoute = await import('../src/app/api/tenants/jobs/route');
    const { startWorkerLoop } = await import('../src/lib/control-plane-store');

    // Enqueue a job
    await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-worker', actorId: 'admin-a',
      idempotencyKey: 'worker-enqueue-1',
      body: JSON.stringify({ action: 'enqueue', org_id: 'org-e2e', plan_hash: planHash }),
    }));

    // Start autonomous worker
    const handle = startWorkerLoop({
      tenantId: 'tenant-worker',
      actorId: 'admin-a',
      workerId: 'auto-worker-1',
      orgId: 'org-e2e',
      pollIntervalMs: 30,
      batchSize: 5,
    });

    // Wait for worker to process
    const cycle = await handle.waitForCycle();
    expect(cycle.jobs_processed).toBeGreaterThanOrEqual(1);
    expect(cycle.errors).toHaveLength(0);

    // Verify job was completed
    const list = await jobsRoute.GET(await makeRequest('http://localhost/api/tenants/jobs?org_id=org-e2e', {
      tenantId: 'tenant-worker', actorId: 'admin-a',
    }));
    const listBody = await list.json() as { data?: { jobs?: Array<{ status?: string }> } };
    expect(listBody.data?.jobs?.every((j) => j.status === 'completed')).toBe(true);

    // Stop worker
    handle.stop();
    expect(handle.getCycles().length).toBeGreaterThanOrEqual(1);
  });

  it('worker recovers stale leases from dead workers automatically', async () => {
    setupEnv();
    const planHash = await bootstrapOrg('tenant-worker2', 'admin-a');
    const { enqueuePlanJob, claimNextPlanJob, startWorkerLoop } = await import('../src/lib/control-plane-store');

    // Enqueue and claim with a dead worker
    await enqueuePlanJob('tenant-worker2', 'admin-a', {
      org_id: 'org-e2e', plan_hash: planHash,
    });
    await claimNextPlanJob('tenant-worker2', 'admin-a', 'dead-worker', 'org-e2e');

    // Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Start a new worker — should recover and reprocess
    const handle = startWorkerLoop({
      tenantId: 'tenant-worker2',
      actorId: 'admin-a',
      workerId: 'recovery-worker',
      orgId: 'org-e2e',
      pollIntervalMs: 30,
    });

    const cycle = await handle.waitForCycle();
    expect(cycle.jobs_recovered + cycle.jobs_processed).toBeGreaterThanOrEqual(1);

    handle.stop();
  });
});

describe('invite lifecycle', () => {
  it('full invite → accept → membership flow', async () => {
    setupEnv();
    await bootstrapOrg('tenant-invite', 'admin-a');
    const inviteRoute = await import('../src/app/api/tenants/invites/route');

    // Admin creates invite
    const create = await inviteRoute.POST(await makeRequest('http://localhost/api/tenants/invites', {
      method: 'POST', tenantId: 'tenant-invite', actorId: 'admin-a',
      idempotencyKey: 'invite-create-1',
      body: JSON.stringify({ action: 'create', org_id: 'org-e2e', email: 'bob@example.com', role: 'operator' }),
    }));
    expect(create.status).toBe(200);
    const createBody = await create.json() as { data?: { invite?: { invite_id?: string; status?: string; email?: string }; token?: string } };
    expect(createBody.data?.invite?.status).toBe('pending');
    expect(createBody.data?.invite?.email).toBe('bob@example.com');
    expect(createBody.data?.token).toBeTruthy();
    const token = createBody.data!.token!;
    const inviteId = createBody.data!.invite!.invite_id!;

    // List invites
    const list = await inviteRoute.GET(await makeRequest('http://localhost/api/tenants/invites?org_id=org-e2e', {
      tenantId: 'tenant-invite', actorId: 'admin-a',
    }));
    const listBody = await list.json() as { data?: { invites?: Array<{ invite_id?: string }> } };
    expect(listBody.data?.invites?.length).toBe(1);

    // Bob accepts invite
    const accept = await inviteRoute.POST(await makeRequest('http://localhost/api/tenants/invites', {
      method: 'POST', tenantId: 'tenant-invite', actorId: 'bob',
      idempotencyKey: 'invite-accept-1',
      body: JSON.stringify({ action: 'accept', token }),
    }));
    expect(accept.status).toBe(200);
    const acceptBody = await accept.json() as { data?: { invite?: { status?: string }; membership?: { role?: string; actor_id?: string } } };
    expect(acceptBody.data?.invite?.status).toBe('accepted');
    expect(acceptBody.data?.membership?.role).toBe('operator');
    expect(acceptBody.data?.membership?.actor_id).toBe('bob');
  });

  it('rejects already-used invite token', async () => {
    setupEnv();
    await bootstrapOrg('tenant-invite2', 'admin-a');
    const { createInvite, acceptInvite } = await import('../src/lib/control-plane-store');

    const { token } = await createInvite('tenant-invite2', 'admin-a', {
      org_id: 'org-e2e', email: 'charlie@example.com', role: 'viewer',
    });

    // First accept succeeds
    await acceptInvite('tenant-invite2', 'charlie', token);

    // Second accept fails
    await expect(acceptInvite('tenant-invite2', 'dave', token)).rejects.toThrow(/already been accepted/);
  });

  it('rejects expired invite', async () => {
    setupEnv();
    await bootstrapOrg('tenant-invite3', 'admin-a');
    const { createInvite, acceptInvite } = await import('../src/lib/control-plane-store');

    const { token } = await createInvite('tenant-invite3', 'admin-a', {
      org_id: 'org-e2e', email: 'expired@example.com', role: 'viewer',
    });

    // Wait for expiry (REQUIEM_INVITE_EXPIRY_MS=500)
    await new Promise((resolve) => setTimeout(resolve, 600));

    await expect(acceptInvite('tenant-invite3', 'someone', token)).rejects.toThrow(/expired/);
  });

  it('admin can revoke pending invite', async () => {
    setupEnv();
    await bootstrapOrg('tenant-invite4', 'admin-a');
    const { createInvite, revokeInvite, acceptInvite } = await import('../src/lib/control-plane-store');

    const { invite, token } = await createInvite('tenant-invite4', 'admin-a', {
      org_id: 'org-e2e', email: 'revoked@example.com', role: 'operator',
    });

    // Revoke
    const revoked = await revokeInvite('tenant-invite4', 'admin-a', invite.invite_id);
    expect(revoked.status).toBe('revoked');

    // Cannot accept revoked invite
    await expect(acceptInvite('tenant-invite4', 'someone', token)).rejects.toThrow(/revoked/);
  });

  it('duplicate pending invite for same email is rejected', async () => {
    setupEnv();
    await bootstrapOrg('tenant-invite5', 'admin-a');
    const { createInvite } = await import('../src/lib/control-plane-store');

    await createInvite('tenant-invite5', 'admin-a', {
      org_id: 'org-e2e', email: 'dup@example.com', role: 'viewer',
    });

    await expect(createInvite('tenant-invite5', 'admin-a', {
      org_id: 'org-e2e', email: 'dup@example.com', role: 'operator',
    })).rejects.toThrow(/pending invite already exists/);
  });
});

describe('member removal', () => {
  it('admin can remove a member without deleting the org', async () => {
    setupEnv();
    await bootstrapOrg('tenant-member', 'admin-a');
    const membersRoute = await import('../src/app/api/tenants/members/route');
    const orgRoute = await import('../src/app/api/tenants/organizations/route');

    // Add bob as operator
    await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-member', actorId: 'admin-a',
      idempotencyKey: 'member-add-bob',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-e2e', subject: 'bob', role: 'operator' }),
    }));

    // List members — should have 2
    const listBefore = await membersRoute.GET(await makeRequest('http://localhost/api/tenants/members?org_id=org-e2e', {
      tenantId: 'tenant-member', actorId: 'admin-a',
    }));
    const beforeBody = await listBefore.json() as { data?: { members?: Array<unknown>; seat_count?: number } };
    expect(beforeBody.data?.seat_count).toBe(2);

    // Remove bob
    const remove = await membersRoute.POST(await makeRequest('http://localhost/api/tenants/members', {
      method: 'POST', tenantId: 'tenant-member', actorId: 'admin-a',
      idempotencyKey: 'member-remove-bob',
      body: JSON.stringify({ action: 'remove', org_id: 'org-e2e', subject: 'bob' }),
    }));
    expect(remove.status).toBe(200);

    // List members — should have 1
    const listAfter = await membersRoute.GET(await makeRequest('http://localhost/api/tenants/members?org_id=org-e2e', {
      tenantId: 'tenant-member', actorId: 'admin-a',
    }));
    const afterBody = await listAfter.json() as { data?: { members?: Array<unknown>; seat_count?: number } };
    expect(afterBody.data?.seat_count).toBe(1);

    // Org still exists
    const orgs = await orgRoute.GET(await makeRequest('http://localhost/api/tenants/organizations', {
      tenantId: 'tenant-member', actorId: 'admin-a',
    }));
    const orgsBody = await orgs.json() as { data?: { organizations?: Array<{ org_id?: string }> } };
    expect(orgsBody.data?.organizations?.length).toBe(1);
  });

  it('admin cannot remove themselves', async () => {
    setupEnv();
    await bootstrapOrg('tenant-member2', 'admin-a');
    const { removeOrganizationMember } = await import('../src/lib/control-plane-store');

    await expect(removeOrganizationMember('tenant-member2', 'admin-a', 'org-e2e', 'admin-a'))
      .rejects.toThrow(/cannot remove themselves/);
  });

  it('change member role with admin enforcement', async () => {
    setupEnv();
    await bootstrapOrg('tenant-member3', 'admin-a');
    const membersRoute = await import('../src/app/api/tenants/members/route');
    const orgRoute = await import('../src/app/api/tenants/organizations/route');

    // Add bob as viewer
    await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST', tenantId: 'tenant-member3', actorId: 'admin-a',
      idempotencyKey: 'member3-add-bob',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-e2e', subject: 'bob', role: 'viewer' }),
    }));

    // Change role to operator via members API
    const change = await membersRoute.POST(await makeRequest('http://localhost/api/tenants/members', {
      method: 'POST', tenantId: 'tenant-member3', actorId: 'admin-a',
      idempotencyKey: 'member3-change-bob',
      body: JSON.stringify({ action: 'change_role', org_id: 'org-e2e', subject: 'bob', role: 'operator' }),
    }));
    expect(change.status).toBe(200);
    const changeBody = await change.json() as { data?: { membership?: { role?: string } } };
    expect(changeBody.data?.membership?.role).toBe('operator');
  });
});

describe('stub routes replaced with real data', () => {
  it('/api/tenants/isolation returns real control-plane data', async () => {
    setupEnv();
    await bootstrapOrg('tenant-iso', 'admin-a');
    const isoRoute = await import('../src/app/api/tenants/isolation/route');

    const response = await isoRoute.GET(await makeRequest('http://localhost/api/tenants/isolation', {
      tenantId: 'tenant-iso', actorId: 'admin-a',
    }));
    const body = await response.json() as { data?: { source?: string; organizations?: number } };
    expect(body.data?.source).toBe('control-plane');
    expect(body.data?.organizations).toBe(1);
  });

  it('/api/replay/lab returns real run data', async () => {
    setupEnv();
    await bootstrapOrg('tenant-replay', 'admin-a');

    // Add a plan and run it to create real run data
    const { addPlan, runPlan } = await import('../src/lib/control-plane-store');
    const plan = await addPlan('tenant-replay', 'admin-a', {
      plan_id: 'replay-test-plan',
      steps: [{ tool: 'echo', args: { msg: 'replay-test' } }],
    });
    await runPlan('tenant-replay', 'admin-a', plan.plan_hash);

    const labRoute = await import('../src/app/api/replay/lab/route');
    const response = await labRoute.GET(await makeRequest('http://localhost/api/replay/lab', {
      tenantId: 'tenant-replay', actorId: 'admin-a',
    }));
    const body = await response.json() as { data?: { source?: string; runs?: Array<unknown> } };
    expect(body.data?.source).toBe('control-plane');
    expect(body.data?.runs?.length).toBeGreaterThanOrEqual(1);
  });

  it('/api/agents returns real control-plane agent data', async () => {
    setupEnv();
    await bootstrapOrg('tenant-agents', 'admin-a');
    const agentsRoute = await import('../src/app/api/agents/route');

    const response = await agentsRoute.GET(await makeRequest('http://localhost/api/agents', {
      tenantId: 'tenant-agents', actorId: 'admin-a',
    }));
    const body = await response.json() as { data?: { agents?: Array<{ source?: string; agent_id?: string }> } };
    expect(body.data?.agents?.[0]?.source).toBe('control-plane');
    expect(body.data?.agents?.[0]?.agent_id).toBe('control-plane-executor');
  });
});

describe('worker + invite + job queue integration', () => {
  it('invited member can enqueue jobs processed by autonomous worker', async () => {
    setupEnv();
    const planHash = await bootstrapOrg('tenant-full', 'admin-a');
    const { createInvite, acceptInvite, startWorkerLoop } = await import('../src/lib/control-plane-store');
    const jobsRoute = await import('../src/app/api/tenants/jobs/route');

    // Invite bob as operator
    const { token } = await createInvite('tenant-full', 'admin-a', {
      org_id: 'org-e2e', email: 'bob@example.com', role: 'operator',
    });
    await acceptInvite('tenant-full', 'bob', token);

    // Bob enqueues a job
    const enqueue = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST', tenantId: 'tenant-full', actorId: 'bob',
      idempotencyKey: 'full-enqueue-1',
      body: JSON.stringify({ action: 'enqueue', org_id: 'org-e2e', plan_hash: planHash }),
    }));
    expect(enqueue.status).toBe(200);

    // Start worker to process
    const handle = startWorkerLoop({
      tenantId: 'tenant-full',
      actorId: 'admin-a',
      workerId: 'full-worker',
      orgId: 'org-e2e',
      pollIntervalMs: 30,
    });

    const cycle = await handle.waitForCycle();
    expect(cycle.jobs_processed).toBeGreaterThanOrEqual(1);
    handle.stop();

    // Verify job completed
    const list = await jobsRoute.GET(await makeRequest('http://localhost/api/tenants/jobs?org_id=org-e2e', {
      tenantId: 'tenant-full', actorId: 'bob',
    }));
    const listBody = await list.json() as { data?: { jobs?: Array<{ status?: string }> } };
    expect(listBody.data?.jobs?.every((j) => j.status === 'completed')).toBe(true);
  });
});
