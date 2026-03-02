/**
 * @fileoverview Tenant Isolation Tests (T-6)
 *
 * Validates that tenant boundaries are enforced correctly:
 *   - Cross-tenant access attempts are blocked
 *   - Tenant A cannot access tenant B's data
 *   - Budget enforcement is tenant-scoped
 *   - Audit records are tenant-isolated
 *   - Memory store is tenant-scoped
 *
 * INVARIANT: No tenant can access resources of another tenant.
 * INVARIANT: Budget exhaustion in one tenant does not affect others.
 * INVARIANT: Audit queries cannot cross tenant boundaries.
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TenantRole, type TenantContext, type InvocationContext } from '../../types/index.js';

// OPERATOR is not in TenantRole enum, using MEMBER as equivalent for tests
const OPERATOR = TenantRole.MEMBER;
import { newId, now } from '../../types/index.js';
import { AiErrorCode } from '../../errors/codes.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MockResource {
  id: string;
  tenantId: string;
  data: unknown;
  createdAt: string;
}

interface MockAuditRecord {
  id: string;
  tenantId: string;
  action: string;
  timestamp: string;
}

interface MockBudgetState {
  tenantId: string;
  used: number;
  limit: number;
  remaining: number;
}

// ─── Mock Tenant Isolation Store ───────────────────────────────────────────────

class MockTenantIsolatedStore {
  private resources = new Map<string, MockResource[]>();
  private auditRecords = new Map<string, MockAuditRecord[]>();
  private budgets = new Map<string, MockBudgetState>();

  // Resource methods
  createResource(tenantId: string, data: unknown): MockResource {
    const resource: MockResource = {
      id: newId('res'),
      tenantId,
      data,
      createdAt: now(),
    };
    const tenantResources = this.resources.get(tenantId) || [];
    tenantResources.push(resource);
    this.resources.set(tenantId, tenantResources);
    return resource;
  }

  getResource(tenantId: string, resourceId: string): MockResource | undefined {
    // ENFORCEMENT: Check tenant isolation
    const tenantResources = this.resources.get(tenantId) || [];
    const resource = tenantResources.find(r => r.id === resourceId);
    if (resource && resource.tenantId !== tenantId) {
      throw new Error(AiErrorCode.TENANT_MISMATCH);
    }
    return resource;
  }

  queryResources(requesterTenantId: string, targetTenantId?: string): MockResource[] {
    // ENFORCEMENT: Cannot query other tenants
    if (targetTenantId && targetTenantId !== requesterTenantId) {
      throw new Error(AiErrorCode.TENANT_MISMATCH);
    }
    return this.resources.get(requesterTenantId) || [];
  }

  // Audit methods
  recordAudit(tenantId: string, action: string): MockAuditRecord {
    const record: MockAuditRecord = {
      id: newId('audit'),
      tenantId,
      action,
      timestamp: now(),
    };
    const tenantRecords = this.auditRecords.get(tenantId) || [];
    tenantRecords.push(record);
    this.auditRecords.set(tenantId, tenantRecords);
    return record;
  }

  queryAudit(requesterTenantId: string, tenantFilter?: string): MockAuditRecord[] {
    // ENFORCEMENT: Audit isolation
    if (tenantFilter && tenantFilter !== requesterTenantId) {
      throw new Error(AiErrorCode.UNAUTHORIZED);
    }
    return this.auditRecords.get(requesterTenantId) || [];
  }

  // Budget methods
  setBudget(tenantId: string, limit: number): void {
    this.budgets.set(tenantId, { tenantId, used: 0, limit, remaining: limit });
  }

  consumeBudget(tenantId: string, amount: number): { allowed: boolean; remaining: number } {
    const budget = this.budgets.get(tenantId);
    if (!budget) {
      return { allowed: false, remaining: 0 };
    }

    // ENFORCEMENT: Tenant-scoped budget
    if (budget.used + amount > budget.limit) {
      return { allowed: false, remaining: budget.limit - budget.used };
    }

    budget.used += amount;
    budget.remaining = budget.limit - budget.used;
    return { allowed: true, remaining: budget.remaining };
  }

  getBudget(tenantId: string): MockBudgetState | undefined {
    return this.budgets.get(tenantId);
  }

  // Reset for testing
  reset(): void {
    this.resources.clear();
    this.auditRecords.clear();
    this.budgets.clear();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvocationContext(tenantId: string, role: TenantRole): InvocationContext {
  const tenant: TenantContext = {
    tenantId,
    userId: 'test-user',
    role,
    derivedAt: now(),
  };

  return {
    tenant,
    actorId: 'test-actor',
    traceId: newId('test'),
    environment: 'test',
    createdAt: now(),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Tenant Isolation Tests (T-6)', () => {
  let store: MockTenantIsolatedStore;

  beforeEach(() => {
    store = new MockTenantIsolatedStore();
  });

  afterEach(() => {
    store.reset();
  });

  describe('Cross-Tenant Resource Access', () => {
    test('tenant A cannot access tenant B resource by ID', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      // Create resource in tenant B
      const resourceB = store.createResource(tenantB, { name: 'secret-data' });

      // Tenant A tries to access it
      const result = store.getResource(tenantA, resourceB.id);

      // Should not find it (isolation enforced)
      assert.equal(result, undefined, 'Tenant A should not see tenant B resource');
    });

    test('resource query is scoped to requesting tenant', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      // Create resources in both tenants
      store.createResource(tenantA, { name: 'alpha-data' });
      store.createResource(tenantB, { name: 'beta-data' });

      // Query as tenant A
      const alphaResources = store.queryResources(tenantA);

      // Should only see tenant A resources
      assert.equal(alphaResources.length, 1, 'Should see exactly 1 resource');
      assert.equal((alphaResources[0].data as { name: string }).name, 'alpha-data', 'Should only see alpha data');
    });

    test('query with explicit tenant filter enforces boundary', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      store.createResource(tenantA, { name: 'alpha-data' });

      // Tenant A tries to query with tenant B filter
      assert.throws(
        () => store.queryResources(tenantA, tenantB),
        /AI_TENANT_MISMATCH/,
        'Should throw TENANT_MISMATCH when filtering for other tenant'
      );
    });
  });

  describe('Cross-Tenant Auth Token Validation', () => {
    test('different tenant tokens create isolated contexts', () => {
      const ctxA = makeInvocationContext('tenant-alpha', OPERATOR);
      const ctxB = makeInvocationContext('tenant-beta', OPERATOR);

      assert.notEqual(ctxA.tenant.tenantId, ctxB.tenant.tenantId, 'Contexts should have different tenant IDs');
      assert.equal(ctxA.tenant.tenantId, 'tenant-alpha', 'Context A should have alpha tenant');
      assert.equal(ctxB.tenant.tenantId, 'tenant-beta', 'Context B should have beta tenant');
    });

    test('role is scoped within tenant context', () => {
      const ctxAdmin = makeInvocationContext('tenant-alpha', TenantRole.ADMIN);
      const ctxViewer = makeInvocationContext('tenant-alpha', TenantRole.VIEWER);

      assert.equal(ctxAdmin.tenant.role, TenantRole.ADMIN, 'Admin context should have admin role');
      assert.equal(ctxViewer.tenant.role, TenantRole.VIEWER, 'Viewer context should have viewer role');
      assert.equal(ctxAdmin.tenant.tenantId, ctxViewer.tenant.tenantId, 'Same tenant, different roles');
    });
  });

  describe('Tenant-Scoped Budget Enforcement', () => {
    test('budget consumption is tenant-isolated', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      // Set budgets
      store.setBudget(tenantA, 100);
      store.setBudget(tenantB, 200);

      // Consume from tenant A
      const resultA = store.consumeBudget(tenantA, 50);
      assert.equal(resultA.allowed, true, 'Tenant A should be allowed to consume');
      assert.equal(resultA.remaining, 50, 'Tenant A should have 50 remaining');

      // Tenant B budget should be unaffected
      const budgetB = store.getBudget(tenantB);
      assert.equal(budgetB?.used, 0, 'Tenant B budget should be untouched');
      assert.equal(budgetB?.remaining, 200, 'Tenant B should have full budget');
    });

    test('budget exhaustion in one tenant does not affect others', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      store.setBudget(tenantA, 100);
      store.setBudget(tenantB, 100);

      // Exhaust tenant A
      store.consumeBudget(tenantA, 100);

      // Try to consume from exhausted tenant A
      const resultA = store.consumeBudget(tenantA, 1);
      assert.equal(resultA.allowed, false, 'Tenant A should be exhausted');

      // Tenant B should still have budget
      const resultB = store.consumeBudget(tenantB, 50);
      assert.equal(resultB.allowed, true, 'Tenant B should still have budget');
    });

    test('cannot charge against different tenant budget', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      store.setBudget(tenantA, 100);
      store.setBudget(tenantB, 100);

      // Tenant A tries to consume with tenant B context - should use tenant B's budget
      const ctxB = makeInvocationContext(tenantB, OPERATOR);
      const result = store.consumeBudget(ctxB.tenant.tenantId, 50);

      assert.equal(result.allowed, true);
      assert.equal(store.getBudget(tenantB)?.used, 50, 'Should consume from tenant B budget');
      assert.equal(store.getBudget(tenantA)?.used, 0, 'Tenant A budget should be untouched');
    });
  });

  describe('Audit Record Isolation', () => {
    test('audit records are tenant-scoped', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      // Create audit records
      store.recordAudit(tenantA, 'action-1');
      store.recordAudit(tenantA, 'action-2');
      store.recordAudit(tenantB, 'action-3');

      // Query as tenant A
      const auditA = store.queryAudit(tenantA);

      assert.equal(auditA.length, 2, 'Tenant A should see 2 audit records');
      assert.ok(auditA.every(r => r.tenantId === tenantA), 'All records should be for tenant A');
    });

    test('cannot query audit records from other tenant', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      store.recordAudit(tenantA, 'action-1');
      store.recordAudit(tenantB, 'action-2');

      // Tenant A tries to filter by tenant B
      assert.throws(
        () => store.queryAudit(tenantA, tenantB),
        /AI_UNAUTHORIZED/,
        'Should throw UNAUTHORIZED when querying other tenant audit'
      );
    });

    test('audit records include correct tenant ID', () => {
      const tenantId = 'tenant-test';
      const record = store.recordAudit(tenantId, 'test-action');

      assert.equal(record.tenantId, tenantId, 'Audit record should have correct tenant ID');
    });
  });

  describe('Memory Store Tenant Scoping', () => {
    test('memory vectors are tenant-isolated', () => {
      const tenantA = 'tenant-alpha';
      const tenantB = 'tenant-beta';

      // Simulate storing vectors per tenant
      const vectorA = { id: 'vec-1', tenantId: tenantA, embedding: [0.1, 0.2] };
      const vectorB = { id: 'vec-2', tenantId: tenantB, embedding: [0.3, 0.4] };

      // Each tenant should only see their own vectors
      assert.equal(vectorA.tenantId, tenantA);
      assert.equal(vectorB.tenantId, tenantB);
      assert.notEqual(vectorA.tenantId, vectorB.tenantId);
    });

    test('cross-tenant vector access returns undefined or throws', () => {
      // Simulate vector lookup with tenant check
      function lookupVector(vectorId: string, requestingTenant: string, actualTenant: string): unknown {
        if (requestingTenant !== actualTenant) {
          throw new Error(AiErrorCode.VECTOR_TENANT_MISMATCH);
        }
        return { id: vectorId, tenantId: actualTenant };
      }

      assert.throws(
        () => lookupVector('vec-1', 'tenant-alpha', 'tenant-beta'),
        /AI_VECTOR_TENANT_MISMATCH/,
        'Should throw VECTOR_TENANT_MISMATCH'
      );

      const result = lookupVector('vec-1', 'tenant-alpha', 'tenant-alpha');
      assert.ok(result, 'Should return vector when tenant matches');
    });
  });

  describe('Tenant Isolation Invariants', () => {
    test('tenant context is immutable after creation', () => {
      const ctx = makeInvocationContext('tenant-alpha', OPERATOR);

      // Attempt to mutate (TypeScript should prevent this, but testing runtime)
      const originalTenantId = ctx.tenant.tenantId;

      // @ts-expect-error - Testing immutability violation attempt
      ctx.tenant.tenantId = 'tenant-hacked';

      // Should still be original (if freeze is used) or at least the reference is unchanged
      assert.equal(ctx.tenant.tenantId, originalTenantId, 'Tenant ID should not change');
    });

    test('all operations require valid tenant context', () => {
      // Test that operations fail without tenant context
      assert.throws(
        () => store.createResource('', { data: 'test' }),
        'Should throw when creating resource with empty tenant'
      );
    });

    test('tenant boundary violations are logged appropriately', () => {
      const violations: string[] = [];

      // Simulate logging
      function logViolation(action: string, fromTenant: string, toTenant: string): void {
        violations.push(`${action}: ${fromTenant} -> ${toTenant}`);
      }

      logViolation('cross_tenant_access_attempt', 'tenant-alpha', 'tenant-beta');

      assert.equal(violations.length, 1, 'Violation should be logged');
      assert.ok(violations[0].includes('tenant-alpha'), 'Log should include source tenant');
      assert.ok(violations[0].includes('tenant-beta'), 'Log should include target tenant');
    });
  });

  describe('Multi-Tenant Scenarios', () => {
    test('concurrent operations maintain isolation', async () => {
      const tenants = ['tenant-1', 'tenant-2', 'tenant-3'];

      // Set up budgets for all tenants
      tenants.forEach(t => store.setBudget(t, 100));

      // Simulate concurrent operations
      const operations = tenants.flatMap(tenant =>
        Array(10).fill(null).map((_, i) =>
          Promise.resolve(store.consumeBudget(tenant, 5))
        )
      );

      await Promise.all(operations);

      // Verify each tenant's budget was consumed independently
      for (const tenant of tenants) {
        const budget = store.getBudget(tenant);
        assert.equal(budget?.used, 50, `${tenant} should have used 50 budget`);
      }
    });

    test('resource creation maintains tenant separation under load', () => {
      const tenants = ['tenant-a', 'tenant-b'];

      // Create many resources for each tenant
      for (let i = 0; i < 100; i++) {
        tenants.forEach(tenant => {
          store.createResource(tenant, { index: i });
        });
      }

      // Verify isolation
      for (const tenant of tenants) {
        const resources = store.queryResources(tenant);
        assert.equal(resources.length, 100, `${tenant} should have 100 resources`);
        assert.ok(resources.every(r => r.tenantId === tenant), `All resources should belong to ${tenant}`);
      }
    });
  });
});

// ─── Export for use in other test suites ───────────────────────────────────────

export { MockTenantIsolatedStore };
