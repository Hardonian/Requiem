/**
 * Dataset: POL-TENANT-ISOLATION
 * Goal: capture 10 cross-tenant read attempts.
 * Generator: create 10 request scenarios attempting to read tenant B resources from tenant A session.
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset, ItemLabel } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

const TENANTS = ['public-hardonian', 'acme-corp', 'globex-inc'];
const RESOURCE_TYPES = ['dataset', 'model', 'policy', 'artifact', 'user'];
const METHODS = ['GET', 'HEAD'];
const PATHS = [
  '/api/v1/datasets',
  '/api/v1/models',
  '/api/v1/policies',
  '/api/v1/artifacts',
  '/api/v1/users',
];

const HEADERS = [
  { 'Content-Type': 'application/json', Accept: 'application/json' },
  { 'Content-Type': 'application/json' },
  { Accept: 'application/json' },
  {},
];

const EXPECTED_STATUSES = [403, 404];

const ERROR_CODES = [
  'TENANT_ISOLATION_VIOLATION',
  'RESOURCE_NOT_FOUND',
  'FORBIDDEN',
  'ACCESS_DENIED',
];

export const metadata: DatasetMetadata = {
  code: 'POL-TENANT-ISOLATION',
  name: 'Tenant Isolation Policy Test',
  description: 'Cross-tenant read attempt scenarios to verify tenant isolation enforcement',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 10,
  labels: {
    violates_tenant_isolation: 'true',
    category: 'policy',
    subtype: 'cross_tenant_read',
  },
};

/**
 * Generate tenant isolation test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  attempt_id: string;
  actor_tenant: string;
  target_tenant: string;
  resource_type: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  expected_status: number;
  expected_error_code: string;
}> {
  for (let i = 0; i < 10; i++) {
    const actorTenant = rng.pick(TENANTS);
    let targetTenant = rng.pick(TENANTS);
    // Ensure target is different from actor
    while (targetTenant === actorTenant) {
      targetTenant = rng.pick(TENANTS);
    }

    const resourceType = rng.pick(RESOURCE_TYPES);
    const method = rng.pick(METHODS);
    const basePath = rng.pick(PATHS);
    const path = `${basePath}/${rng.nextUUID()}`;
    const headers = rng.pick(HEADERS);
    const expectedStatus = rng.pick(EXPECTED_STATUSES);
    const expectedErrorCode = rng.pick(ERROR_CODES);

    yield {
      attempt_id: `attempt-${i.toString().padStart(3, '0')}`,
      actor_tenant: actorTenant,
      target_tenant: targetTenant,
      resource_type: resourceType,
      method,
      path,
      headers,
      expected_status: expectedStatus,
      expected_error_code: expectedErrorCode,
    };
  }
}

/**
 * Generate labels for each item.
 */
export function generateLabels(rng: SeededRNG, itemCount: number): ItemLabel[] {
  const labels: ItemLabel[] = [];
  for (let i = 0; i < itemCount; i++) {
    labels.push({
      violates_tenant_isolation: true,
      category: 'policy',
      subtype: 'cross_tenant_read',
    });
  }
  return labels;
}

/**
 * Validator for tenant isolation dataset.
 */
export function validate(
  items: Record<string, unknown>[],
  _labels: Record<string, unknown>[]
): { valid: boolean; errors: { itemIndex: number; field: string; message: string }[]; warnings: { itemIndex: number; field: string; message: string }[] } {
  const errors: { itemIndex: number; field: string; message: string }[] = [];
  const warnings: { itemIndex: number; field: string; message: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Validate required fields
    if (!item.attempt_id) {
      errors.push({ itemIndex: i, field: 'attempt_id', message: 'Missing required field: attempt_id' });
    }
    if (!item.actor_tenant) {
      errors.push({ itemIndex: i, field: 'actor_tenant', message: 'Missing required field: actor_tenant' });
    }
    if (!item.target_tenant) {
      errors.push({ itemIndex: i, field: 'target_tenant', message: 'Missing required field: target_tenant' });
    }

    // Validate tenant isolation: actor and target should be different
    if (item.actor_tenant === item.target_tenant) {
      errors.push({
        itemIndex: i,
        field: 'actor_tenant/target_tenant',
        message: 'Actor and target tenants should be different for isolation test',
      });
    }

    // Validate expected status is in allowed list
    if (item.expected_status && ![403, 404].includes(item.expected_status as number)) {
      warnings.push({
        itemIndex: i,
        field: 'expected_status',
        message: 'Expected status should be 403 or 404 for tenant isolation violations',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Registered dataset.
 */
export const dataset: RegisteredDataset = {
  metadata,
  generate,
  validate,
};
