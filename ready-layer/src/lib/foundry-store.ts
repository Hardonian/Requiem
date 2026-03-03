import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

type Dict = Record<string, unknown>;

function readNdjson(file: string): Dict[] {
  if (!existsSync(file)) return [];
  const content = readFileSync(file, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').map(line => JSON.parse(line) as Dict);
}

const root = process.env.REQUIEM_FOUNDRY_DIR ?? path.join(process.cwd(), '.requiem', 'foundry');

export function listDatasets(): Dict[] {
  return readNdjson(path.join(root, 'datasets.ndjson'));
}

export function getDataset(id: string): Dict | undefined {
  return listDatasets().find(d => d.dataset_id === id);
}

export function listRuns(datasetId?: string): Dict[] {
  const runs = readNdjson(path.join(root, 'dataset_runs.ndjson'));
  return datasetId ? runs.filter(r => r.dataset_id === datasetId) : runs;
}

export function getRun(id: string): Dict | undefined {
  return listRuns().find(r => r.dataset_run_id === id);
}
