#!/usr/bin/env node
/**
 * Public Surface Snapshot Generator
 *
 * Generates a structured JSON representation of the CLI's public API surface:
 * - CLI commands and flags
 * - Exported modules (functions, types, constants)
 * - Exit code definitions
 * - Version information
 *
 * Usage:
 *   tsx scripts/generate-surface-snapshot.ts          # Generate snapshot
 *   tsx scripts/generate-surface-snapshot.ts --check  # Compare against existing
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Schema version for snapshot format evolution
const SCHEMA_VERSION = '1.0.0';

// Paths relative to project root
const PATHS = {
  cliPackage: 'packages/cli',
  cliSrc: 'packages/cli/src',
  cliTs: 'packages/cli/src/cli.ts',
  cliIndex: 'packages/cli/src/index.ts',
  coreIndex: 'packages/cli/src/core/index.ts',
  exitCodes: 'packages/cli/src/core/exit-codes.ts',
  packageJson: 'packages/cli/package.json',
  commandsDir: 'packages/cli/src/commands',
  output: 'reports/public-surface-snapshot.json',
};

// ============================================================================
// Types
// ============================================================================

interface CliFlag {
  name: string;
  alias?: string;
  description?: string;
  required?: boolean;
  defaultValue?: string;
  type: 'boolean' | 'string' | 'number';
}

interface CliSubcommand {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; required: boolean; description?: string }>;
  flags: CliFlag[];
}

interface CliCommand {
  name: string;
  description?: string;
  category?: string;
  arguments?: Array<{ name: string; required: boolean; description?: string }>;
  flags: CliFlag[];
  subcommands: CliSubcommand[];
  aliases?: string[];
}

interface ExportedItem {
  name: string;
  kind: 'function' | 'type' | 'interface' | 'const' | 'class' | 'enum' | 'export-all';
  isTypeOnly?: boolean;
  source?: string;
}

interface ExitCodeDefinition {
  code: number;
  name: string;
  description: string;
}

interface VersionInfo {
  packageVersion: string;
  cliVersion: string;
  schemaVersion: string;
  compatibilityMatrix: string;
}

interface PublicSurfaceSnapshot {
  schemaVersion: string;
  generatedAt: string;
  version: VersionInfo;
  commands: CliCommand[];
  exports: {
    main: ExportedItem[];
    core: ExportedItem[];
  };
  exitCodes: ExitCodeDefinition[];
}

interface DiffResult {
  path: string;
  expected: unknown;
  actual: unknown;
}

// ============================================================================
// Utility Functions
// ============================================================================

function readFile(path: string): string {
  const fullPath = join(process.cwd(), path);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

function parseCommanderFlags(line: string): CliFlag | null {
  // Match patterns like: .option('-f, --format <format>', 'description', 'default')
  // or .option('--json', 'description')
  // or .requiredOption('-p, --policy <policy>', 'description')

  const optionMatch = line.match(
    /\.(requiredOption|option)\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"](?:\s*,\s*['"]([^'"]*)['"])?\s*\)/
  );

  if (!optionMatch) return null;

  const isRequired = optionMatch[1] === 'requiredOption';
  const flagDef = optionMatch[2];
  const description = optionMatch[3];
  const defaultValue = optionMatch[4];

  // Parse flag definition like "-f, --format <format>" or "--json"
  const aliasMatch = flagDef.match(/-([a-zA-Z]),/);
  const alias = aliasMatch ? aliasMatch[1] : undefined;

  const nameMatch = flagDef.match(/--([a-zA-Z-]+)/);
  const name = nameMatch ? nameMatch[1] : flagDef;

  const hasValue = flagDef.includes('<') || flagDef.includes('[');
  const type: CliFlag['type'] = hasValue ? 'string' : 'boolean';

  return {
    name,
    alias,
    description: description || undefined,
    required: isRequired,
    defaultValue,
    type,
  };
}

function parseArguments(line: string): Array<{ name: string; required: boolean; description?: string }> | null {
  // Match .argument('<name>', 'description') or .argument('[name]', 'description')
  const argMatches = line.matchAll(/\.argument\s*\(\s*['"]([<[\]])([^>'"]+)[>\]]['"]\s*(?:,\s*['"]([^'"]*)['"])?\s*\)/g);
  const args: Array<{ name: string; required: boolean; description?: string }> = [];

  for (const match of argMatches) {
    const isRequired = match[1] === '<';
    const name = match[2];
    const description = match[3];
    args.push({ name, required: isRequired, description });
  }

  return args.length > 0 ? args : null;
}

// ============================================================================
// Parsers
// ============================================================================

function parseCliTs(): CliCommand[] {
  const content = readFile(PATHS.cliTs);
  const commands: CliCommand[] = [];

  // Map from switch cases to command definitions
  const commandPattern = /case\s+['"]([^'"]+)['"]\s*:/g;
  let match: RegExpExecArray | null;

  // Also look for help text to extract command descriptions
  const helpMatch = content.match(/printHelp\(\)[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  const helpText = helpMatch ? helpMatch[1] : '';

  // Parse commands from the switch statement in main()
  while ((match = commandPattern.exec(content)) !== null) {
    const commandName = match[1];

    // Skip special cases
    if (['help', '--help', '-h', 'version', '--version', '-v'].includes(commandName)) {
      continue;
    }

    // Find description from help text
    const descPattern = new RegExp(`${commandName}\\s+([^\\n]+)`);
    const descMatch = helpText.match(descPattern);
    const description = descMatch ? descMatch[1].trim() : undefined;

    // Determine category from help text context
    let category: string | undefined;
    if (helpText.includes('CORE COMMANDS')) {
      const beforeCommand = helpText.substring(0, helpText.indexOf(commandName));
      if (beforeCommand.includes('CORE COMMANDS')) category = 'core';
      else if (beforeCommand.includes('GOVERNANCE')) category = 'governance';
      else if (beforeCommand.includes('INSPECTION')) category = 'inspection';
      else if (beforeCommand.includes('MICROFRACTURE')) category = 'microfracture';
      else if (beforeCommand.includes('ENTERPRISE')) category = 'enterprise';
      else if (beforeCommand.includes('ADMIN')) category = 'admin';
    }

    // Check for microfracture commands (special handling)
    const isMicrofracture = ['diff', 'lineage', 'simulate', 'drift', 'explain', 'usage', 'tenant-check', 'chaos', 'share'].includes(commandName);
    if (isMicrofracture && !category) {
      category = 'microfracture';
    }

    commands.push({
      name: commandName,
      description,
      category,
      flags: [{ name: 'json', type: 'boolean', description: 'Output in JSON format' }],
      subcommands: [],
    });
  }

  // Also check for aliased commands (e.g., 'fingerprint' is in help but parsed differently)
  const additionalCommands = ['fingerprint', 'ui', 'quickstart', 'rollback'];
  for (const cmd of additionalCommands) {
    if (!commands.find(c => c.name === cmd)) {
      const descPattern = new RegExp(`${cmd}\\s+([^\\n]+)`);
      const descMatch = helpText.match(descPattern);
      const description = descMatch ? descMatch[1].trim() : undefined;

      commands.push({
        name: cmd,
        description,
        flags: [{ name: 'json', type: 'boolean', description: 'Output in JSON format' }],
        subcommands: [],
      });
    }
  }

  return commands;
}

function parseCommandFile(fileName: string): CliCommand | null {
  const filePath = join(PATHS.commandsDir, fileName);
  const content = readFile(filePath);

  // Check if it uses Commander pattern
  const hasCommander = content.includes("from 'commander'");

  if (hasCommander) {
    return parseCommanderFile(fileName, content);
  }

  // Parse manual argument parsing files
  return parseManualCommandFile(fileName, content);
}

function parseCommanderFile(fileName: string, content: string): CliCommand | null {
  const baseName = fileName.replace('.ts', '');

  // Find all Command definitions
  const commandPattern = /new Command\s*\(\s*['"]([^'"]*)['"]\s*\)|\.command\s*\(\s*['"]([^'"]*)['"]\s*\)/g;
  const commands: CliCommand[] = [];
  let match: RegExpExecArray | null;

  while ((match = commandPattern.exec(content)) !== null) {
    const commandName = match[1] || match[2];

    // Extract description
    const descPattern = new RegExp(`\\.description\\s*\\(\\s*['"]([^'"]*)['"]\\s*\\)`, 'g');
    const descMatch = descPattern.exec(content.substring(match.index, match.index + 500));
    const description = descMatch ? descMatch[1] : undefined;

    // Extract flags in the context after this command
    const contextEnd = content.indexOf('.action', match.index) || content.indexOf('});', match.index);
    const context = content.substring(match.index, contextEnd > match.index ? contextEnd : match.index + 800);

    const flags: CliFlag[] = [];
    const flagLines = context.match(/\.(requiredOption|option)\s*\([^)]+\)/g) || [];

    for (const line of flagLines) {
      const flag = parseCommanderFlags(line);
      if (flag) flags.push(flag);
    }

    // Extract arguments
    let args: Array<{ name: string; required: boolean; description?: string }> | undefined;
    const argMatches = context.matchAll(/\.argument\s*\(\s*['"]([<[\]])([^>'"]+)[>\]]['"]\s*(?:,\s*['"]([^'"]*)['"])?\s*\)/g);
    for (const argMatch of argMatches) {
      if (!args) args = [];
      args.push({
        name: argMatch[2],
        required: argMatch[1] === '<',
        description: argMatch[3],
      });
    }

    commands.push({
      name: commandName,
      description,
      arguments: args,
      flags,
      subcommands: [],
    });
  }

  // If we found subcommands, the first one might be the parent
  if (commands.length > 1) {
    const parent = commands[0];
    parent.subcommands = commands.slice(1).map(sub => ({
      ...sub,
      flags: [...parent.flags, ...sub.flags],
    }));
    return parent;
  }

  return commands[0] || null;
}

function parseManualCommandFile(fileName: string, content: string): CliCommand | null {
  const baseName = fileName.replace('.ts', '');

  // Look for exported argument parsing functions
  const parseFnMatch = content.match(/export\s+(?:function|const)\s+(parse\w*Args)/);
  if (!parseFnMatch) return null;

  // Extract argument interface
  const interfaceMatch = content.match(/export\s+interface\s+(\w+Args)\s*\{([^}]+)\}/s);
  const argsInterface = interfaceMatch ? interfaceMatch[2] : '';

  // Parse flags from the interface
  const flags: CliFlag[] = [];
  const optionalProps = argsInterface.matchAll(/(\w+)\?\s*:\s*(boolean|string|number)/g);

  for (const prop of optionalProps) {
    if (prop[1] === 'command') continue;
    flags.push({
      name: prop[1],
      type: prop[2] as CliFlag['type'],
    });
  }

  // Look for CLI args pattern in the parse function
  const parseFnContent = content.substring(
    content.indexOf(parseFnMatch[1]),
    content.indexOf('return result', content.indexOf(parseFnMatch[1]))
  );

  // Extract flags from the parsing logic
  const flagMatches = parseFnContent.matchAll(/args\[i\]\s*===\s*['"](--\w+)['"]/g);
  for (const flagMatch of flagMatches) {
    const flagName = flagMatch[1].replace('--', '');
    if (!flags.find(f => f.name === flagName)) {
      flags.push({ name: flagName, type: 'string' });
    }
  }

  // Extract subcommands from the interface
  const commandTypeMatch = argsInterface.match(/command\??:\s*['"]([^'"]+)['"]|command\??:\s*['"]([^|]+)/);
  const subcommands: CliSubcommand[] = [];

  if (commandTypeMatch) {
    const commandType = commandTypeMatch[1] || commandTypeMatch[2];
    if (commandType) {
      const subcommandNames = commandType.split('|').map(s => s.trim().replace(/['"]/g, ''));
      for (const subName of subcommandNames) {
        subcommands.push({
          name: subName,
          flags: [...flags],
        });
      }
    }
  }

  return {
    name: baseName,
    flags,
    subcommands,
  };
}

function parseExports(filePath: string, includeReExports: boolean = false): ExportedItem[] {
  const content = readFile(filePath);
  const exports: ExportedItem[] = [];
  const baseDir = dirname(filePath);

  // Named exports - handle multiline blocks with optional comments
  // Match: export { ... } or export type { ... } (possibly with from clause)
  const namedExportPattern = /export\s+(type\s+)?\{([^}]+)\}(?:\s+from\s+['"]([^'"]+)['"])?/g;
  let match: RegExpExecArray | null;

  while ((match = namedExportPattern.exec(content)) !== null) {
    const isTypeOnly = Boolean(match[1]); // match[1] is 'type ' if present
    const exportList = match[2]; // the content inside braces
    const fromClause = match[3]; // the from path if present

    // Parse individual exports - clean up comments first
    const cleanList = exportList.replace(/\/\/.*$/gm, ''); // Remove line comments
    const items = cleanList.split(',').map(s => s.trim()).filter(s => s.length > 0);

    for (const item of items) {
      // Handle "X as Y" syntax
      const asMatch = item.match(/(\w+)\s+as\s+(\w+)/);
      const name = asMatch ? asMatch[2] : item;
      const sourceName = asMatch ? asMatch[1] : item;

      // Determine kind based on naming conventions
      let kind: ExportedItem['kind'] = 'const';
      if (isTypeOnly) {
        kind = 'type';
      } else if (/^[A-Z]/.test(name)) {
        // Likely a class, interface, or constant
        kind = /^(?:ErrorCode|ErrorSeverity|LogLevel|LogEntry|LogFields|LogSink|ExitCodeValue|StructuredError|AppError|AppErrorDetails)$/.test(name) ? 'type' : 'const';
      } else if (/^[a-z]/.test(name)) {
        // Lowercase is likely a function
        kind = 'function';
      }

      exports.push({
        name: name.replace(/^type\s+/, ''),
        kind,
        isTypeOnly,
        source: fromClause ? `via ${fromClause}` : sourceName,
      });
    }

    // Handle re-export sources if includeReExports is enabled
    if (includeReExports && fromClause) {
      try {
        const sourceFile = fromClause.replace('.js', '.ts');
        const fullPath = join(baseDir, sourceFile);
        if (existsSync(fullPath)) {
          const reExports = parseExports(fullPath, false);
          for (const reExp of reExports) {
            if (reExp.kind !== 'export-all' && !exports.find(e => e.name === reExp.name)) {
              exports.push({ ...reExp, source: `via ${fromClause}` });
            }
          }
        }
      } catch {
        // Ignore re-export parsing errors
      }
    }
  }

  // Star exports (export * from ...)
  const starExportPattern = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = starExportPattern.exec(content)) !== null) {
    exports.push({
      name: `* from ${match[1]}`,
      kind: 'export-all',
    });
  }

  // Default exports and individual exports
  const individualPattern = /export\s+(?:const|let|var|function|class|enum|interface|type)\s+(\w+)/g;
  while ((match = individualPattern.exec(content)) !== null) {
    const name = match[1];
    if (!exports.find(e => e.name === name)) {
      const keyword = match[0].split(' ')[1];
      let kind: ExportedItem['kind'] = 'const';
      switch (keyword) {
        case 'function': kind = 'function'; break;
        case 'class': kind = 'class'; break;
        case 'interface': kind = 'interface'; break;
        case 'enum': kind = 'enum'; break;
        case 'type': kind = 'type'; break;
      }
      exports.push({ name, kind });
    }
  }

  return exports;
}

function parseExitCodes(): ExitCodeDefinition[] {
  const content = readFile(PATHS.exitCodes);
  const exitCodes: ExitCodeDefinition[] = [];

  // Extract ExitCode object
  const exitCodeMatch = content.match(/export\s+const\s+ExitCode\s*=\s*\{([^}]+)\}/s);
  if (!exitCodeMatch) return exitCodes;

  const exitCodeBody = exitCodeMatch[1];

  // Parse individual codes
  const codePattern = /(\w+):\s*(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = codePattern.exec(exitCodeBody)) !== null) {
    const name = match[1];
    const code = parseInt(match[2], 10);

    // Find description from ExitCodeDescription
    const descPattern = new RegExp(`\\[ExitCode\\.${name}\\]:\\s*['"]([^'"]*)['"]`);
    const descMatch = content.match(descPattern);
    const description = descMatch ? descMatch[1] : describeExitCode(code, name);

    exitCodes.push({ code, name, description });
  }

  return exitCodes.sort((a, b) => a.code - b.code);
}

function describeExitCode(code: number, name: string): string {
  const descriptions: Record<number, string> = {
    0: 'Success / Determinism verified',
    1: 'Generic failure',
    2: 'Usage error - invalid arguments or command syntax',
    3: 'Configuration error - invalid or missing configuration',
    4: 'Network error - provider unavailable or connection failed',
    5: 'Policy denied - quota exceeded or capability not allowed',
    6: 'Signature verification failed',
    7: 'Replay drift - determinism invariant violated',
    8: 'System error - resource exhaustion or internal error',
    9: 'Timeout - operation exceeded time limit',
  };
  return descriptions[code] || `${name} exit code`;
}

function getVersionInfo(): VersionInfo {
  const packageJson = JSON.parse(readFile(PATHS.packageJson));
  const cliTs = readFile(PATHS.cliTs);

  // Extract VERSION from cli.ts
  const versionMatch = cliTs.match(/const VERSION = ['"]([^'"]+)['"]/);
  const cliVersion = versionMatch ? versionMatch[1] : packageJson.version;

  return {
    packageVersion: packageJson.version,
    cliVersion,
    schemaVersion: SCHEMA_VERSION,
    compatibilityMatrix: `cli-${cliVersion}`,
  };
}

function generateSnapshot(): PublicSurfaceSnapshot {
  // Parse CLI commands from main cli.ts
  const commands = parseCliTs();

  // Parse individual command files for detailed flag/subcommand info
  const commandFiles = [
    'decide.ts',
    'junctions.ts',
    'agent.ts',
    'ai.ts',
    'tool.ts',
    'microfracture.ts',
    'replay.ts',
    'status.ts',
  ];

  for (const file of commandFiles) {
    try {
      const parsed = parseCommandFile(file);
      if (parsed) {
        // Merge with existing command or add as new
        const existing = commands.find(c => c.name === parsed.name);
        if (existing) {
          existing.flags = mergeFlags(existing.flags, parsed.flags);
          if (parsed.subcommands.length > 0) {
            existing.subcommands = parsed.subcommands;
          }
        } else {
          commands.push(parsed);
        }
      }
    } catch (e) {
      // Skip files that can't be parsed
    }
  }

  // Sort commands by name
  commands.sort((a, b) => a.name.localeCompare(b.name));

  // Parse exports (include re-exports for core to get full surface)
  const mainExports = parseExports(PATHS.cliIndex);
  const coreExports = parseExports(PATHS.coreIndex, true);

  // Parse exit codes
  const exitCodes = parseExitCodes();

  // Get version info
  const version = getVersionInfo();

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    version,
    commands,
    exports: {
      main: mainExports,
      core: coreExports,
    },
    exitCodes,
  };
}

function mergeFlags(existing: CliFlag[], incoming: CliFlag[]): CliFlag[] {
  const merged = [...existing];
  for (const flag of incoming) {
    if (!merged.find(f => f.name === flag.name)) {
      merged.push(flag);
    }
  }
  return merged;
}

// ============================================================================
// Check Mode
// ============================================================================

function compareSnapshots(expected: PublicSurfaceSnapshot, actual: PublicSurfaceSnapshot): DiffResult[] {
  const diffs: DiffResult[] = [];

  // Compare version
  if (expected.version.packageVersion !== actual.version.packageVersion) {
    diffs.push({
      path: 'version.packageVersion',
      expected: expected.version.packageVersion,
      actual: actual.version.packageVersion,
    });
  }

  // Compare commands
  const expectedCommands = new Map(expected.commands.map(c => [c.name, c]));
  const actualCommands = new Map(actual.commands.map(c => [c.name, c]));

  for (const [name, cmd] of expectedCommands) {
    if (!actualCommands.has(name)) {
      diffs.push({ path: `commands.${name}`, expected: cmd, actual: null });
    }
  }

  for (const [name, cmd] of actualCommands) {
    const expectedCmd = expectedCommands.get(name);
    if (!expectedCmd) {
      diffs.push({ path: `commands.${name}`, expected: null, actual: cmd });
    } else {
      // Compare flags
      const expectedFlags = new Set(expectedCmd.flags.map(f => f.name));
      const actualFlags = new Set(cmd.flags.map(f => f.name));

      for (const flag of expectedFlags) {
        if (!actualFlags.has(flag)) {
          diffs.push({ path: `commands.${name}.flags.${flag}`, expected: flag, actual: null });
        }
      }

      for (const flag of actualFlags) {
        if (!expectedFlags.has(flag)) {
          diffs.push({ path: `commands.${name}.flags.${flag}`, expected: null, actual: flag });
        }
      }

      // Compare subcommands
      const expectedSubs = new Map(expectedCmd.subcommands.map(s => [s.name, s]));
      const actualSubs = new Map(cmd.subcommands.map(s => [s.name, s]));

      for (const [subName, sub] of expectedSubs) {
        if (!actualSubs.has(subName)) {
          diffs.push({ path: `commands.${name}.subcommands.${subName}`, expected: sub, actual: null });
        }
      }

      for (const [subName, sub] of actualSubs) {
        if (!expectedSubs.has(subName)) {
          diffs.push({ path: `commands.${name}.subcommands.${subName}`, expected: null, actual: sub });
        }
      }
    }
  }

  // Compare exports
  const expectedMainExports = new Set(expected.exports.main.map(e => e.name));
  const actualMainExports = new Set(actual.exports.main.map(e => e.name));

  for (const exp of expectedMainExports) {
    if (!actualMainExports.has(exp)) {
      diffs.push({ path: `exports.main.${exp}`, expected: exp, actual: null });
    }
  }

  for (const exp of actualMainExports) {
    if (!expectedMainExports.has(exp)) {
      diffs.push({ path: `exports.main.${exp}`, expected: null, actual: exp });
    }
  }

  // Compare exit codes
  const expectedCodes = new Map(expected.exitCodes.map(e => [e.code, e]));
  const actualCodes = new Map(actual.exitCodes.map(e => [e.code, e]));

  for (const [code, def] of expectedCodes) {
    if (!actualCodes.has(code)) {
      diffs.push({ path: `exitCodes.${code}`, expected: def, actual: null });
    }
  }

  for (const [code, def] of actualCodes) {
    if (!expectedCodes.has(code)) {
      diffs.push({ path: `exitCodes.${code}`, expected: null, actual: def });
    }
  }

  return diffs;
}

function runCheckMode(snapshot: PublicSurfaceSnapshot): boolean {
  const outputPath = join(process.cwd(), PATHS.output);

  if (!existsSync(outputPath)) {
    console.error('Error: No existing snapshot found for comparison');
    console.error(`Expected: ${outputPath}`);
    return false;
  }

  const existingContent = readFileSync(outputPath, 'utf-8');
  const existing: PublicSurfaceSnapshot = JSON.parse(existingContent);

  const diffs = compareSnapshots(existing, snapshot);

  if (diffs.length === 0) {
    console.log('✓ Snapshot matches - no public surface changes detected');
    return true;
  }

  console.error('✗ Public surface changes detected:');
  console.error('');

  for (const diff of diffs) {
    if (diff.expected === null) {
      console.error(`  + ADDED: ${diff.path}`);
      console.error(`    ${JSON.stringify(diff.actual)}`);
    } else if (diff.actual === null) {
      console.error(`  - REMOVED: ${diff.path}`);
      console.error(`    ${JSON.stringify(diff.expected)}`);
    } else {
      console.error(`  ~ CHANGED: ${diff.path}`);
      console.error(`    Expected: ${JSON.stringify(diff.expected)}`);
      console.error(`    Actual:   ${JSON.stringify(diff.actual)}`);
    }
    console.error('');
  }

  console.error(`Total differences: ${diffs.length}`);
  return false;
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const isCheckMode = args.includes('--check');

  try {
    const snapshot = generateSnapshot();

    if (isCheckMode) {
      const passed = runCheckMode(snapshot);
      process.exit(passed ? 0 : 1);
    }

    // Generate mode - write snapshot
    const outputPath = join(process.cwd(), PATHS.output);

    // Ensure reports directory exists
    const reportsDir = dirname(outputPath);
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');

    console.log(`Public surface snapshot generated: ${PATHS.output}`);
    console.log(`  Commands: ${snapshot.commands.length}`);
    console.log(`  Main exports: ${snapshot.exports.main.length}`);
    console.log(`  Core exports: ${snapshot.exports.core.length}`);
    console.log(`  Exit codes: ${snapshot.exitCodes.length}`);
    console.log(`  Schema version: ${snapshot.schemaVersion}`);

  } catch (error) {
    console.error('Error generating snapshot:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
