import { mkdirSync } from 'node:fs';
import { __internalExecuteDurabilityWritePath } from '../packages/cli/src/commands/benchmark-suite.ts';

const workDir = process.argv[2];
if (!workDir) {
  process.stderr.write('missing workDir\n');
  process.exit(2);
}

mkdirSync(workDir, { recursive: true });
__internalExecuteDurabilityWritePath(workDir);
