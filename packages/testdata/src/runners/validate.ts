import { computeRunId } from '../hash.js';
import { getDataset, prepareDataset, type ValidationResult } from '../registry.js';

export interface ValidateOptions {
  dataset_code: string;
  seed: number;
  version?: number;
  tenant_id: string;
}

export interface ValidateOutput {
  dataset_code: string;
  dataset_id: string;
  run_id: string;
  result: ValidationResult;
}

export function validateDataset(options: ValidateOptions): ValidateOutput {
  const definition = getDataset(options.dataset_code);
  if (!definition) {
    throw new Error(`Dataset not found: ${options.dataset_code}`);
  }

  const version = options.version ?? definition.metadata.version;
  const prepared = prepareDataset(definition, options.seed, version, options.tenant_id);
  const result = definition.validate(prepared.items, prepared.labels, prepared.context);

  return {
    dataset_code: options.dataset_code,
    dataset_id: prepared.context.dataset_id,
    run_id: computeRunId(prepared.context.dataset_id, options.tenant_id),
    result,
  };
}
