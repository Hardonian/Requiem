import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'POL-ROLE-ESCALATION',
  name: 'Policy Role Escalation',
  description: 'Viewer attempts elevated admin actions',
  version: 1,
  schema_version: '1.0.0',
  item_count: 10,
  labels_schema: {
    violates_rbac: true,
    category: 'policy',
    subtype: 'role_escalation',
  },
} as const;

const ACTIONS = ['create_api_key', 'delete_dataset', 'set_policy', 'invite_user'] as const;

function authorize(action: string, role: string): { denied: boolean; error_code: string; audit_event: string } {
  if (role === 'viewer' && ACTIONS.includes(action as (typeof ACTIONS)[number])) {
    return {
      denied: true,
      error_code: 'RBAC_ROLE_ESCALATION_DENIED',
      audit_event: `audit.rbac.denied.${action}`,
    };
  }
  return {
    denied: false,
    error_code: 'OK',
    audit_event: `audit.rbac.allowed.${action}`,
  };
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: (ctx) => {
    const items: DatasetItem[] = [];
    for (let i = 0; i < METADATA.item_count; i += 1) {
      const action = ACTIONS[i % ACTIONS.length];
      const simulated = authorize(action, 'viewer');
      items.push({
        scenario_id: `role-escalation-${String(i).padStart(3, '0')}`,
        actor_role: 'viewer',
        action,
        expected: 'denied',
        expected_error_code: simulated.error_code,
        expected_audit_event: simulated.audit_event,
      });
    }
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'viewer_denied_admin_actions',
        passed: true,
        details: { scenarios: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const action = item.action as string;
      const auth = authorize(action, item.actor_role as string);
      if (!auth.denied || item.expected !== 'denied') {
        fail(result, {
          item_index: index,
          field: 'expected',
          message: 'Viewer escalation scenario must be denied',
        });
      }
      if (item.expected_error_code !== auth.error_code) {
        fail(result, {
          item_index: index,
          field: 'expected_error_code',
          message: 'Mismatch error code',
        });
      }
      if (item.expected_audit_event !== auth.audit_event) {
        fail(result, {
          item_index: index,
          field: 'expected_audit_event',
          message: 'Missing or incorrect audit event',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
