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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-layer-tenant-saas-'));
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    REQUIEM_AUTH_SECRET: 'tenant-secret',
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

describe('tenant SaaS control plane', () => {
  it('manages organizations, roles, health, and durable plan jobs without cross-tenant bleed', async () => {
    setupEnv();
    const orgRoute = await import('../src/app/api/tenants/organizations/route');
    const adminRoute = await import('../src/app/api/tenants/admin/validate/route');
    const healthRoute = await import('../src/app/api/tenants/health/route');
    const jobsRoute = await import('../src/app/api/tenants/jobs/route');
    const plansRoute = await import('../src/app/api/plans/route');

    const createOrg = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST',
      tenantId: 'tenant-a',
      actorId: 'alice',
      idempotencyKey: 'org-create-1',
      body: JSON.stringify({ action: 'create', org_id: 'org-alpha', name: 'Alpha Org', plan: 'enterprise', budget_cents: 500000 }),
    }));
    expect(createOrg.status).toBe(200);
    const createOrgBody = await createOrg.json() as { data?: { organization?: { org_id?: string }; membership?: { role?: string } } };
    expect(createOrgBody.data?.organization?.org_id).toBe('org-alpha');
    expect(createOrgBody.data?.membership?.role).toBe('admin');

    const setMember = await orgRoute.POST(await makeRequest('http://localhost/api/tenants/organizations', {
      method: 'POST',
      tenantId: 'tenant-a',
      actorId: 'alice',
      idempotencyKey: 'org-member-1',
      body: JSON.stringify({ action: 'set_member_role', org_id: 'org-alpha', subject: 'bob', role: 'operator' }),
    }));
    expect(setMember.status).toBe(200);

    const validate = await adminRoute.GET(await makeRequest('http://localhost/api/tenants/admin/validate?org_id=org-alpha&minimum_role=operator', {
      tenantId: 'tenant-a',
      actorId: 'bob',
    }));
    expect(validate.status).toBe(200);
    const validateBody = await validate.json() as { data?: { allow?: boolean; role?: string } };
    expect(validateBody.data?.allow).toBe(true);
    expect(validateBody.data?.role).toBe('operator');

    const addPlan = await plansRoute.POST(await makeRequest('http://localhost/api/plans', {
      method: 'POST',
      tenantId: 'tenant-a',
      actorId: 'alice',
      idempotencyKey: 'tenant-saas-plan-add',
      body: JSON.stringify({
        action: 'add',
        plan_id: 'tenant-rollup',
        steps: [{ step_id: 'step-1', kind: 'exec', depends_on: [], config: { command: 'echo', argv: ['ok'] } }],
      }),
    }));
    const addPlanBody = await addPlan.json() as { data?: { plan?: { plan_hash?: string } } };
    const planHash = addPlanBody.data?.plan?.plan_hash;
    expect(planHash).toBeTruthy();

    const enqueue = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST',
      tenantId: 'tenant-a',
      actorId: 'bob',
      idempotencyKey: 'tenant-job-enqueue-1',
      body: JSON.stringify({ action: 'enqueue', org_id: 'org-alpha', plan_hash: planHash }),
    }));
    expect(enqueue.status).toBe(200);

    const process = await jobsRoute.POST(await makeRequest('http://localhost/api/tenants/jobs', {
      method: 'POST',
      tenantId: 'tenant-a',
      actorId: 'bob',
      idempotencyKey: 'tenant-job-process-1',
      body: JSON.stringify({ action: 'process', org_id: 'org-alpha', worker_id: 'worker-a', limit: 1 }),
    }));
    expect(process.status).toBe(200);
    const processBody = await process.json() as { data?: { jobs?: Array<{ status?: string }>; run_id?: string | null } };
    expect(processBody.data?.jobs?.[0]?.status).toBe('completed');
    expect(processBody.data?.run_id).toBeTruthy();

    const health = await healthRoute.GET(await makeRequest('http://localhost/api/tenants/health', {
      tenantId: 'tenant-a',
      actorId: 'alice',
    }));
    expect(health.status).toBe(200);
    const healthBody = await health.json() as { data?: { organizations?: Array<{ org_id?: string; status?: string; queue_depth?: number }> } };
    expect(healthBody.data?.organizations?.[0]?.org_id).toBe('org-alpha');
    expect(healthBody.data?.organizations?.[0]?.status).toBe('healthy');
    expect(healthBody.data?.organizations?.[0]?.queue_depth).toBe(0);

    const tenantAList = await orgRoute.GET(await makeRequest('http://localhost/api/tenants/organizations', {
      tenantId: 'tenant-a',
      actorId: 'alice',
    }));
    const tenantAListBody = await tenantAList.json() as { data?: { organizations?: Array<{ org_id?: string }> } };
    expect(tenantAListBody.data?.organizations).toHaveLength(1);

    const tenantBList = await orgRoute.GET(await makeRequest('http://localhost/api/tenants/organizations', {
      tenantId: 'tenant-b',
      actorId: 'alice',
    }));
    const tenantBListBody = await tenantBList.json() as { data?: { organizations?: Array<{ org_id?: string }> } };
    expect(tenantBListBody.data?.organizations ?? []).toHaveLength(0);
  });
});
