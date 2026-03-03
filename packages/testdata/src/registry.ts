import { createRng, type DeterministicRng } from './rng.js';
import { computeDatasetId } from './hash.js';

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | CanonicalValue[]
  | { [key: string]: CanonicalValue };

export interface DatasetMetadata {
  code: string;
  name: string;
  description: string;
  version: number;
  schema_version: string;
  item_count: number;
  labels_schema: Record<string, CanonicalValue>;
}

export interface DatasetItem {
  [key: string]: CanonicalValue;
}

export interface DatasetLabel {
  [key: string]: CanonicalValue;
}

export interface GenerationContext {
  dataset_code: string;
  version: number;
  seed: number;
  dataset_id: string;
  schema_version: string;
  tenant_id: string;
  trace_id: string;
  recorded_at: string;
  rng: DeterministicRng;
}

export interface ValidationIssue {
  item_index: number;
  field: string;
  message: string;
}

export interface ValidationCheck {
  name: string;
  passed: boolean;
  details: Record<string, CanonicalValue>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  checks: ValidationCheck[];
}

export interface DatasetDefinition {
  metadata: DatasetMetadata;
  generate: (ctx: GenerationContext) => DatasetItem[];
  label: (item: DatasetItem, index: number, ctx: GenerationContext) => DatasetLabel;
  validate: (items: DatasetItem[], labels: DatasetLabel[], ctx: GenerationContext) => ValidationResult;
}

export interface PreparedDataset {
  definition: DatasetDefinition;
  context: GenerationContext;
  items: DatasetItem[];
  labels: DatasetLabel[];
}

const registry = new Map<string, DatasetDefinition>();

export function registerDataset(definition: DatasetDefinition): void {
  if (registry.has(definition.metadata.code)) {
    throw new Error(`Dataset already registered: ${definition.metadata.code}`);
  }
  registry.set(definition.metadata.code, definition);
}

export function getDataset(code: string): DatasetDefinition | undefined {
  return registry.get(code);
}

export function listDatasets(): DatasetMetadata[] {
  return [...registry.values()]
    .map((d) => d.metadata)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function clearRegistry(): void {
  registry.clear();
}

export function deterministicRecordedAt(): string {
  return '2026-01-01T00:00:00.000Z';
}

export function prepareDataset(
  definition: DatasetDefinition,
  seed: number,
  version: number,
  tenantId: string,
): PreparedDataset {
  const datasetId = computeDatasetId(
    definition.metadata.code,
    version,
    seed,
    definition.metadata.schema_version,
  );
  const traceId = `trace_${datasetId.slice(0, 16)}`;
  const context: GenerationContext = {
    dataset_code: definition.metadata.code,
    version,
    seed,
    dataset_id: datasetId,
    schema_version: definition.metadata.schema_version,
    tenant_id: tenantId,
    trace_id: traceId,
    recorded_at: deterministicRecordedAt(),
    rng: createRng(seed),
  };

  const items = definition.generate(context);
  const labels = items.map((item, index) => definition.label(item, index, context));

  return {
    definition,
    context,
    items,
    labels,
  };
}
