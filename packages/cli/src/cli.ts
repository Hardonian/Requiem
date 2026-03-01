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
 * - requiem telemetry               Real-time usage stats
 * - requiem stress                  Generate synthetic load
 * - requiem dashboard               Launch local web dashboard
 * - requiem serve                   Expose decision engine API
 * - requiem backup                  Dump database to JSON
 * - requiem restore                 Restore database from JSON
 * - requiem import                  Ingest decision logs from CSV
 * - requiem nuke                    Clear database state
 * - requiem init                    Initialize configuration
 * - requiem config <subcommand>     Global configuration
 * - requiem decide <subcommand>     Decision engine operations
 * - requiem junctions <subcommand>  Junction management
 * - requiem agent <subcommand>      AI Agent orchestration (MCP)
 * - requiem ai <subcommand>         AI tools, skills & telemetry
 * - requiem doctor                  Environment validation
 * - requiem quickstart              Interactive setup guide
 * - requiem status                  System health check
 * - requiem bugreport               Generate diagnostic report
 * - requiem version                 Show version info
 *
 * INVARIANT: All tool/replay operations use the same registry + executor.
 * INVARIANT: No duplicate logic between CLI and programmatic API.
 */

import { parseDecideArgs, runDecideCommand } from './commands/decide';
import { parseJunctionsArgs, runJunctionsCommand } from './commands/junctions';
import { parseAgentArgs, runAgentCommand } from './commands/agent';
import { parseAiArgs, runAiCommand } from './commands/ai';
import { runRunCommand } from './commands/run';
import { runVerifyCommand } from './commands/verify';

const VERSION = '0.2.0';

function printHelp(): void {
  console.log(`
Requiem CLI v${VERSION}  (alias: reach)

USAGE:
  requiem <command> [options]

CORE COMMANDS:
  run <name> [input]                  Run a tool or skill (e.g., reach run system.echo "hello")
  replay <hash>                       Replay an execution by hash
  verify <hash>                       Verify determinism of an execution
  ui                                  Launch the web dashboard (alias for dashboard)
  quickstart                          Interactive setup guide

ADVANCED COMMANDS:
  tool list [--json]                  List registered tools
  tool exec <name>                    Execute a tool (low-level)
  trace <id>                          Visualize decision trace
  stats                               Display aggregated telemetry
  telemetry                           Show real-time usage stats
  stress                              Generate synthetic load
  serve                               Expose decision engine API
  backup                              Dump database to JSON
  restore                             Restore database from JSON
  import                              Ingest decision logs from CSV
  nuke                                Clear database state
  init                                Initialize configuration
  status                              System health check
  bugreport                           Generate diagnostic report
  doctor                              Validate environment setup
  version                             Show version information
  help                                Show this help message

DECIDE SUBCOMMANDS:
  decide evaluate --junction <id>     Evaluate a decision for a junction
  decide explain --junction <id>      Explain why a decision was made
  decide outcome --id <id>            Record an outcome for a decision
  decide list                         List all decision reports
  decide show <id>                    Show details of a decision

JUNCTIONS SUBCOMMANDS:
  junctions scan --since <time>       Scan for junctions (e.g., 7d, 24h)
  junctions list                      List all junctions
  junctions show <id>                 Show details of a junction

AGENT SUBCOMMANDS:
  agent serve --tenant <id>           Start MCP stdio server

AI SUBCOMMANDS:
  ai tools list                       List all registered AI tools
  ai skills list                      List all AI skills
  ai skills run <name>                Run an AI skill
  ai telemetry                        Show AI cost and usage telemetry

OPTIONS:
  --json                              Output in JSON format
  --help, -h                          Show help for a command
  --version, -v                       Show version information

ENVIRONMENT VARIABLES:
  DECISION_ENGINE                     Engine type: ts|requiem (default: ts)
  FORCE_RUST                          Force TypeScript fallback: true|false
  REQUIEM_ENGINE_AVAILABLE            Set to 'true' if native engine is built
  REQUIEM_ENABLE_METRICS              Set to 'true' to enable metrics logging

EXAMPLES:
  reach run system.echo "hello"
  reach verify sha256abc123...
  reach ui
  reach quickstart
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
    case 'run':
      return await runRunCommand(subArgs);

    case 'verify':
      return await runVerifyCommand(subArgs);

    case 'ui': {
      const { dashboard } = await import('./commands/dashboard');
      await dashboard.parseAsync([process.argv[0], process.argv[1], 'dashboard', ...subArgs]);
      return 0;
    }

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

    case 'telemetry': {
      const { telemetry } = await import('./commands/telemetry');
      await telemetry.parseAsync([process.argv[0], process.argv[1], 'telemetry', ...subArgs]);
      return 0;
    }

    case 'stress': {
      const { stress } = await import('./commands/stress');
      await stress.parseAsync([process.argv[0], process.argv[1], 'stress', ...subArgs]);
      return 0;
    }

    case 'dashboard': {
      const { dashboard } = await import('./commands/dashboard');
      await dashboard.parseAsync([process.argv[0], process.argv[1], 'dashboard', ...subArgs]);
      return 0;
    }

    case 'serve': {
      const { serve } = await import('./commands/serve');
      await serve.parseAsync([process.argv[0], process.argv[1], 'serve', ...subArgs]);
      return 0;
    }

    case 'backup': {
      const { backup } = await import('./commands/backup');
      await backup.parseAsync([process.argv[0], process.argv[1], 'backup', ...subArgs]);
      return 0;
    }

    case 'restore': {
      const { restore } = await import('./commands/restore');
      await restore.parseAsync([process.argv[0], process.argv[1], 'restore', ...subArgs]);
      return 0;
    }

    case 'import': {
      const { importCommand } = await import('./commands/import');
      await importCommand.parseAsync([process.argv[0], process.argv[1], 'import', ...subArgs]);
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

    case 'init': {
      const { init } = await import('./commands/init');
      await init.parseAsync([process.argv[0], process.argv[1], 'init', ...subArgs]);
      return 0;
    }

    case 'config': {
      const { config } = await import('./commands/config');
      await config.parseAsync([process.argv[0], process.argv[1], 'config', ...subArgs]);
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

    case 'doctor': {
      const { runDoctor } = await import('./commands/doctor');
      const json = subArgs.includes('--json');
      return await runDoctor({ json });
    }

    case 'quickstart': {
      const { quickstart } = await import('./commands/quickstart');
      await quickstart.parseAsync([process.argv[0], process.argv[1], 'quickstart', ...subArgs]);
      return 0;
    }

    case 'status': {
      const { status } = await import('./commands/status');
      await status.parseAsync([process.argv[0], process.argv[1], 'status', ...subArgs]);
      return 0;
    }

    case 'bugreport': {
      const { bugreport } = await import('./commands/bugreport');
      await bugreport.parseAsync([process.argv[0], process.argv[1], 'bugreport', ...subArgs]);
      return 0;
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
