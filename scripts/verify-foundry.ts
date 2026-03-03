import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { DatasetItemsRepo, DatasetsRepo } from '../packages/cli/src/foundry/repo.js';
import { stableId } from '../packages/cli/src/foundry/types.js';
import { generateVectorDataset } from '../packages/cli/src/foundry/vectors.js';

const dir = path.join(process.cwd(), '.tmp-foundry-verify');
process.env.REQUIEM_FOUNDRY_DIR = dir;
rmSync(dir, { recursive: true, force: true });

const first = stableId('dataset', { a: 1 });
const second = stableId('dataset', { a: 1 });
assert.equal(first, second, 'stable ids must be deterministic');

const ds = generateVectorDataset('core_vectors', [1]);
const datasets = new DatasetsRepo().list();
assert.ok(datasets.some(v => v.dataset_id === ds.dataset_id), 'dataset persisted');

const items = new DatasetItemsRepo().list(ds.dataset_id);
const sorted = [...items].sort((a, b) => a.item_id.localeCompare(b.item_id)).map(v => v.item_id);
assert.deepEqual(items.map(v => v.item_id), sorted, 'items are stably ordered');

console.log('foundry verify passed');
