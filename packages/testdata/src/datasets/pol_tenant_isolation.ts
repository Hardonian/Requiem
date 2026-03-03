import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, ensureProblemJsonShape, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'POL-TENANT-ISOLATION',
  name: 'Policy Tenant Isolation',
  description: 'Cross-tenant read attempts from tenant A to tenant B',
  version: 1,
  schema_version: '1.0.0',
  item_count: 10,
  labels_schema: {
    violates_tenant_isolation: true,
    category: 'policy',
    subtype: 'cross_tenant_read',
  },
} as const;

const TARGET_TENANTS = ['tenant-b', 'tenant-c', 'tenant-d'] as const;
const RESOURCE_TYPES = ['dataset', 'artifact', 'policy', 'receipt', 'run'] as const;
const METHODS = ['GET', 'HEAD'] as const;

function simulateCrossTenantRead(item: DatasetItem): { status: number; problem: Record<string, string | number> } {
  const denied = item.actor_tenant !== item.target_tenant;
  const status = denied ? ((item.attempt_index as number) % 2 === 0 ? 403 : 404) : 200;
  return {
    status,
    problem: {
      type: 'https://example.com/problems/tenant-isolation',
      title: 'Tenant isolation violation',
      status,
      code: status === 403 ? 'TENANT_ISOLATION_DENIED' : 'TENANT_RESOURCE_NOT_FOUND',
      trace_id: item.expected_trace_id as string,
    },
  };
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: (ctx) => {
    const items: DatasetItem[] = [];
    for (let i = 0; i < METADATA.item_count; i += 1) {
      const targetTenant = TARGET_TENANTS[i % TARGET_TENANTS.length];
      const status = i % 2 === 0 ? 403 : 404;
      items.push({
        attempt_id: `attempt-${String(i).padStart(3, '0')}`,
        attempt_index: i,
        actor_tenant: 'public-hardonian',
        target_tenant: targetTenant,
        resource_type: RESOURCE_TYPES[i % RESOURCE_TYPES.length],
        method: METHODS[i % METHODS.length],
        path: `/api/v1/${RESOURCE_TYPES[i % RESOURCE_TYPES.length]}/${ctx.rng.hex(12)}`,
        headers: {
          authorization: `Bearer ${ctx.rng.hex(16)}`,
          'x-session-tenant': 'public-hardonian',
        },
        expected_status: status,
        expected_error_code: status === 403 ? 'TENANT_ISOLATION_DENIED' : 'TENANT_RESOURCE_NOT_FOUND',
        expected_trace_id: `${ctx.trace_id}_tenant_${i}`,
      });
    }
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'tenant_isolation_denied',
        passed: true,
        details: { scenarios: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const simulation = simulateCrossTenantRead(item);
      if ((item.expected_status as number) !== simulation.status) {
        fail(result, {
          item_index: index,
          field: 'expected_status',
          message: `Expected ${(item.expected_status as number)} got ${simulation.status}`,
        });
      }
      if ((item.expected_error_code as string) !== simulation.problem.code) {
        fail(result, {
          item_index: index,
          field: 'expected_error_code',
          message: 'Unexpected policy error code',
        });
      }
      if (!ensureProblemJsonShape(simulation.problem as never)) {
        fail(result, {
          item_index: index,
          field: 'problem+json',
          message: 'Problem+JSON shape invalid',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
