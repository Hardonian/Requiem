// ready-layer/src/lib/foundry-repository.ts
// Test Data Foundry repository functions with strict tenant isolation

import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import type {
  Dataset,
  DatasetItem,
  Label,
  Generator,
  GeneratorRun,
  EvalRun,
  DriftVector,
  RunArtifact,
  DatasetType,
  GeneratorType,
  LabelType,
  RunStatus,
  VectorType,
  ArtifactType,
  TargetType,
} from '@/types/foundry';

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates a stable hash for idempotency checking.
 * Uses deterministic JSON serialization.
 */
export function computeStableHash(input: {
  tenant_id: string;
  name: string;
  content: Record<string, unknown>;
  version?: number;
}): string {
  const { tenant_id, name, content, version = 1 } = input;
  // Deterministic JSON serialization with sorted keys
  const normalized = JSON.stringify({
    tenant_id,
    name,
    content: sortKeys(content),
    version,
  });
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Recursively sorts object keys for deterministic serialization.
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
      return acc;
    }, {} as Record<string, unknown>);
}

/**
 * Gets the current timestamp in ISO format.
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Generates a unique run ID with tenant prefix for traceability.
 */
export function generateRunId(tenantId: string, prefix: string = 'run'): string {
  const shortTenant = tenantId.slice(0, 8);
  const uuid = randomUUID().slice(0, 8);
  return `${prefix}_${shortTenant}_${uuid}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPOSITORY CLASS WITH TENANT ISOLATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface RepositoryContext {
  tenant_id: string;
  actor_id: string;
  trace_id: string;
}

export class FoundryRepository {
  private supabase;
  private ctx: RepositoryContext;

  constructor(ctx: RepositoryContext) {
    this.ctx = ctx;
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'x-tenant-id': ctx.tenant_id,
          'x-trace-id': ctx.trace_id,
          // Set the tenant ID for RLS policies
          'app.current_tenant_id': ctx.tenant_id,
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATASET OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createDataset(input: {
    name: string;
    description?: string;
    dataset_type?: DatasetType;
    schema_json?: Record<string, unknown>;
    labels_enabled?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<Dataset> {
    const stableHash = computeStableHash({
      tenant_id: this.ctx.tenant_id,
      name: input.name,
      content: {
        dataset_type: input.dataset_type ?? 'test',
        schema_json: input.schema_json ?? {},
      },
    });

    const { data, error } = await this.supabase
      .from('datasets')
      .insert({
        tenant_id: this.ctx.tenant_id,
        stable_hash: stableHash,
        name: input.name,
        description: input.description,
        dataset_type: input.dataset_type ?? 'test',
        schema_json: input.schema_json ?? {},
        labels_enabled: input.labels_enabled ?? true,
        metadata: input.metadata ?? {},
        created_by: this.ctx.actor_id,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate key violation
      if (error.code === '23505') {
        const { data: existing } = await this.supabase
          .from('datasets')
          .select()
          .eq('tenant_id', this.ctx.tenant_id)
          .eq('stable_hash', stableHash)
          .single();
        if (existing) {
          return existing as Dataset;
        }
      }
      throw new Error(`Failed to create dataset: ${error.message}`);
    }

    return data as Dataset;
  }

  async listDatasets(options?: {
    dataset_type?: DatasetType;
    limit?: number;
    offset?: number;
  }): Promise<{ datasets: Dataset[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = this.supabase
      .from('datasets')
      .select('*', { count: 'exact' })
      .eq('tenant_id', this.ctx.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.dataset_type) {
      query = query.eq('dataset_type', options.dataset_type);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list datasets: ${error.message}`);
    }

    return {
      datasets: (data as Dataset[]) ?? [],
      total: count ?? 0,
    };
  }

  async getDataset(id: string): Promise<Dataset | null> {
    const { data, error } = await this.supabase
      .from('datasets')
      .select()
      .eq('id', id)
      .eq('tenant_id', this.ctx.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get dataset: ${error.message}`);
    }

    return data as Dataset;
  }

  async updateDataset(
    id: string,
    input: Partial<Omit<Dataset, 'id' | 'tenant_id' | 'created_at'>>
  ): Promise<Dataset> {
    const { data, error } = await this.supabase
      .from('datasets')
      .update({
        ...input,
        updated_at: now(),
      })
      .eq('id', id)
      .eq('tenant_id', this.ctx.tenant_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update dataset: ${error.message}`);
    }

    return data as Dataset;
  }

  async deleteDataset(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('datasets')
      .delete()
      .eq('id', id)
      .eq('tenant_id', this.ctx.tenant_id);

    if (error) {
      throw new Error(`Failed to delete dataset: ${error.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DATASET ITEM OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async addDatasetItem(input: {
    dataset_id: string;
    item_index: number;
    content: Record<string, unknown>;
    content_type?: string;
    metadata?: Record<string, unknown>;
  }): Promise<DatasetItem> {
    const stableHash = computeStableHash({
      tenant_id: this.ctx.tenant_id,
      name: `item_${input.dataset_id}_${input.item_index}`,
      content: input.content,
    });

    const sizeBytes = JSON.stringify(input.content).length;

    const { data, error } = await this.supabase
      .from('dataset_items')
      .insert({
        tenant_id: this.ctx.tenant_id,
        dataset_id: input.dataset_id,
        stable_hash: stableHash,
        item_index: input.item_index,
        content: input.content,
        content_type: input.content_type ?? 'json',
        size_bytes: sizeBytes,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add dataset item: ${error.message}`);
    }

    return data as DatasetItem;
  }

  async listDatasetItems(datasetId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: DatasetItem[]; total: number }> {
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const { data, error, count } = await this.supabase
      .from('dataset_items')
      .select('*', { count: 'exact' })
      .eq('dataset_id', datasetId)
      .eq('tenant_id', this.ctx.tenant_id)
      .order('item_index', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to list dataset items: ${error.message}`);
    }

    return {
      items: (data as DatasetItem[]) ?? [],
      total: count ?? 0,
    };
  }

  async getDatasetItem(id: string): Promise<DatasetItem | null> {
    const { data, error } = await this.supabase
      .from('dataset_items')
      .select()
      .eq('id', id)
      .eq('tenant_id', this.ctx.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get dataset item: ${error.message}`);
    }

    return data as DatasetItem;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LABEL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createLabel(input: {
    dataset_id: string;
    dataset_item_id: string;
    label_type?: LabelType;
    label_key: string;
    label_value: Record<string, unknown>;
    confidence?: number;
    source_generator_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Label> {
    const { data, error } = await this.supabase
      .from('labels')
      .insert({
        tenant_id: this.ctx.tenant_id,
        dataset_id: input.dataset_id,
        dataset_item_id: input.dataset_item_id,
        label_type: input.label_type ?? 'manual',
        label_key: input.label_key,
        label_value: input.label_value,
        confidence: input.confidence,
        labeled_by: this.ctx.actor_id,
        source_generator_id: input.source_generator_id,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create label: ${error.message}`);
    }

    return data as Label;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATOR OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createGenerator(input: {
    name: string;
    description?: string;
    generator_type: GeneratorType;
    config_json: Record<string, unknown>;
    seed_value?: number;
    deterministic?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<Generator> {
    const stableHash = computeStableHash({
      tenant_id: this.ctx.tenant_id,
      name: input.name,
      content: {
        generator_type: input.generator_type,
        config_json: input.config_json,
      },
    });

    const { data, error } = await this.supabase
      .from('generators')
      .insert({
        tenant_id: this.ctx.tenant_id,
        stable_hash: stableHash,
        name: input.name,
        description: input.description,
        generator_type: input.generator_type,
        config_json: input.config_json,
        seed_value: input.seed_value,
        deterministic: input.deterministic ?? true,
        metadata: input.metadata ?? {},
        created_by: this.ctx.actor_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create generator: ${error.message}`);
    }

    return data as Generator;
  }

  async getGenerator(id: string): Promise<Generator | null> {
    const { data, error } = await this.supabase
      .from('generators')
      .select()
      .eq('id', id)
      .eq('tenant_id', this.ctx.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get generator: ${error.message}`);
    }

    return data as Generator;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERATOR RUN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createGeneratorRun(input: {
    generator_id: string;
    source_dataset_id?: string;
    config_snapshot?: Record<string, unknown>;
    seed_value?: number;
    metadata?: Record<string, unknown>;
  }): Promise<GeneratorRun> {
    const runId = generateRunId(this.ctx.tenant_id, 'gen');

    const generator = await this.getGenerator(input.generator_id);
    if (!generator) {
      throw new Error(`Generator not found: ${input.generator_id}`);
    }

    const { data, error } = await this.supabase
      .from('generator_runs')
      .insert({
        tenant_id: this.ctx.tenant_id,
        run_id: runId,
        generator_id: input.generator_id,
        source_dataset_id: input.source_dataset_id,
        status: 'pending',
        config_snapshot: input.config_snapshot ?? generator.config_json,
        seed_value: input.seed_value ?? generator.seed_value,
        trace_id: this.ctx.trace_id,
        metadata: input.metadata ?? {},
        created_by: this.ctx.actor_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create generator run: ${error.message}`);
    }

    return data as GeneratorRun;
  }

  async updateGeneratorRun(
    runId: string,
    input: Partial<Omit<GeneratorRun, 'id' | 'tenant_id' | 'run_id' | 'created_at'>>
  ): Promise<GeneratorRun> {
    const updateData: Record<string, unknown> = { ...input };
    
    if (input.status === 'running' && !input.started_at) {
      updateData.started_at = now();
    }
    if ((input.status === 'completed' || input.status === 'failed') && !input.completed_at) {
      updateData.completed_at = now();
    }

    const { data, error } = await this.supabase
      .from('generator_runs')
      .update(updateData)
      .eq('run_id', runId)
      .eq('tenant_id', this.ctx.tenant_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update generator run: ${error.message}`);
    }

    return data as GeneratorRun;
  }

  async getGeneratorRun(runId: string): Promise<GeneratorRun | null> {
    const { data, error } = await this.supabase
      .from('generator_runs')
      .select()
      .eq('run_id', runId)
      .eq('tenant_id', this.ctx.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get generator run: ${error.message}`);
    }

    return data as GeneratorRun;
  }

  async listGeneratorRuns(options?: {
    generator_id?: string;
    status?: RunStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ runs: GeneratorRun[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    let query = this.supabase
      .from('generator_runs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', this.ctx.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options?.generator_id) {
      query = query.eq('generator_id', options.generator_id);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list generator runs: ${error.message}`);
    }

    return {
      runs: (data as GeneratorRun[]) ?? [],
      total: count ?? 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVAL RUN OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createEvalRun(input: {
    dataset_id: string;
    target_type: TargetType;
    target_id: string;
    target_version?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EvalRun> {
    const runId = generateRunId(this.ctx.tenant_id, 'eval');

    const { data, error } = await this.supabase
      .from('eval_runs')
      .insert({
        tenant_id: this.ctx.tenant_id,
        run_id: runId,
        dataset_id: input.dataset_id,
        target_type: input.target_type,
        target_id: input.target_id,
        target_version: input.target_version,
        status: 'pending',
        trace_id: this.ctx.trace_id,
        metadata: input.metadata ?? {},
        created_by: this.ctx.actor_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create eval run: ${error.message}`);
    }

    return data as EvalRun;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN ARTIFACT OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createArtifact(input: {
    run_id: string;
    run_type: 'generator_run' | 'eval_run';
    artifact_type: ArtifactType;
    artifact_name: string;
    content_hash: string;
    storage_path: string;
    size_bytes: number;
    mime_type?: string;
    metadata?: Record<string, unknown>;
  }): Promise<RunArtifact> {
    const { data, error } = await this.supabase
      .from('run_artifacts')
      .insert({
        tenant_id: this.ctx.tenant_id,
        run_id: input.run_id,
        run_type: input.run_type,
        artifact_type: input.artifact_type,
        artifact_name: input.artifact_name,
        content_hash: input.content_hash,
        storage_path: input.storage_path,
        size_bytes: input.size_bytes,
        mime_type: input.mime_type,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create artifact: ${error.message}`);
    }

    return data as RunArtifact;
  }

  async listArtifacts(runId: string): Promise<RunArtifact[]> {
    const { data, error } = await this.supabase
      .from('run_artifacts')
      .select()
      .eq('run_id', runId)
      .eq('tenant_id', this.ctx.tenant_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list artifacts: ${error.message}`);
    }

    return (data as RunArtifact[]) ?? [];
  }

  async getArtifact(id: string): Promise<RunArtifact | null> {
    const { data, error } = await this.supabase
      .from('run_artifacts')
      .select()
      .eq('id', id)
      .eq('tenant_id', this.ctx.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get artifact: ${error.message}`);
    }

    return data as RunArtifact;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DRIFT VECTOR OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createDriftVector(input: {
    vector_name: string;
    vector_type: VectorType;
    source_type: string;
    source_id: string;
    baseline_dataset_id?: string;
    comparison_dataset_id?: string;
    drift_score?: number;
    threshold?: number;
    is_drift_detected?: boolean;
    features_json?: Record<string, unknown>;
    distribution_comparison?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<DriftVector> {
    const { data, error } = await this.supabase
      .from('drift_vectors')
      .insert({
        tenant_id: this.ctx.tenant_id,
        vector_name: input.vector_name,
        vector_type: input.vector_type,
        source_type: input.source_type,
        source_id: input.source_id,
        baseline_dataset_id: input.baseline_dataset_id,
        comparison_dataset_id: input.comparison_dataset_id,
        drift_score: input.drift_score,
        threshold: input.threshold ?? 0.05,
        is_drift_detected: input.is_drift_detected ?? false,
        features_json: input.features_json ?? {},
        distribution_comparison: input.distribution_comparison ?? {},
        trace_id: this.ctx.trace_id,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create drift vector: ${error.message}`);
    }

    return data as DriftVector;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function createFoundryRepository(ctx: RepositoryContext): FoundryRepository {
  return new FoundryRepository(ctx);
}
