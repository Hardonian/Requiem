import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { canonicalJsonStringify, canonicalize } from '../canonical_json.js';
import { sha256 } from '../hash.js';
import { FileDatasetRepository } from '../repository.js';
import { getDataset, prepareDataset, type CanonicalValue } from '../registry.js';

export interface ReplayOptions {
  id: string;
  out_dir: string;
  tenant_id: string;
}

export interface ReplayResult {
  run_id: string;
  dataset_id: string;
  manifest_hash: string;
  replay_hash: string;
  ok: boolean;
  checks: Array<{ name: string; passed: boolean; details: Record<string, CanonicalValue> }>;
}

function toJsonl(items: CanonicalValue[]): string {
  if (items.length === 0) {
    return '';
  }
  return `${items.map((item) => canonicalJsonStringify(canonicalize(item))).join('\n')}\n`;
}

export function replayDataset(options: ReplayOptions): ReplayResult {
  const repository = new FileDatasetRepository(options.out_dir);
  const record = repository.getByRunId(options.id) ?? repository.getByDatasetId(options.id);
  if (!record) {
    throw new Error(`Run or dataset not found: ${options.id}`);
  }

  const runDir = join(options.out_dir, record.run_id);
  const manifestPath = join(runDir, 'manifest.json');
  const itemsPath = join(runDir, 'items.jsonl');
  const labelsPath = join(runDir, 'labels.jsonl');

  if (![manifestPath, itemsPath, labelsPath].every((p) => existsSync(p))) {
    throw new Error(`Missing artifacts for run: ${record.run_id}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    run: { dataset_code: string; version: number; seed: number };
  };
  const definition = getDataset(manifest.run.dataset_code);
  if (!definition) {
    throw new Error(`Dataset not registered: ${manifest.run.dataset_code}`);
  }

  const prepared = prepareDataset(definition, manifest.run.seed, manifest.run.version, options.tenant_id);
  const replayValidation = definition.validate(prepared.items, prepared.labels, prepared.context);

  const actualItemsHash = sha256(readFileSync(itemsPath, 'utf8'));
  const actualLabelsHash = sha256(readFileSync(labelsPath, 'utf8'));
  const expectedItemsHash = sha256(toJsonl(prepared.items as unknown as CanonicalValue[]));
  const expectedLabelsHash = sha256(toJsonl(prepared.labels as unknown as CanonicalValue[]));

  const manifestHash = sha256(canonicalJsonStringify(canonicalize(JSON.parse(readFileSync(manifestPath, 'utf8')) as CanonicalValue)));
  const replayHash = sha256(
    canonicalJsonStringify(
      canonicalize({
        run_id: record.run_id,
        dataset_id: record.dataset_id,
        items_hash: actualItemsHash,
        labels_hash: actualLabelsHash,
        expected_items_hash: expectedItemsHash,
        expected_labels_hash: expectedLabelsHash,
        replay_valid: replayValidation.valid,
      } as unknown as CanonicalValue),
    ),
  );

  const checks: Array<{ name: string; passed: boolean; details: Record<string, CanonicalValue> }> = [
    {
      name: 'items_hash_matches',
      passed: actualItemsHash === expectedItemsHash,
      details: { actual: actualItemsHash, expected: expectedItemsHash },
    },
    {
      name: 'labels_hash_matches',
      passed: actualLabelsHash === expectedLabelsHash,
      details: { actual: actualLabelsHash, expected: expectedLabelsHash },
    },
    {
      name: 'validator_passed',
      passed: replayValidation.valid,
      details: { errors: replayValidation.errors.length },
    },
  ];

  return {
    run_id: record.run_id,
    dataset_id: record.dataset_id,
    manifest_hash: manifestHash,
    replay_hash: replayHash,
    ok: checks.every((check) => check.passed),
    checks,
  };
}
