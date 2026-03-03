import { mkdirSync, readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { datasetItemSchema, datasetRunSchema, datasetSchema, type Dataset, type DatasetItem, type DatasetRun } from './types.js';

const root = process.env.REQUIEM_FOUNDRY_DIR ?? path.join('.requiem', 'foundry');

function ensureRoot(): void {
  mkdirSync(root, { recursive: true });
}

function fileFor(name: string): string {
  ensureRoot();
  return path.join(root, `${name}.ndjson`);
}

function readNdjson<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8').trim();
  if (!text) return [];
  return text.split('\n').map(line => JSON.parse(line) as T);
}

function appendNdjson(file: string, value: unknown): void {
  appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

export class DatasetsRepo {
  private readonly file = fileFor('datasets');

  list(): Dataset[] {
    return readNdjson<Dataset>(this.file)
      .map(v => datasetSchema.parse(v))
      .sort((a, b) => a.dataset_id.localeCompare(b.dataset_id));
  }

  upsert(dataset: Dataset): void {
    const parsed = datasetSchema.parse(dataset);
    const all = this.list().filter(d => d.dataset_id !== parsed.dataset_id);
    all.push(parsed);
    all.sort((a, b) => a.dataset_id.localeCompare(b.dataset_id));
    writeFileSync(this.file, all.map(v => JSON.stringify(v)).join('\n') + (all.length ? '\n' : ''), 'utf8');
  }

  get(datasetId: string): Dataset | undefined {
    return this.list().find(d => d.dataset_id === datasetId);
  }
}

export class DatasetItemsRepo {
  private readonly file = fileFor('dataset_items');

  list(datasetId?: string): DatasetItem[] {
    const all = readNdjson<DatasetItem>(this.file)
      .map(v => datasetItemSchema.parse(v))
      .sort((a, b) => a.item_id.localeCompare(b.item_id));
    return datasetId ? all.filter(i => i.dataset_id === datasetId) : all;
  }

  addMany(items: DatasetItem[]): void {
    const validated = items.map(v => datasetItemSchema.parse(v)).sort((a, b) => a.item_id.localeCompare(b.item_id));
    for (const item of validated) {
      appendNdjson(this.file, item);
    }
  }
}

export class DatasetRunsRepo {
  private readonly file = fileFor('dataset_runs');

  list(datasetId?: string): DatasetRun[] {
    const all = readNdjson<DatasetRun>(this.file)
      .map(v => datasetRunSchema.parse(v))
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    return datasetId ? all.filter(r => r.dataset_id === datasetId) : all;
  }

  add(run: DatasetRun): void {
    appendNdjson(this.file, datasetRunSchema.parse(run));
  }

  get(runId: string): DatasetRun | undefined {
    return this.list().find(v => v.dataset_run_id === runId);
  }
}
