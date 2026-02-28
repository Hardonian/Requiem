#!/usr/bin/env node
/**
 * Requiem CLI
 * 
 * The unified command-line interface for the Reach ecosystem.
 * 
 * Commands:
 * - requiem decide <subcommand>    Decision engine operations
 * - requiem junctions <subcommand> Junction management
 * - requiem doctor                 Environment validation
 * - requiem version                Show version info
 */

import { parseDecideArgs, runDecideCommand } from './commands/decide';
import { parseJunctionsArgs, runJunctionsCommand } from './commands/junctions';
import { checkEngineAvailability, EngineErrorCodes } from './engine/adapter';

const VERSION = '0.1.0';

function printHelp(): void {
  console.log(`
Requiem CLI v${VERSION}

USAGE:
  requiem <command> [options]

COMMANDS:
  decide <subcommand>     Decision engine operations
  junctions <subcommand>  Junction management
  doctor                  Validate environment setup
  version                 Show version information
  help                    Show this help message

DECIDE SUBCOMMANDS:
  evaluate --junction <id>    Evaluate a decision for a junction
  explain --junction <id>     Explain why a decision was made
  outcome --id <id>           Record an outcome for a decision
  list                        List all decision reports
  show <id>                   Show details of a decision

JUNCTIONS SUBCOMMANDS:
  scan --since <time>         Scan for junctions (e.g., 7d, 24h)
  list                        List all junctions
  show <id>                   Show details of a junction

OPTIONS:
  --json                      Output in JSON format
  --help                      Show help for a command

ENVIRONMENT VARIABLES:
  DECISION_ENGINE            Engine type: ts|requiem (default: ts)
  FORCE_RUST                 Force TypeScript fallback: true|false
  REQUIEM_ENGINE_AVAILABLE   Set to 'true' if native engine is built

EXAMPLES:
  requiem decide evaluate --junction junction_abc123
  requiem junctions scan --since 7d --json
  requiem doctor
`);
}

function printVersion(): void {
  console.log(`Requiem CLI v${VERSION}`);
}

async function runDoctor(): Promise<number> {
  console.log('Running environment doctor...\n');
  
  const engineCheck = await checkEngineAvailability();
  
  if (engineCheck.available) {
    console.log(`✓ Engine available: ${engineCheck.engineType}`);
    if (engineCheck.error) {
      console.log(`  Note: ${engineCheck.error}`);
    }
  } else {
    console.error(`✗ Engine not available`);
    console.error(`  ${engineCheck.error}`);
    return 1;
  }
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (majorVersion >= 18) {
    console.log(`✓ Node.js version: ${nodeVersion}`);
  } else {
    console.error(`✗ Node.js version too old: ${nodeVersion} (requires >= 18)`);
    return 1;
  }
  
  console.log('\nEnvironment check complete.');
  return 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printHelp();
    return 0;
  }
  
  const command = args[0];
  const subArgs = args.slice(1);
  
  switch (command) {
    case 'decide': {
      const decideArgs = parseDecideArgs(subArgs);
      return await runDecideCommand(decideArgs);
    }
    
    case 'junctions': {
      const junctionsArgs = parseJunctionsArgs(subArgs);
      return await runJunctionsCommand(junctionsArgs);
    }
    
    case 'doctor':
      return await runDoctor();
    
    case 'version':
    case '--version':
    case '-v':
      printVersion();
      return 0;
    
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return 0;
    
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "requiem help" for usage information.');
      return 1;
  }
}

// Run main and exit with appropriate code
main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
