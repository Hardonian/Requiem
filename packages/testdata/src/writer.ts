/**
 * Artifact writer for test data foundry.
 * Writes artifacts to ./artifacts/<run_id>/ with manifest.json, dataset.json, items.jsonl, labels.jsonl, checks.json
 */

import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import type { CanonicalValue } from './canonical.js';
import type { DatasetMetadata, DatasetItem, ItemLabel, ValidationResult } from './registry.js';

/**
 * Run metadata.
 */
export interface RunMetadata {
  runId: string;
  datasetId: string;
  datasetCode: string;
  version: number;
  seed: number;
  timestamp: string;
  traceId: string;
  tenantId: string;
}

/**
 * Artifact manifest.
 */
export interface Manifest {
  run: RunMetadata;
  dataset: DatasetMetadata;
  files: ArtifactFile[];
  hashes: Record<string, string>;
}

/**
 * Artifact file entry.
 */
export interface ArtifactFile {
  name: string;
  type: 'json' | 'jsonl';
  size: number;
  hash: string;
  lineCount?: number;
}

/**
 * Check result.
 */
export interface CheckResult {
  check: string;
  passed: boolean;
  message?: string;
  details?: Record<string, CanonicalValue>;
}

/**
 * Artifact writer class.
 */
export class ArtifactWriter {
  private basePath: string;
  private runId: string;
  private datasetCode: string;
  private version: number;
  private seed: number;
  private timestamp: string;
  private traceId: string;
  private tenantId: string;
  private datasetMetadata?: DatasetMetadata;
  private items: DatasetItem[] = [];
  private labels: ItemLabel[] = [];
  private checks: CheckResult[] = [];
  private files: ArtifactFile[] = [];

  /**
   * Create artifact writer.
   */
  constructor(
    datasetCode: string,
    version: number,
    seed: number,
    options?: {
      basePath?: string;
      tenantId?: string;
    }
  ) {
    this.datasetCode = datasetCode;
    this.version = version;
    this.seed = seed;
    this.timestamp = new Date().toISOString();
    this.traceId = this.generateTraceId();
    this.runId = this.computeRunId();
    this.basePath = options?.basePath || './artifacts';
    this.tenantId = options?.tenantId || 'public-hardonian';
  }

  /**
   * Generate trace ID.
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Compute run ID from components.
   */
  private computeRunId(): string {
    const data = {
      datasetCode: this.datasetCode,
      version: this.version,
      seed: this.seed,
      timestamp: this.timestamp,
    };
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Get run ID.
   */
  getRunId(): string {
    return this.runId;
  }

  /**
   * Get trace ID.
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Set dataset metadata.
   */
  setDatasetMetadata(metadata: DatasetMetadata): void {
    this.datasetMetadata = metadata;
  }

  /**
   * Add an item.
   */
  addItem(item: DatasetItem): void {
    this.items.push(item);
  }

  /**
   * Add a label.
   */
  addLabel(label: ItemLabel): void {
    this.labels.push(label);
  }

  /**
   * Add a check result.
   */
  addCheck(check: CheckResult): void {
    this.checks.push(check);
  }

  /**
   * Compute hash of content.
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Ensure directory exists.
   */
  private ensureDir(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  /**
   * Write JSON file.
   */
  private writeJsonFile(name: string, data: unknown): ArtifactFile {
    const content = JSON.stringify(data, null, 2);
    const dir = join(this.basePath, this.runId);
    this.ensureDir(dir);
    const filePath = join(dir, name);
    writeFileSync(filePath, content, 'utf8');
    const hash = this.computeHash(content);
    this.files.push({
      name,
      type: 'json',
      size: content.length,
      hash,
    });
    return this.files[this.files.length - 1];
  }

  /**
   * Write JSONL file.
   */
  private writeJsonlFile(
    name: string,
    items: Record<string, unknown>[]
  ): ArtifactFile {
    const lines = items.map((item) => JSON.stringify(item));
    const content = lines.join('\n') + '\n';
    const dir = join(this.basePath, this.runId);
    this.ensureDir(dir);
    const filePath = join(dir, name);
    writeFileSync(filePath, content, 'utf8');
    const hash = this.computeHash(content);
    this.files.push({
      name,
      type: 'jsonl',
      size: content.length,
      hash,
      lineCount: lines.length,
    });
    return this.files[this.files.length - 1];
  }

  /**
   * Write all artifacts.
   */
  write(): Manifest {
    // Compute dataset ID
    const datasetId = this.computeDatasetId();

    // Build run metadata
    const runMetadata: RunMetadata = {
      runId: this.runId,
      datasetId,
      datasetCode: this.datasetCode,
      version: this.version,
      seed: this.seed,
      timestamp: this.timestamp,
      traceId: this.traceId,
      tenantId: this.tenantId,
    };

    // Write items.jsonl
    this.writeJsonlFile('items.jsonl', this.items);

    // Write labels.jsonl
    this.writeJsonlFile('labels.jsonl', this.labels as unknown as Record<string, unknown>[]);

    // Write checks.json
    this.writeJsonlFile('checks.json', { checks: this.checks } as unknown as Record<string, unknown>);

    // Write dataset.json
    const datasetJson = {
      metadata: this.datasetMetadata,
      itemCount: this.items.length,
    };
    this.writeJsonlFile('dataset.json', [datasetJson] as unknown as Record<string, unknown>[]);
    // Actually write as JSON not JSONL
    const datasetContent = JSON.stringify(datasetJson, null, 2);
    const dir = join(this.basePath, this.runId);
    const datasetPath = join(dir, 'dataset.json');
    writeFileSync(datasetPath, datasetContent, 'utf8');

    // Compute hashes
    const hashes: Record<string, string> = {};
    for (const file of this.files) {
      hashes[file.name] = file.hash;
    }

    // Write manifest.json
    const manifest: Manifest = {
      run: runMetadata,
      dataset: this.datasetMetadata!,
      files: this.files,
      hashes,
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    const manifestPath = join(dir, 'manifest.json');
    writeFileSync(manifestPath, manifestContent, 'utf8');

    return manifest;
  }

  /**
   * Compute dataset ID.
   */
  private computeDatasetId(): string {
    const data = {
      datasetCode: this.datasetCode,
      version: this.version,
      seed: this.seed,
    };
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Read artifact from run ID.
   */
  static read(runId: string, basePath?: string): {
    manifest: Manifest;
    items: DatasetItem[];
    labels: ItemLabel[];
    checks: CheckResult[];
  } {
    const dir = basePath ? join(basePath, runId) : join('./artifacts', runId);
    const manifestPath = join(dir, 'manifest.json');
    const manifestContent = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent) as Manifest;

    // Read items
    const itemsPath = join(dir, 'items.jsonl');
    const itemsContent = readFileSync(itemsPath, 'utf8');
    const items = itemsContent
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as DatasetItem);

    // Read labels
    const labelsPath = join(dir, 'labels.jsonl');
    const labelsContent = readFileSync(labelsPath, 'utf8');
    const labels = labelsContent
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as ItemLabel);

    // Read checks
    const checksPath = join(dir, 'checks.json');
    const checksContent = readFileSync(checksPath, 'utf8');
    const checksData = JSON.parse(checksContent);
    const checks = checksData.checks as CheckResult[];

    return { manifest, items, labels, checks };
  }
}
