import { createRuntimeFingerprint, persistFingerprintToCAS } from '../lib/runtime-fingerprint.js';

interface RunSystemOptions {
  json: boolean;
}

export async function runSystem(subcommand: string, _args: string[], opts: RunSystemOptions): Promise<number> {
  if (subcommand !== 'fingerprint') {
    process.stderr.write(`Unknown system subcommand: ${subcommand}\n`);
    process.stderr.write('Usage: rl system fingerprint [--json]\n');
    return 1;
  }

  const fingerprint = createRuntimeFingerprint();
  const stored = persistFingerprintToCAS(fingerprint);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ ok: true, fingerprint, fingerprint_cas: stored.digest }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write('Runtime fingerprint\n');
  process.stdout.write(`  git_commit:              ${fingerprint.git_commit}\n`);
  process.stdout.write(`  invariants_spec_version: ${fingerprint.invariants_spec_version}\n`);
  process.stdout.write(`  policy_bundle_cas:       ${fingerprint.policy_bundle_cas}\n`);
  process.stdout.write(`  config_cas:              ${fingerprint.config_cas}\n`);
  process.stdout.write(`  replica_mode:            ${fingerprint.replica_mode}\n`);
  process.stdout.write(`  capabilities_mode:       ${fingerprint.capabilities_mode}\n`);
  process.stdout.write(`  intents_mode:            ${fingerprint.intents_mode}\n`);
  process.stdout.write(`  determinism_mode:        ${fingerprint.determinism_mode}\n`);
  process.stdout.write(`  fingerprint_cas:         ${stored.digest}\n`);
  process.stdout.write(`  cas_object_path:         ${stored.objectPath}\n`);

  return 0;
}
