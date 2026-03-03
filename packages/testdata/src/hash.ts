import { createHash } from 'crypto';
import { canonicalJsonStringify } from './canonical_json.js';
import type { CanonicalValue } from './registry.js';

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function stableHash(value: CanonicalValue): string {
  return sha256(canonicalJsonStringify(value));
}

export function shortStableHash(value: CanonicalValue, length = 16): string {
  return stableHash(value).slice(0, length);
}

export function computeDatasetId(
  datasetCode: string,
  version: number,
  seed: number,
  schemaVersion: string,
): string {
  return `ds_${shortStableHash({ datasetCode, version, seed, schemaVersion })}`;
}

export function computeRunId(datasetId: string, tenantId: string): string {
  return `run_${shortStableHash({ datasetId, tenantId })}`;
}
