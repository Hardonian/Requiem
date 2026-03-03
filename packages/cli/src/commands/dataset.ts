import {
  generateDataset,
  listDatasets,
  registerBuiltInDatasets,
  replayDataset,
  validateDataset,
} from '../../../testdata/src/index.js';

interface DatasetCliOptions {
  json?: boolean;
}

interface ParsedOptions {
  seed: number;
  out: string;
  version?: number;
}

function parseOptions(args: string[]): ParsedOptions {
  const parsed: ParsedOptions = {
    seed: 1337,
    out: 'artifacts',
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === '--seed' && args[i + 1]) {
      parsed.seed = Number.parseInt(args[i + 1], 10);
      i += 1;
      continue;
    }
    if (token === '--out' && args[i + 1]) {
      parsed.out = args[i + 1];
      i += 1;
      continue;
    }
    if (token === '--version' && args[i + 1]) {
      parsed.version = Number.parseInt(args[i + 1], 10);
      i += 1;
    }
  }

  return parsed;
}

function tenantFromEnv(): string {
  return process.env.RL_TENANT_ID ?? 'public-hardonian';
}

function writeJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

export async function runDataset(
  subcommand: string,
  args: string[],
  opts: DatasetCliOptions = {},
): Promise<void> {
  registerBuiltInDatasets();

  switch (subcommand) {
    case 'list': {
      const datasets = listDatasets();
      if (opts.json) {
        writeJson({ datasets });
        return;
      }
      for (const dataset of datasets) {
        process.stdout.write(
          `${dataset.code}\tversion=${dataset.version}\titems=${dataset.item_count}\tschema=${dataset.schema_version}\n`,
        );
      }
      process.stdout.write(`total=${datasets.length}\n`);
      return;
    }

    case 'gen': {
      const code = args[0];
      if (!code) {
        throw new Error('Usage: rl dataset gen <CODE> --seed <n> [--out artifacts]');
      }
      const parsed = parseOptions(args.slice(1));
      const generated = generateDataset({
        dataset_code: code,
        seed: parsed.seed,
        version: parsed.version,
        out_dir: parsed.out,
        tenant_id: tenantFromEnv(),
      });

      if (opts.json) {
        writeJson({
          dataset_code: generated.dataset_code,
          dataset_id: generated.dataset_id,
          run_id: generated.run_id,
          run_dir: generated.run_dir,
          reused: generated.reused,
          valid: generated.validation.valid,
          errors: generated.validation.errors,
        });
        return;
      }

      process.stdout.write(`dataset_code=${generated.dataset_code}\n`);
      process.stdout.write(`dataset_id=${generated.dataset_id}\n`);
      process.stdout.write(`run_id=${generated.run_id}\n`);
      process.stdout.write(`run_dir=${generated.run_dir}\n`);
      process.stdout.write(`reused=${generated.reused}\n`);
      process.stdout.write(`valid=${generated.validation.valid}\n`);
      return;
    }

    case 'validate': {
      const code = args[0];
      if (!code) {
        throw new Error('Usage: rl dataset validate <CODE> --seed <n>');
      }
      const parsed = parseOptions(args.slice(1));
      const validation = validateDataset({
        dataset_code: code,
        seed: parsed.seed,
        version: parsed.version,
        tenant_id: tenantFromEnv(),
      });

      if (opts.json) {
        writeJson(validation);
        return;
      }

      process.stdout.write(`dataset_code=${validation.dataset_code}\n`);
      process.stdout.write(`dataset_id=${validation.dataset_id}\n`);
      process.stdout.write(`run_id=${validation.run_id}\n`);
      process.stdout.write(`valid=${validation.result.valid}\n`);
      process.stdout.write(`errors=${validation.result.errors.length}\n`);
      process.stdout.write(`warnings=${validation.result.warnings.length}\n`);
      return;
    }

    case 'replay': {
      const id = args[0];
      if (!id) {
        throw new Error('Usage: rl dataset replay <run_id|dataset_id> [--out artifacts]');
      }
      const parsed = parseOptions(args.slice(1));
      const replay = replayDataset({
        id,
        out_dir: parsed.out,
        tenant_id: tenantFromEnv(),
      });

      if (opts.json) {
        writeJson(replay);
        return;
      }

      process.stdout.write(`run_id=${replay.run_id}\n`);
      process.stdout.write(`dataset_id=${replay.dataset_id}\n`);
      process.stdout.write(`manifest_hash=${replay.manifest_hash}\n`);
      process.stdout.write(`replay_hash=${replay.replay_hash}\n`);
      process.stdout.write(`ok=${replay.ok}\n`);
      return;
    }

    default:
      throw new Error(`Unknown dataset subcommand: ${subcommand}`);
  }
}
