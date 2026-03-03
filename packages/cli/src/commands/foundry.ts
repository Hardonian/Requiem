import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatasetItemsRepo, DatasetsRepo, DatasetRunsRepo } from '../foundry/repo.js';
import { generateVectorDataset, runDataset } from '../foundry/vectors.js';
import { stableHash, stableId, type Dataset, type DatasetItem } from '../foundry/types.js';

function csv(rows: string[][]): string {
  return rows.map(r => r.map(v => JSON.stringify(v)).join(',')).join('\n');
}

function parseFlag(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name);
  if (i < 0 || i + 1 >= args.length) return fallback;
  return args[i + 1];
}

function createDataset(type: Dataset['dataset_type'], name: string, items: DatasetItem[], tags: string[]): Dataset {
  const repo = new DatasetsRepo();
  const itemRepo = new DatasetItemsRepo();
  const datasetId = stableId('dataset', { type, name, count: items.length });
  const withId = items.map(item => ({ ...item, dataset_id: datasetId }));
  const dataset: Dataset = {
    dataset_id: datasetId,
    name,
    dataset_type: type,
    tenant_scope: 'GLOBAL',
    created_at: new Date().toISOString(),
    seed_policy: { seeds: [...new Set(withId.map(i => i.reproducibility.seed))].sort((a, b) => a - b) },
    items_count: withId.length,
    tags,
    dataset_version: 1,
  };
  repo.upsert(dataset);
  itemRepo.addMany(withId);
  return dataset;
}

function mineGit(args: string[]): Dataset {
  const limit = Number.parseInt(parseFlag(args, '--limit', '20'), 10);
  const seed = Number.parseInt(parseFlag(args, '--seed', '1'), 10);
  const commits = execSync(`git log --pretty=format:%H::%s -n ${limit}`, { encoding: 'utf8' })
    .trim().split('\n')
    .map(v => v.trim())
    .filter(Boolean)
    .filter(v => /fix|bug|hotfix|regression|revert|ci|build/i.test(v.split('::')[1] ?? ''))
    .sort((a, b) => a.localeCompare(b));

  const items: DatasetItem[] = commits.map((row, index) => {
    const [commit, subject] = row.split('::');
    const parent = execSync(`git rev-parse ${commit}^`, { encoding: 'utf8' }).trim();
    const fingerprint = stableHash({ parent, commit, subject, seed, index });
    return {
      item_id: stableId('gitfix', { commit, seed }),
      dataset_id: '',
      label: subject,
      kind: 'GIT_FIX_CASE',
      input_ref: { commit, parent, command_set: ['pnpm run verify:routes'] },
      expected_outcome: { result: 'PASS', invariants: ['parent_fails_commit_passes', 'no_500', 'problem_json', 'tenant_isolation'] },
      reproducibility: { seed, config_hash: fingerprint },
      dataset_item_version: 1,
    };
  });

  return createDataset('GIT_MINED', 'git_mined_fixes', items, ['git', 'regression']);
}

function generateMetamorphic(args: string[]): Dataset {
  const base = parseFlag(args, '--base-suite', 'core_vectors');
  const per = Number.parseInt(parseFlag(args, '--per', '3'), 10);
  const seed = Number.parseInt(parseFlag(args, '--seed', '1'), 10);
  const ds = new DatasetsRepo().list().find(v => v.name === base);
  if (!ds) throw new Error(`Base dataset not found: ${base}`);
  const baseItems = new DatasetItemsRepo().list(ds.dataset_id);
  const transforms = ['whitespace_normalization', 'json_key_reorder', 'safe_toggle'];

  const items: DatasetItem[] = baseItems.flatMap((item, i) => transforms.slice(0, per).map((transform, idx) => ({
    item_id: stableId('meta', { item: item.item_id, transform, idx, seed }),
    dataset_id: '',
    label: `${item.label}:${transform}`,
    kind: 'METAMORPHIC_VARIANT',
    input_ref: { base_item_id: item.item_id, transform },
    expected_outcome: { result: 'PASS', invariants: ['no_500', 'schema_equivalent', 'policy_equivalent'] },
    reproducibility: { seed: seed + i + idx, config_hash: stableHash({ item: item.item_id, transform, seed }) },
    dataset_item_version: 1,
  })));

  return createDataset('METAMORPHIC', 'metamorphic_suite', items, ['metamorphic', 'robustness']);
}

function generateFaultSuite(): Dataset {
  const scenarios = [
    'cas_read_fail_should_emit_event_and_not_crash',
    'budget_exceeded_should_deny_with_problem_json',
    'trace_corrupt_should_fail_verify_not_crash_ui',
  ];
  const items: DatasetItem[] = scenarios.map((label, i) => ({
    item_id: stableId('fault', { label }),
    dataset_id: '',
    label,
    kind: 'FAULT_INJECTION_SCENARIO',
    input_ref: { env_flag: 'FOUNDRY_FAULTS=1', scenario: label },
    expected_outcome: { result: 'PASS', expected_error_type: 'fault_injected', invariants: ['problem_json', 'no_500'] },
    reproducibility: { seed: i + 1, config_hash: stableHash(label) },
    dataset_item_version: 1,
  }));

  return createDataset('FAULT_INJECTION', 'fault_injection_suite', items, ['faults', 'resilience']);
}

