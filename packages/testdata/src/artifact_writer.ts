import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalJsonPretty, canonicalJsonStringify, canonicalJsonl, canonicalize } from './canonical_json.js';
import { sha256 } from './hash.js';
import type { CanonicalValue, DatasetItem, DatasetLabel, DatasetMetadata, ValidationCheck } from './registry.js';

export interface RunInfo {
  run_id: string;
  dataset_id: string;
  dataset_code: string;
  version: number;
  seed: number;
  schema_version: string;
  tenant_id: string;
  trace_id: string;
  recorded_at: string;
}

export interface ManifestFile {
  name: string;
  bytes: number;
  sha256: string;
  lines?: number;
}

export interface Manifest {
  run: RunInfo;
  dataset: DatasetMetadata;
  files: ManifestFile[];
  checks: ValidationCheck[];
}

export interface WriteArtifactsInput {
  out_dir: string;
  run: RunInfo;
  dataset: DatasetMetadata;
  items: DatasetItem[];
  labels: DatasetLabel[];
  checks: ValidationCheck[];
}

export interface WriteArtifactsResult {
  run_dir: string;
  manifest: Manifest;
}

function lineCount(content: string): number {
  if (!content) {
    return 0;
  }
  return content.split('\n').filter((line) => line.length > 0).length;
}

function createFileEntry(name: string, content: string): ManifestFile {
  const entry: ManifestFile = {
    name,
    bytes: Buffer.byteLength(content, 'utf8'),
    sha256: sha256(content),
  };
  if (name.endsWith('.jsonl')) {
    entry.lines = lineCount(content);
  }
  return entry;
}

export function writeArtifacts(input: WriteArtifactsInput): WriteArtifactsResult {
  const runDir = join(input.out_dir, input.run.run_id);
  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true });
  }

  const datasetPayload = canonicalize({
    dataset_id: input.run.dataset_id,
    dataset_code: input.run.dataset_code,
    version: input.run.version,
    seed: input.run.seed,
    schema_version: input.run.schema_version,
    metadata: input.dataset,
    item_count: input.items.length,
    label_count: input.labels.length,
  } as unknown as CanonicalValue);

  const checksPayload = canonicalize({
    trace_id: input.run.trace_id,
    checks: input.checks,
  } as unknown as CanonicalValue);

  const itemsContent = canonicalJsonl(input.items as unknown as CanonicalValue[]);
  const labelsContent = canonicalJsonl(input.labels as unknown as CanonicalValue[]);
  const datasetContent = canonicalJsonPretty(datasetPayload);
  const checksContent = canonicalJsonPretty(checksPayload);

  const files: ManifestFile[] = [
    createFileEntry('checks.json', checksContent),
    createFileEntry('dataset.json', datasetContent),
    createFileEntry('items.jsonl', itemsContent),
    createFileEntry('labels.jsonl', labelsContent),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const manifest: Manifest = {
    run: input.run,
    dataset: input.dataset,
    files,
    checks: input.checks,
  };

  const manifestContent = canonicalJsonPretty(canonicalize(manifest as unknown as CanonicalValue));

  writeFileSync(join(runDir, 'items.jsonl'), itemsContent, 'utf8');
  writeFileSync(join(runDir, 'labels.jsonl'), labelsContent, 'utf8');
  writeFileSync(join(runDir, 'dataset.json'), datasetContent, 'utf8');
  writeFileSync(join(runDir, 'checks.json'), checksContent, 'utf8');
  writeFileSync(join(runDir, 'manifest.json'), manifestContent, 'utf8');

  return { run_dir: runDir, manifest };
}

export function hashManifest(manifest: Manifest): string {
  return sha256(canonicalJsonStringify(canonicalize(manifest as unknown as CanonicalValue)));
}
