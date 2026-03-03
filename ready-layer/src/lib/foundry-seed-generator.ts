// ready-layer/src/lib/foundry-seed-generator.ts
// Deterministic seeded sample dataset generator for Test Data Foundry

import type {
  Dataset,
  DatasetItem,
  Label,
  SeededSampleConfig,
  SeededSampleDataset,
} from '@/types/foundry';
import { computeStableHash, now, generateRunId } from './foundry-repository';

// ═══════════════════════════════════════════════════════════════════════════════
// SEEDED RANDOM NUMBER GENERATOR (Mulberry32)
// Deterministic PRNG for reproducible datasets
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mulberry32 seeded random number generator.
 * Produces deterministic random numbers from a seed.
 * Based on: https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
export function createSeededRandom(seed: number): () => number {
  return function (): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAMPLE DATA TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

interface SampleDataTemplates {
  simple: Record<string, unknown>[];
  complex: Record<string, unknown>[];
  edge_cases: Record<string, unknown>[];
}

const SIMPLE_TEMPLATES: Record<string, unknown>[] = [
  { category: 'greeting', text: 'Hello, how are you?', sentiment: 'positive', priority: 1 },
  { category: 'question', text: 'What time is the meeting?', sentiment: 'neutral', priority: 2 },
  { category: 'request', text: 'Please send the report', sentiment: 'neutral', priority: 3 },
  { category: 'complaint', text: 'This service is not working', sentiment: 'negative', priority: 4 },
  { category: 'feedback', text: 'Great job on the presentation', sentiment: 'positive', priority: 2 },
];

const COMPLEX_TEMPLATES: Record<string, unknown>[] = [
  {
    request: {
      method: 'POST',
      path: '/api/users',
      headers: { 'content-type': 'application/json', 'x-request-id': 'req-123' },
      body: { name: 'John Doe', email: 'john@example.com' },
    },
    context: { user_id: 'user-456', session_id: 'sess-789', timestamp: '2025-01-01T00:00:00Z' },
  },
  {
    request: {
      method: 'GET',
      path: '/api/orders',
      headers: { 'authorization': 'Bearer token123', 'x-tenant-id': 'tenant-abc' },
      query: { status: 'pending', limit: 10 },
    },
    context: { user_id: 'user-789', session_id: 'sess-012', timestamp: '2025-01-02T00:00:00Z' },
  },
  {
    request: {
      method: 'PUT',
      path: '/api/products/123',
      headers: { 'content-type': 'application/json' },
      body: { price: 29.99, stock: 100 },
    },
    context: { user_id: 'admin-001', session_id: 'sess-admin', timestamp: '2025-01-03T00:00:00Z' },
  },
  {
    request: {
      method: 'DELETE',
      path: '/api/sessions/456',
      headers: { 'authorization': 'Bearer token456' },
    },
    context: { user_id: 'user-999', session_id: 'sess-999', timestamp: '2025-01-04T00:00:00Z' },
  },
  {
    request: {
      method: 'PATCH',
      path: '/api/users/789',
      headers: { 'content-type': 'application/json', 'if-match': 'abc123' },
      body: { preferences: { theme: 'dark', notifications: true } },
    },
    context: { user_id: 'user-789', session_id: 'sess-345', timestamp: '2025-01-05T00:00:00Z' },
  },
];

const EDGE_CASE_TEMPLATES: Record<string, unknown>[] = [
  { input: '', description: 'Empty string', expected_behavior: 'validation_error' },
  { input: null, description: 'Null value', expected_behavior: 'null_handled' },
  { input: undefined, description: 'Undefined value', expected_behavior: 'undefined_handled' },
  { input: 'x'.repeat(10000), description: 'Very long string', expected_behavior: 'truncated_or_rejected' },
  { input: '<script>alert("xss")</script>', description: 'XSS attempt', expected_behavior: 'sanitized' },
  { input: "'; DROP TABLE users; --", description: 'SQL injection attempt', expected_behavior: 'parameterized_safe' },
  { input: {}, description: 'Empty object', expected_behavior: 'default_values' },
  { input: [], description: 'Empty array', expected_behavior: 'empty_handled' },
  { input: { nested: { deeply: { value: 'found' } } }, description: 'Deeply nested', expected_behavior: 'traversed' },
  { input: -1, description: 'Negative number', expected_behavior: 'validated' },
  { input: Number.MAX_SAFE_INTEGER, description: 'Max integer', expected_behavior: 'handled' },
  { input: Number.MIN_SAFE_INTEGER, description: 'Min integer', expected_behavior: 'handled' },
  { input: Infinity, description: 'Infinity', expected_behavior: 'validated' },
  { input: NaN, description: 'Not a number', expected_behavior: 'validated' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LABEL GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

interface LabelGenerator {
  (item: Record<string, unknown>, index: number, rng: () => number): Label | null;
}

function createSimpleLabelGenerator(
  rng: () => number,
  distribution: Record<string, number>
): LabelGenerator {
  const labels = Object.keys(distribution);
  const weights = Object.values(distribution);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  return (item: Record<string, unknown>, index: number): Label | null => {
    const rand = rng() * totalWeight;
    let cumulative = 0;
    let selectedLabel = labels[0];

    for (let i = 0; i < labels.length; i++) {
      cumulative += weights[i];
      if (rand <= cumulative) {
        selectedLabel = labels[i];
        break;
      }
    }

    // Confidence varies based on how "clean" the data is
    const confidence = 0.7 + rng() * 0.25;

    return {
      id: `label-${index}`,
      tenant_id: '', // Will be set by caller
      dataset_id: '', // Will be set by caller
      dataset_item_id: '', // Will be set by caller
      label_type: rng() > 0.8 ? 'auto' : 'manual',
      label_key: 'classification',
      label_value: { category: selectedLabel },
      confidence,
      labeled_by: rng() > 0.8 ? 'system' : 'user-001',
      source_generator_id: undefined,
      metadata: { generated_from_seed: true },
      created_at: now(),
      updated_at: now(),
    };
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export interface GenerateSampleOptions {
  tenant_id: string;
  actor_id: string;
  trace_id: string;
  config?: Partial<SeededSampleConfig>;
}

/**
 * Generates a deterministic sample dataset based on a seed.
 * The same seed will always produce the same dataset.
 */
export function generateSeededSampleDataset(
  options: GenerateSampleOptions
): SeededSampleDataset {
  const config: SeededSampleConfig = {
    seed: options.config?.seed ?? 12345,
    item_count: options.config?.item_count ?? 100,
    schema: options.config?.schema ?? 'simple',
    include_labels: options.config?.include_labels ?? true,
    label_distribution: options.config?.label_distribution ?? {
      positive: 0.4,
      neutral: 0.35,
      negative: 0.25,
    },
  };

  const rng = createSeededRandom(config.seed);
  const templates = getTemplatesForSchema(config.schema);
  const timestamp = now();

  // Generate dataset metadata
  const datasetId = `ds-${config.seed}-${Date.now()}`;
  const datasetName = `Sample ${config.schema} dataset (seed: ${config.seed})`;

  const dataset: Dataset = {
    id: datasetId,
    tenant_id: options.tenant_id,
    stable_hash: computeStableHash({
      tenant_id: options.tenant_id,
      name: datasetName,
      content: { seed: config.seed, schema: config.schema },
    }),
    name: datasetName,
    description: `Deterministically generated ${config.schema} dataset with ${config.item_count} items using seed ${config.seed}`,
    dataset_type: config.schema === 'edge_cases' ? 'test' : 'train',
    schema_json: generateSchemaForConfig(config),
    item_count: config.item_count,
    size_bytes: 0, // Will be calculated
    version: 1,
    parent_dataset_id: undefined,
    labels_enabled: config.include_labels,
    metadata: {
      generated: true,
      seed: config.seed,
      generator_version: '1.0.0',
    },
    created_at: timestamp,
    updated_at: timestamp,
    created_by: options.actor_id,
  };

  // Generate items
  const items: DatasetItem[] = [];
  const labels: Label[] = [];

  const labelGenerator = config.include_labels
    ? createSimpleLabelGenerator(rng, config.label_distribution)
    : null;

  let totalSizeBytes = 0;

  for (let i = 0; i < config.item_count; i++) {
    const templateIndex = Math.floor(rng() * templates.length);
    const template = templates[templateIndex];

    // Add some variation to the template
    const content = varyTemplate(template, i, rng, config.schema);
    const contentStr = JSON.stringify(content);
    const sizeBytes = contentStr.length;
    totalSizeBytes += sizeBytes;

    const itemId = `item-${i}`;
    const item: DatasetItem = {
      id: itemId,
      tenant_id: options.tenant_id,
      dataset_id: datasetId,
      stable_hash: computeStableHash({
        tenant_id: options.tenant_id,
        name: `${datasetId}_item_${i}`,
        content,
      }),
      item_index: i,
      content,
      content_type: 'json',
      size_bytes: sizeBytes,
      metadata: { template_index: templateIndex },
      created_at: timestamp,
      updated_at: timestamp,
    };

    items.push(item);

    // Generate label if enabled
    if (labelGenerator) {
      const label = labelGenerator(content, i, rng);
      if (label) {
        label.id = `label-${i}`;
        label.tenant_id = options.tenant_id;
        label.dataset_id = datasetId;
        label.dataset_item_id = itemId;
        labels.push(label);
      }
    }
  }

  // Update dataset size
  dataset.size_bytes = totalSizeBytes;

  return {
    config,
    dataset,
    items,
    labels,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getTemplatesForSchema(schema: SeededSampleConfig['schema']): Record<string, unknown>[] {
  switch (schema) {
    case 'simple':
      return SIMPLE_TEMPLATES;
    case 'complex':
      return COMPLEX_TEMPLATES;
    case 'edge_cases':
      return EDGE_CASE_TEMPLATES;
    default:
      return SIMPLE_TEMPLATES;
  }
}

function generateSchemaForConfig(config: SeededSampleConfig): Record<string, unknown> {
  switch (config.schema) {
    case 'simple':
      return {
        type: 'object',
        properties: {
          category: { type: 'string' },
          text: { type: 'string' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          priority: { type: 'integer' },
        },
      };
    case 'complex':
      return {
        type: 'object',
        properties: {
          request: {
            type: 'object',
            properties: {
              method: { type: 'string' },
              path: { type: 'string' },
              headers: { type: 'object' },
              body: { type: 'object' },
              query: { type: 'object' },
            },
          },
          context: {
            type: 'object',
            properties: {
              user_id: { type: 'string' },
              session_id: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      };
    case 'edge_cases':
      return {
        type: 'object',
        properties: {
          input: { type: 'any' },
          description: { type: 'string' },
          expected_behavior: { type: 'string' },
        },
      };
    default:
      return { type: 'object' };
  }
}

function varyTemplate(
  template: Record<string, unknown>,
  index: number,
  rng: () => number,
  schema: SeededSampleConfig['schema']
): Record<string, unknown> {
  // Deep clone the template
  const varied = JSON.parse(JSON.stringify(template));

  switch (schema) {
    case 'simple':
      // Vary the text slightly
      if (typeof varied.text === 'string') {
        const variations = ['!', '?', '.', '...'];
        varied.text = varied.text + variations[Math.floor(rng() * variations.length)];
      }
      // Sometimes vary the priority
      if (rng() > 0.7) {
        varied.priority = Math.floor(rng() * 5) + 1;
      }
      break;

    case 'complex':
      // Vary request ID and timestamps
      if (varied.request?.headers?.['x-request-id']) {
        varied.request.headers['x-request-id'] = `req-${index}-${Math.floor(rng() * 1000)}`;
      }
      if (varied.context?.timestamp) {
        const baseDate = new Date('2025-01-01').getTime();
        const offset = Math.floor(rng() * 30 * 24 * 60 * 60 * 1000); // Up to 30 days
        varied.context.timestamp = new Date(baseDate + offset).toISOString();
      }
      // Vary user IDs
      if (varied.context?.user_id) {
        varied.context.user_id = `user-${Math.floor(rng() * 10000)}`;
      }
      break;

    case 'edge_cases':
      // Edge cases are already varied by template selection
      varied.instance_id = index;
      break;
  }

  return varied;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH INSERT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Prepares a seeded sample dataset for database insertion.
 * Assigns proper IDs and hashes.
 */
export function prepareSeededDatasetForInsertion(
  sample: SeededSampleDataset,
  tenantId: string
): {
  dataset: Dataset;
  items: DatasetItem[];
  labels: Label[];
} {
  const datasetId = generateRunId(tenantId, 'ds');
  const timestamp = now();

  const dataset: Dataset = {
    ...sample.dataset,
    id: datasetId,
    tenant_id: tenantId,
    stable_hash: computeStableHash({
      tenant_id: tenantId,
      name: sample.dataset.name,
      content: { seed: sample.config.seed, schema: sample.config.schema },
    }),
    created_at: timestamp,
    updated_at: timestamp,
  };

  const items: DatasetItem[] = sample.items.map((item, index) => ({
    ...item,
    id: `${datasetId}_item_${index}`,
    tenant_id: tenantId,
    dataset_id: datasetId,
    stable_hash: computeStableHash({
      tenant_id: tenantId,
      name: `${datasetId}_item_${index}`,
      content: item.content,
    }),
    created_at: timestamp,
    updated_at: timestamp,
  }));

  const labels: Label[] = sample.labels.map((label, index) => ({
    ...label,
    id: `${datasetId}_label_${index}`,
    tenant_id: tenantId,
    dataset_id: datasetId,
    dataset_item_id: items[index]?.id ?? `${datasetId}_item_${index}`,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  return { dataset, items, labels };
}
