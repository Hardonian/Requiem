/**
 * Dataset: POL-ROLE-ESCALATION
 * Goal: viewer attempting admin tasks (10 scenarios).
 * Items: {actor_role:"viewer", action:"create_api_key|delete_dataset|set_policy|invite_user", expected: denied}
 */

import type { SeededRNG } from '../rng.js';
import type { DatasetGenerator, DatasetMetadata, RegisteredDataset } from '../registry.js';

const VERSION = 1;
const SCHEMA_VERSION = '1.0.0';

const ACTIONS = [
  'create_api_key',
  'delete_dataset',
  'set_policy',
  'invite_user',
  'delete_policy',
  'modify_roles',
  'access_admin_panel',
  'delete_user',
  'create_dataset',
  'export_data',
];

const EXPECTED_DENIAL_CODES = [
  'INSUFFICIENT_PERMISSIONS',
  'FORBIDDEN',
  'ACCESS_DENIED',
  'ROLE_PERMISSION_DENIED',
];

export const metadata: DatasetMetadata = {
  code: 'POL-ROLE-ESCALATION',
  name: 'Role Escalation Policy Test',
  description: 'Viewer role attempting elevated privilege actions to verify RBAC enforcement',
  version: VERSION,
  schemaVersion: SCHEMA_VERSION,
  itemCount: 10,
  labels: {
    violates_rbac: 'true',
    category: 'policy',
    subtype: 'role_escalation',
  },
};

/**
 * Generate role escalation test cases.
 */
export function* generate(rng: SeededRNG, _seed: number, _version: number): Generator<{
  scenario_id: string;
  actor_role: string;
  action: string;
  target_resource?: string;
  expected_denied: boolean;
  expected_error_code: string;
}> {
  for (let i = 0; i < 10; i++) {
    const action = rng.pick(ACTIONS);
    const expectedDenialCode = rng.pick(EXPECTED_DENIAL_CODES);

    yield {
      scenario_id: `escalation-${i.toString().padStart(3, '0')}`,
      actor_role: 'viewer',
      action,
      target_resource: `resource-${rng.nextHex(8)}`,
      expected_denied: true,
      expected_error_code: expectedDenialCode,
    };
  }
}

/**
 * Validator for role escalation dataset.
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
    if (!item.scenario_id) {
      errors.push({ itemIndex: i, field: 'scenario_id', message: 'Missing required field: scenario_id' });
    }
    if (!item.actor_role) {
      errors.push({ itemIndex: i, field: 'actor_role', message: 'Missing required field: actor_role' });
    }
    if (!item.action) {
      errors.push({ itemIndex: i, field: 'action', message: 'Missing required field: action' });
    }

    // Validate actor role is viewer (non-elevated)
    if (item.actor_role !== 'viewer') {
      errors.push({
        itemIndex: i,
        field: 'actor_role',
        message: 'Actor role should be viewer for escalation test',
      });
    }

    // Validate expected_denied is true
    if (item.expected_denied !== true) {
      errors.push({
        itemIndex: i,
        field: 'expected_denied',
        message: 'Expected denied should be true for role escalation scenarios',
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
