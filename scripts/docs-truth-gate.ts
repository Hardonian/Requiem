import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const README_PATH = join(process.cwd(), 'README.md');
const CLI_PATH = join(process.cwd(), 'packages/cli/src/cli.ts');

function getReadmeCommands(): string[] {
  const content = readFileSync(README_PATH, 'utf-8');
  const commands: string[] = [];

  // Extract commands from the | `reach <command>` | pattern in README
  // Look for the CLI Commands table
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.includes('| Command | Purpose | Example |')) {
      inTable = true;
      continue;
    }
    if (inTable && line.trim() === '') {
      inTable = false;
      continue;
    }
    if (inTable) {
      const match = line.match(/\|\s*`reach\s+([^`\s]+)[^`]*`\s*\|/);
      if (match) {
        commands.push(match[1]);
      }
    }
  }
  return [...new Set(commands)].sort();
}

function getCliCommands(): string[] {
  try {
    const helpOutput = execSync(`npx tsx ${CLI_PATH} --help`, { encoding: 'utf-8' });
    const commands: string[] = [];

    // Commander help output usually lists commands in a "Commands:" section
    const lines = helpOutput.split('\n');
    let inCommandsSection = false;

    for (const line of lines) {
      if (line.trim() === 'Commands:') {
        inCommandsSection = true;
        continue;
      }
      if (inCommandsSection && line.trim() === '') {
        // We hit the end of the section or another section
        // Don't break yet, commander output can have various formats
        continue;
      }
      if (inCommandsSection && line.startsWith('  ')) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] && !parts[0].startsWith('-')) {
          commands.push(parts[0]);
        }
      }
    }
    return [...new Set(commands)].sort();
  } catch (error) {
    console.error('Error running CLI help:', error);
    process.exit(1);
  }
}

const readmeCmds = getReadmeCommands();
const cliCmds = getCliCommands();

console.log('--- Documentation Truth Gate ---');
console.log(`README commands: ${readmeCmds.join(', ')}`);
console.log(`CLI commands:    ${cliCmds.join(', ')}`);

const missingInCli = readmeCmds.filter(c => !cliCmds.includes(c));
const missingInReadme = cliCmds.filter(c => !readmeCmds.includes(c));

let failed = false;

if (missingInCli.length > 0) {
  console.error(`\n❌ ERROR: Commands documented in README but missing in CLI: ${missingInCli.join(', ')}`);
  failed = true;
}

if (missingInReadme.length > 0) {
  console.warn(`\n⚠️  WARNING: Commands present in CLI but not documented in README: ${missingInReadme.join(', ')}`);
  // We don't necessarily fail on missing docs, but it's recommended to document them.
  // For the purpose of "Anti-Drift", let's be strict if they are non-internal.
}

if (failed) {
  process.exit(3); // Invariant failure code as per README
} else {
  console.log('\n✅ Documentation truth gate passed.');
  process.exit(0);
}
