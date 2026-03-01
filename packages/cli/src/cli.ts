#!/usr/bin/env node
/**
 * Requiem CLI — AI Control Plane + Decision Engine
 *
 * Binary aliases: `requiem` and `reach`
 *
 * Commands:
 * - requiem tool <subcommand>       AI tool registry operations
 * - requiem replay <hash>           Replay audit record lookup
 * - requiem trace <id>              Visualize decision trace
 * - requiem stats                   Aggregated telemetry
 * - requiem nuke                    Clear database state
 * - requiem decide <subcommand>     Decision engine operations
 * - requiem junctions <subcommand>  Junction management
 * - requiem agent <subcommand>      AI Agent orchestration (MCP)
 * - requiem ai <subcommand>         AI tools, skills & telemetry
 * - requiem doctor                  Environment validation
 * - requiem version                 Show version info
 *
 * INVARIANT: All tool/replay operations use the same registry + executor.
 * INVARIANT: No duplicate logic between CLI and programmatic API.
 */

import { parseDecideArgs, runDecideCommand } from './commands/decide';
import { parseJunctionsArgs, runJunctionsCommand } from './commands/junctions';
import { parseAgentArgs, runAgentCommand } from './commands/agent';
import { parseAiArgs, runAiCommand } from './commands/ai';

const VERSION = '0.2.0';

function printHelp(): void {
  console.log(`
Requiem CLI v${VERSION}  (alias: reach)

USAGE:
  requiem <command> [options]

COMMANDS:
  tool list [--json] [--capability <cap>]           List registered tools
  tool exec <name> [--input <json>] [--tenant <id>] Execute a tool
  replay <hash> [--tenant <id>] [--json]            Fetch a replay record
  trace <id> [--json]                               Visualize decision trace
  stats [--tenant <id>] [--json]                    Display aggregated telemetry
  nuke [--force]                                    Clear database state
  decide <subcommand>                               Decision engine operations
  junctions <subcommand>                            Junction management
  agent <subcommand>                                AI Agent orchestration
  ai <subcommand>                                   AI tools, skills & telemetry
  doctor [--json]                                   Validate environment setup
  version                                           Show version information
  help                                              Show this help message

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

AGENT SUBCOMMANDS:
  serve --tenant <id>         Start MCP stdio server

AI SUBCOMMANDS:
  tools list                  List all registered AI tools
  skills list                 List all AI skills
  skills run <name>           Run an AI skill
  telemetry                   Show AI cost and usage telemetry

OPTIONS:
  --json                      Output in JSON format
  --help, -h                  Show help for a command
  --version, -v               Show version information

ENVIRONMENT VARIABLES:
  DECISION_ENGINE             Engine type: ts|requiem (default: ts)
  FORCE_RUST                  Force TypeScript fallback: true|false
  REQUIEM_ENGINE_AVAILABLE    Set to 'true' if native engine is built

EXAMPLES:
  requiem tool list
  requiem tool exec system.echo --input '{"message":"hello"}' --tenant my-tenant
  requiem replay sha256abc123... --tenant my-tenant
  requiem decide evaluate --junction junction_abc123
  requiem junctions scan --since 7d --json
  requiem ai tools list
  requiem doctor
`);
}

function printVersion(): void {
  console.log(`Requiem CLI v${VERSION}`);
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
    case 'tool': {
      const { parseToolListArgs, runToolList, parseToolExecArgs, runToolExec } =
        await import('./commands/tool');

      const subcommand = subArgs[0];
      const subsubArgs = subArgs.slice(1);

      if (subcommand === 'list') {
        return runToolList(parseToolListArgs(subsubArgs));
      } else if (subcommand === 'exec') {
        return await runToolExec(parseToolExecArgs(subsubArgs));
      } else {
        console.error(`Unknown tool subcommand: ${subcommand}`);
        console.error('Run "requiem tool list" or "requiem tool exec <name>"');
        return 1;
      }
    }

    case 'replay': {
      const { replay } = await import('./commands/replay');
      await replay.parseAsync([process.argv[0], process.argv[1], 'replay', ...subArgs]);
      return 0;
    }

    case 'trace': {
      const { trace } = await import('./commands/trace');
      await trace.parseAsync([process.argv[0], process.argv[1], 'trace', ...subArgs]);
      return 0;
    }

    case 'stats': {
      const { stats } = await import('./commands/stats');
      await stats.parseAsync([process.argv[0], process.argv[1], 'stats', ...subArgs]);
      return 0;
    }

    case 'nuke': {
      const { nuke } = await import('./commands/nuke');
      await nuke.parseAsync([process.argv[0], process.argv[1], 'nuke', ...subArgs]);
      return 0;
    }

    case 'decide': {
      const decideArgs = parseDecideArgs(subArgs);
      return await runDecideCommand(decideArgs);
    }

    case 'junctions': {
      const junctionsArgs = parseJunctionsArgs(subArgs);
      return await runJunctionsCommand(junctionsArgs);
    }

    case 'agent': {
      const agentArgs = parseAgentArgs(subArgs);
      return await runAgentCommand(agentArgs);
    }

    case 'ai': {
      const aiArgs = parseAiArgs(subArgs);
      return await runAiCommand(aiArgs);
    }

    case 'pack': {
      console.log('Pack management is not yet available.');
      console.log('Track progress at: https://github.com/reachhq/requiem/issues');
      return 0;
    }

    case 'marketplace': {
      console.log('Marketplace is not yet available.');
      console.log('Track progress at: https://github.com/reachhq/requiem/issues');
      return 0;
    }

    case 'eval': {
      console.log('Evaluation suite is not yet available.');
      console.log('Track progress at: https://github.com/reachhq/requiem/issues');
      return 0;
    }

    case 'doctor': {
      const { runDoctor } = await import('./commands/doctor');
      const json = subArgs.includes('--json');
      return await runDoctor({ json });
    }

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

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