export async function runFoundryCommand(args: string[]): Promise<number> {
  const [topic, sub] = args;
  if (topic === 'bootstrap') {
    const ds = generateVectorDataset('core_vectors', [1, 2, 3]);
    const vectorRun = runDataset(ds.dataset_id);
    const metamorphic = generateMetamorphic(['--base-suite', 'core_vectors', '--per', '2', '--seed', '1']);
    const metamorphicRun = runDataset(metamorphic.dataset_id);
    mkdirSync(path.join('artifacts', 'foundry'), { recursive: true });
    writeFileSync(path.join('artifacts', 'foundry', 'bootstrap.json'), JSON.stringify({ ds, vectorRun, metamorphic, metamorphicRun }, null, 2));
    process.stdout.write(`foundry bootstrap complete: ${ds.dataset_id} ${metamorphic.dataset_id}\n`);
    return 0;
  }

  if (topic === 'vectors' && sub === 'list') {
    const vectors = readdirSync('vectors').filter(v => v.endsWith('.json')).sort();
    process.stdout.write(JSON.stringify({ vectors }, null, 2) + '\n');
    return 0;
  }

  if (topic === 'vectors' && sub === 'run') {
    const seeds = parseFlag(args, '--seeds', '1,2,3').split(',').map(v => Number.parseInt(v, 10)).filter(Number.isFinite);
    const ds = generateVectorDataset('core_vectors', seeds);
    const run = runDataset(ds.dataset_id);
    process.stdout.write(JSON.stringify(run, null, 2) + '\n');
    return run.summary.fail_count > 0 ? 1 : 0;
  }

  if (topic === 'git' && sub === 'mine') {
    const ds = mineGit(args);
    process.stdout.write(JSON.stringify(ds, null, 2) + '\n');
    return 0;
  }

  if (topic === 'metamorphic' && sub === 'generate') {
    const ds = generateMetamorphic(args);
    process.stdout.write(JSON.stringify(ds, null, 2) + '\n');
    return 0;
  }

  if (topic === 'faults' && sub === 'run') {
    if (process.env.FOUNDRY_FAULTS !== '1') {
      process.stderr.write('FOUNDRY_FAULTS=1 is required for fault suite\n');
      return 1;
    }
    const ds = generateFaultSuite();
    const run = runDataset(ds.dataset_id);
    process.stdout.write(JSON.stringify(run, null, 2) + '\n');
    return run.summary.fail_count > 0 ? 1 : 0;
  }

  if (topic === 'run') {
    const datasetId = parseFlag(args, '--dataset', '');
    const run = runDataset(datasetId);
    process.stdout.write(JSON.stringify(run, null, 2) + '\n');
    return run.summary.fail_count > 0 ? 1 : 0;
  }

  if (topic === 'report' || (topic === 'vectors' && sub === 'report') || (topic === 'git' && sub === 'report')) {
    const runs = new DatasetRunsRepo().list();
    process.stdout.write(JSON.stringify({ runs: runs.slice(0, Number.parseInt(parseFlag(args, '--last', '1'), 10)) }, null, 2) + '\n');
    return 0;
  }

  if (topic === 'export' || (topic === 'vectors' && sub === 'export')) {
    const datasetName = parseFlag(args, '--dataset', 'core_vectors');
    const format = parseFlag(args, '--format', 'json');
    const dataset = new DatasetsRepo().list().find(v => v.name === datasetName);
    if (!dataset) throw new Error(`Unknown dataset: ${datasetName}`);
    const items = new DatasetItemsRepo().list(dataset.dataset_id);
    mkdirSync(path.join('artifacts', 'foundry'), { recursive: true });
    if (format === 'csv') {
      const out = path.join('artifacts', 'foundry', 'foundry_report.csv');
      writeFileSync(out, csv([['item_id', 'label', 'kind'], ...items.map(i => [i.item_id, i.label, i.kind])]));
      process.stdout.write(`${out}\n`);
    } else {
      const out = path.join('artifacts', 'foundry', 'foundry_report.json');
      writeFileSync(out, JSON.stringify({ dataset, items }, null, 2));
      process.stdout.write(`${out}\n`);
    }
    return 0;
  }

  if (topic === 'generate') {
    const ds = generateVectorDataset('core_vectors', [1, 2, 3]);
    process.stdout.write(JSON.stringify(ds, null, 2) + '\n');
    return 0;
  }

  if (topic === 'mine') {
    const ds = mineGit(args);
    process.stdout.write(JSON.stringify(ds, null, 2) + '\n');
    return 0;
  }

  process.stdout.write('Usage: requiem foundry <mine|generate|run|report|export|bootstrap|vectors|git|metamorphic|faults> ...\n');
  return 1;
}
