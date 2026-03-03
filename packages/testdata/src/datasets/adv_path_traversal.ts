import { posix } from 'path';
import type { DatasetDefinition, DatasetItem } from '../registry.js';
import { defaultValidationResult, fail, labelFromSchema } from './common.js';

const METADATA = {
  code: 'ADV-PATH-TRAVERSAL',
  name: 'Adversarial Path Traversal',
  description: 'Workspace escape attempts using traversal payloads',
  version: 1,
  schema_version: '1.0.0',
  item_count: 20,
  labels_schema: {
    category: 'adversarial',
    subtype: 'path_traversal',
    blocked: true,
  },
} as const;

const VARIANTS = [
  '../../etc/passwd',
  '../../../.ssh/id_rsa',
  'workspace/../../secret.txt',
  '..\\..\\windows\\system.ini',
  './a/../../../b',
] as const;

function sanitizePath(inputPath: string): { normalized: string; blocked: boolean; reason: string } {
  const unixPath = inputPath.replace(/\\/g, '/');
  const normalized = posix.normalize(`/${unixPath}`);
  const blocked = normalized.includes('/../') || normalized.startsWith('/..');
  if (blocked) {
    return { normalized, blocked: true, reason: 'path_traversal' };
  }
  if (!normalized.startsWith('/workspace/')) {
    return { normalized, blocked: true, reason: 'outside_workspace' };
  }
  return { normalized, blocked: false, reason: 'ok' };
}

export const dataset: DatasetDefinition = {
  metadata: METADATA,
  generate: (_ctx) => {
    const items: DatasetItem[] = [];
    for (let i = 0; i < METADATA.item_count; i += 1) {
      const inputPath = VARIANTS[i % VARIANTS.length];
      const sanitized = sanitizePath(inputPath);
      items.push({
        case_id: `path-${String(i).padStart(3, '0')}`,
        input_path: inputPath,
        normalized_path: sanitized.normalized,
        expected: 'blocked',
        reason: 'path_traversal',
      });
    }
    return items;
  },
  label: () => labelFromSchema(METADATA.labels_schema),
  validate: (items, _labels) => {
    const result = defaultValidationResult([
      {
        name: 'path_traversal_blocked',
        passed: true,
        details: { cases: items.length },
      },
    ]);

    items.forEach((item, index) => {
      const sanitized = sanitizePath(item.input_path as string);
      if (!sanitized.blocked) {
        fail(result, {
          item_index: index,
          field: 'input_path',
          message: 'Traversal case was not blocked',
        });
      }
      if (item.expected !== 'blocked' || item.reason !== 'path_traversal') {
        fail(result, {
          item_index: index,
          field: 'expected',
          message: 'Expected block metadata mismatch',
        });
      }
    });

    result.checks[0].passed = result.valid;
    return result;
  },
};
