import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { canonicalJsonPretty, canonicalize } from './canonical_json.js';
import type { CanonicalValue } from './registry.js';

export interface DatasetRecord {
  key: string;
  dataset_id: string;
  run_id: string;
  dataset_code: string;
  version: number;
  seed: number;
  tenant_id: string;
  recorded_at: string;
  artifacts_dir: string;
}

interface RepositoryState {
  schema_version: string;
  records: DatasetRecord[];
}

export interface DatasetRepository {
  getByKey(key: string): DatasetRecord | undefined;
  getByRunId(runId: string): DatasetRecord | undefined;
  getByDatasetId(datasetId: string): DatasetRecord | undefined;
  save(record: DatasetRecord): DatasetRecord;
}

function stableSortRecords(records: DatasetRecord[]): DatasetRecord[] {
  return [...records].sort((a, b) => a.key.localeCompare(b.key));
}

export class FileDatasetRepository implements DatasetRepository {
  private readonly filePath: string;

  constructor(baseDir: string) {
    const storeDir = join(baseDir, '.foundry-store');
    this.filePath = join(storeDir, 'index.json');
    if (!existsSync(storeDir)) {
      mkdirSync(storeDir, { recursive: true });
    }
    if (!existsSync(this.filePath)) {
      const initial: RepositoryState = { schema_version: '1.0.0', records: [] };
      writeFileSync(this.filePath, canonicalJsonPretty(initial as unknown as CanonicalValue), 'utf8');
    }
  }

  private readState(): RepositoryState {
    const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as RepositoryState;
    return {
      schema_version: parsed.schema_version,
      records: stableSortRecords(parsed.records),
    };
  }

  private writeState(state: RepositoryState): void {
    const normalized: RepositoryState = {
      schema_version: state.schema_version,
      records: stableSortRecords(state.records),
    };
    writeFileSync(
      this.filePath,
      canonicalJsonPretty(canonicalize(normalized as unknown as CanonicalValue)),
      'utf8',
    );
  }

  getByKey(key: string): DatasetRecord | undefined {
    return this.readState().records.find((record) => record.key === key);
  }

  getByRunId(runId: string): DatasetRecord | undefined {
    return this.readState().records.find((record) => record.run_id === runId);
  }

  getByDatasetId(datasetId: string): DatasetRecord | undefined {
    return this.readState().records.find((record) => record.dataset_id === datasetId);
  }

  save(record: DatasetRecord): DatasetRecord {
    const state = this.readState();
    const existing = state.records.find((r) => r.key === record.key);
    if (existing) {
      return existing;
    }
    state.records.push(record);
    this.writeState(state);
    return record;
  }
}
