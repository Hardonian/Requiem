import { createDefaultAdapters } from '../../../adapters/index.js';

export async function runInterop(subcommand: string, args: string[], opts: { json: boolean }): Promise<number> {
  if (subcommand !== 'ingest') {
    throw new Error('Usage: rl interop ingest <github|sentry> --payload <json>');
  }

  const source = args[0];
  const payloadFlag = args.indexOf('--payload');
  if (!source || payloadFlag === -1 || !args[payloadFlag + 1]) {
    throw new Error('Usage: rl interop ingest <github|sentry> --payload <json>');
  }

  const payload = JSON.parse(args[payloadFlag + 1] as string) as unknown;
  const adapters = createDefaultAdapters();
  const adapter = source === 'github' ? adapters.github : source === 'sentry' ? adapters.sentry : null;
  if (!adapter) {
    throw new Error(`Unsupported interop source: ${source}`);
  }

  const normalized = adapter.normalize(payload);
  const receipt = adapter.emit(normalized.event);
  const output = {
    event: normalized.event,
    artifacts: normalized.artifacts,
    receipt,
  };

  process.stdout.write(opts.json ? `${JSON.stringify(output, null, 2)}\n` : `${normalized.event.id}\n`);
  return 0;
}
