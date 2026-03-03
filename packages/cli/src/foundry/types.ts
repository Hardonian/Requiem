import { createHash } from 'node:crypto';
import { z } from 'zod';

export const datasetTypeSchema = z.enum(['VECTORS', 'GIT_MINED', 'METAMORPHIC', 'FAULT_INJECTION']);
export const datasetItemKindSchema = z.enum([
  'VECTOR_RUN',
  'ROUTE_SMOKE',
  'CLI_SMOKE',
  'GIT_FIX_CASE',
  'METAMORPHIC_VARIANT',
  'FAULT_INJECTION_SCENARIO',
]);

export const expectedOutcomeSchema = z.object({
  result: z.enum(['PASS', 'FAIL']),
  expected_error_type: z.string().optional(),
  expected_audit_events: z.array(z.string()).optional(),
  expected_drift_severity: z.enum(['none', 'low', 'medium', 'high']).optional(),
  expected_cost_bounds: z.object({ min: z.number(), max: z.number() }).optional(),
  invariants: z.array(z.string()).default([]),
});

export const datasetSchema = z.object({
  dataset_id: z.string(),
  name: z.string(),
  dataset_type: datasetTypeSchema,
  tenant_scope: z.enum(['GLOBAL', 'TENANT']),
  created_at: z.string(),
  seed_policy: z.object({ seeds: z.array(z.number().int()) }),
  items_count: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  dataset_version: z.number().int().positive(),
});

export const datasetItemSchema = z.object({
  item_id: z.string(),
  dataset_id: z.string(),
  label: z.string(),
  kind: datasetItemKindSchema,
  input_ref: z.record(z.string(), z.unknown()),
  expected_outcome: expectedOutcomeSchema,
  reproducibility: z.object({
    seed: z.number().int(),
    config_hash: z.string(),
  }),
  dataset_item_version: z.number().int().positive(),
});

export const datasetRunSchema = z.object({
  dataset_run_id: z.string(),
  dataset_id: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  git_commit: z.string(),
  environment: z.enum(['local', 'ci']),
  summary: z.object({
    pass_count: z.number().int().nonnegative(),
    fail_count: z.number().int().nonnegative(),
    avg_cost_units: z.number(),
    drift_counts: z.record(z.string(), z.number().int()),
    flake_suspects: z.array(z.string()).optional(),
  }),
  pointers: z.object({
    run_ids: z.array(z.string()),
    artifacts: z.array(z.string()),
  }),
  dataset_run_version: z.number().int().positive(),
  item_results: z.array(z.object({
    item_id: z.string(),
    status: z.enum(['PASS', 'FAIL']),
    trace_id: z.string(),
    details: z.string(),
    artifact: z.string().optional(),
  })),
});

export type Dataset = z.infer<typeof datasetSchema>;
export type DatasetItem = z.infer<typeof datasetItemSchema>;
export type DatasetRun = z.infer<typeof datasetRunSchema>;

export function stableId(prefix: string, value: unknown): string {
  const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
  return `${prefix}_${hash}`;
}

export function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
