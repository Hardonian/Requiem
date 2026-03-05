import { execSync } from 'node:child_process';

function run(command: string, capture = false): string {
  process.stdout.write(`\n$ ${command}\n`);
  if (capture) {
    return execSync(command, { encoding: 'utf8' });
  }
  execSync(command, { stdio: 'inherit' });
  return '';
}

run('pnpm --filter @requiem/ai typecheck');
run('pnpm --filter @requiem/ai build');
run('node --import tsx --test packages/ai/src/tools/__tests__/failureRuntime.test.ts');
const runOutput = run("node scripts/run-tsx.mjs packages/cli/src/cli.ts run system.echo '{\"message\":\"runtime\"}'", true);
process.stdout.write(runOutput);
const runIdMatch = runOutput.match(/Run ID: (\S+)/);
if (!runIdMatch) {
  throw new Error('Could not capture run id from CLI output');
}
const runId = runIdMatch[1];
run(`node scripts/run-tsx.mjs packages/cli/src/cli.ts diagnose ${runId} --json`);
run(`node scripts/run-tsx.mjs packages/cli/src/cli.ts repair ${runId} --json`);
run(`node scripts/run-tsx.mjs packages/cli/src/cli.ts incident export ${runId}`);
run(`node scripts/run-tsx.mjs packages/cli/src/cli.ts diff ${runId} ${runId} --json`);

process.stdout.write('\nverify-tool-failure-runtime: OK\n');
