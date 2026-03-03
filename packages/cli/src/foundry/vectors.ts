import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { DatasetItemsRepo, DatasetsRepo, DatasetRunsRepo } from './repo.js';
import { stableHash, stableId, type Dataset, type DatasetItem, type DatasetRun } from './types.js';

interface VectorSpec {
  name: string;
  description: string;
  entrypoint: { command: string; args: string[] };
  assertions: string[];
  seeds: number[];
  tags: string[];
}

const vectorsDir = path.join(process.cwd(), 'vectors');
const artifactsDir = path.join('artifacts', 'foundry');

export function listVectorSpecs(): VectorSpec[] {
  if (!existsSync(vectorsDir)) return [];
  const files = readdirSync(vectorsDir).filter(v => v.endsWith('.json')).sort();
  return files.flatMap(file => {
    const raw = JSON.parse(readFileSync(path.join(vectorsDir, file), 'utf8')) as { vectors: VectorSpec[] };
    return raw.vectors;
  });
}

export function generateVectorDataset(name = 'core_vectors', seeds = [1, 2, 3]): Dataset {
  const datasets = new DatasetsRepo();
  const itemsRepo = new DatasetItemsRepo();
  const vectors = listVectorSpecs();
  const datasetId = stableId('dataset', { name, seeds, vectors: vectors.map(v => v.name) });
  const items: DatasetItem[] = vectors.flatMap(spec => seeds.map(seed => {
    const cfg = { spec, seed };
    return {
      item_id: stableId('item', cfg),
      dataset_id: datasetId,
      label: `${spec.name}#${seed}`,
      kind: 'VECTOR_RUN',
      input_ref: { vector: spec },
      expected_outcome: { result: 'PASS', invariants: spec.assertions },
      reproducibility: { seed, config_hash: stableHash(cfg) },
      dataset_item_version: 1,
    };
  }));

  const dataset: Dataset = {
    dataset_id: datasetId,
    name,
    dataset_type: 'VECTORS',
    tenant_scope: 'GLOBAL',
    created_at: new Date().toISOString(),
    seed_policy: { seeds },
    items_count: items.length,
    tags: ['big4', 'routes', 'regression'],
    dataset_version: 1,
  };

  datasets.upsert(dataset);
  itemsRepo.addMany(items);
  return dataset;
}

export function runDataset(datasetId: string): DatasetRun {
  const datasets = new DatasetsRepo();
  const itemsRepo = new DatasetItemsRepo();
  const runsRepo = new DatasetRunsRepo();
  const dataset = datasets.get(datasetId);
  if (!dataset) throw new Error(`Dataset not found: ${datasetId}`);
  const items = itemsRepo.list(datasetId);

  mkdirSync(artifactsDir, { recursive: true });
  const started = new Date().toISOString();
  const itemResults: DatasetRun['item_results'] = [];

  for (const item of items.sort((a, b) => a.item_id.localeCompare(b.item_id))) {
    const vector = item.input_ref.vector as VectorSpec;
    const command = [vector.entrypoint.command, ...vector.entrypoint.args].join(' ');
    const run = spawnSync(command, { shell: true, encoding: 'utf8' });
    const status = run.status === 0 ? 'PASS' : 'FAIL';
    const traceId = randomUUID();
    const artifact = path.join(artifactsDir, `${item.item_id}.log`);
    writeFileSync(artifact, `# ${command}\n\nstdout:\n${run.stdout}\n\nstderr:\n${run.stderr}\n`, 'utf8');
    itemResults.push({ item_id: item.item_id, status, trace_id: traceId, details: `${command} => ${status}`, artifact });
  }

  const passCount = itemResults.filter(v => v.status === 'PASS').length;
  const run: DatasetRun = {
    dataset_run_id: stableId('run', { datasetId, started }),
    dataset_id: datasetId,
    started_at: started,
    finished_at: new Date().toISOString(),
    git_commit: spawnSync('git rev-parse HEAD', { shell: true, encoding: 'utf8' }).stdout.trim(),
    environment: process.env.CI ? 'ci' : 'local',
    summary: {
      pass_count: passCount,
      fail_count: itemResults.length - passCount,
      avg_cost_units: 0,
      drift_counts: { none: itemResults.length },
      flake_suspects: [],
    },
    pointers: {
      run_ids: itemResults.map(v => v.item_id),
      artifacts: itemResults.map(v => v.artifact).filter(Boolean) as string[],
    },
    dataset_run_version: 1,
    item_results: itemResults,
  };

  runsRepo.add(run);
  return run;
}
