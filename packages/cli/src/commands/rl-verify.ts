/**
 * CLI Command: requiem verify <proofpack.json>
 *
 * Verifies a proofpack's cryptographic integrity.
 * Output: VALID / INVALID with detailed check report.
 */

import { existsSync, readFileSync } from 'node:fs';

export async function runVerify(
  proofpackPath: string,
  args: string[],
  opts: { json: boolean },
): Promise<number> {
  if (!proofpackPath || proofpackPath === '--help' || proofpackPath === '-h') {
    process.stdout.write(`
Usage: rl verify <proofpack.json>

Verifies a proofpack's cryptographic integrity.

Options:
  --json    Output in JSON format
  --verbose Show all individual checks

Example:
  rl verify proofpacks/latest/proofpack.json
`);
    return 0;
  }

  if (!existsSync(proofpackPath)) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ valid: false, error: `File not found: ${proofpackPath}` }) + '\n');
    } else {
      process.stderr.write(`Error: File not found: ${proofpackPath}\n`);
    }
    return 1;
  }

  let pack: Record<string, unknown>;
  try {
    const content = readFileSync(proofpackPath, 'utf-8');
    pack = JSON.parse(content);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (opts.json) {
      process.stdout.write(JSON.stringify({ valid: false, error: `Invalid JSON: ${msg}` }) + '\n');
    } else {
      process.stderr.write(`Error: Invalid JSON in ${proofpackPath}: ${msg}\n`);
    }
    return 1;
  }

  // Dynamically import verification
  const { verifyProofpack } = await import('../../../proofs/src/proofpack.js');

  // Handle both proofpack formats (direct or nested under manifest)
  const proofpackData = pack.manifest
    ? { ...pack, ...(pack.manifest as Record<string, unknown>) }
    : pack;

  const result = verifyProofpack(proofpackData as Parameters<typeof verifyProofpack>[0]);
  const verbose = args.includes('--verbose');

  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(`\n  Proofpack Verification\n`);
    process.stdout.write(`  ══════════════════════\n`);
    process.stdout.write(`  File:         ${proofpackPath}\n`);
    process.stdout.write(`  Execution ID: ${result.execution_id || 'unknown'}\n\n`);

    if (verbose) {
      for (const check of result.checks) {
        const icon = check.passed ? 'OK' : 'XX';
        process.stdout.write(`  [${icon}] ${check.name}`);
        if (check.detail) process.stdout.write(` (${check.detail})`);
        process.stdout.write('\n');
      }
      process.stdout.write('\n');
    }

    const passedCount = result.checks.filter(c => c.passed).length;
    const totalCount = result.checks.length;

    process.stdout.write(`  Result: ${result.valid ? 'VALID' : 'INVALID'}\n`);
    process.stdout.write(`  Checks: ${passedCount}/${totalCount} passed\n`);

    if (result.errors.length > 0) {
      process.stdout.write(`\n  Errors:\n`);
      for (const err of result.errors) {
        process.stdout.write(`    - ${err}\n`);
      }
    }

    process.stdout.write('\n');
  }

  return result.valid ? 0 : 1;
}
