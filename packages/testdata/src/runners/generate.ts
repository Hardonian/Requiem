import { join } from 'path';
import { writeArtifacts, type WriteArtifactsResult } from '../artifact_writer.js';
import { computeRunId } from '../hash.js';
import { FileDatasetRepository } from '../repository.js';
import { getDataset, prepareDataset, type ValidationResult } from '../registry.js';

export interface GenerateOptions {
  dataset_code: string;
  seed: number;
  version?: number;
  out_dir: string;
  tenant_id: string;
}

export interface GenerateResult extends WriteArtifactsResult {
  dataset_code: string;
  dataset_id: string;
  run_id: string;
  validation: ValidationResult;
  reused: boolean;
}

function keyFor(datasetCode: string, version: number, seed: number, tenantId: string): string {
  return `${datasetCode}:${version}:${seed}:${tenantId}`;
}

export function generateDataset(options: GenerateOptions): GenerateResult {
  const definition = getDataset(options.dataset_code);
  if (!definition) {
    throw new Error(`Dataset not found: ${options.dataset_code}`);
  }

  const version = options.version ?? definition.metadata.version;
  const prepared = prepareDataset(definition, options.seed, version, options.tenant_id);
  const runId = computeRunId(prepared.context.dataset_id, options.tenant_id);
  const repository = new FileDatasetRepository(options.out_dir);
  const key = keyFor(options.dataset_code, version, options.seed, options.tenant_id);
  const existing = repository.getByKey(key);

  const saved = repository.save({
    key,
    dataset_id: prepared.context.dataset_id,
    run_id: runId,
    dataset_code: options.dataset_code,
    version,
    seed: options.seed,
    tenant_id: options.tenant_id,
    recorded_at: prepared.context.recorded_at,
    artifacts_dir: join(options.out_dir, runId),
  });

  const validation = definition.validate(prepared.items, prepared.labels, prepared.context);

  const output = writeArtifacts({
    out_dir: options.out_dir,
    run: {
      run_id: saved.run_id,
      dataset_id: saved.dataset_id,
      dataset_code: options.dataset_code,
      version,
      seed: options.seed,
      schema_version: definition.metadata.schema_version,
      tenant_id: options.tenant_id,
      trace_id: prepared.context.trace_id,
      recorded_at: prepared.context.recorded_at,
    },
    dataset: definition.metadata,
    items: prepared.items,
    labels: prepared.labels,
    checks: validation.checks,
  });

  return {
    ...output,
    dataset_code: options.dataset_code,
    dataset_id: saved.dataset_id,
    run_id: saved.run_id,
    validation,
    reused: Boolean(existing),
  };
}
