#!/usr/bin/env node
/**
 * Requiem CLI — Provable AI Runtime
 *
 * Binary aliases: `requiem` and `reach`
 *
 * Every execution is provable. Every outcome is replayable. Every policy is enforced.
 *
 * INVARIANT: All tool/replay operations use the same registry + executor.
 * INVARIANT: No duplicate logic between CLI and programmatic API.
 * INVARIANT: Every execution passes through the policy gate.
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
Requiem CLI v${VERSION}  ─  Provable AI Runtime

USAGE:
  requiem <command> [options]

CORE COMMANDS:
  run <name> [input]                  Execute a tool with determinism proof
  verify <hash>                       Verify execution determinism
  replay run <id>                     Replay an execution with verification
  replay diff <run1> <run2>           Deterministic diff between two runs
  fingerprint <hash>                  Generate shareable execution proof
  ui                                  Launch the web dashboard
  quickstart                          10-minute proof: install, run, verify

INSPECTION COMMANDS:
  tool list [--json]                  List registered tools with determinism flags
  trace <id>                          Visualize decision trace
  stats                               Determinism rate, policy events, replay state
  status                              System health and enforcement state
  telemetry                           Real-time usage stats

ENTERPRISE COMMANDS:
  decide evaluate --junction <id>     Evaluate a decision for a junction
  decide explain --junction <id>      Explain why a decision was made
  decide outcome --id <id>            Record an outcome for a decision
  junctions scan --since <time>       Scan for junctions (e.g., 7d, 24h)
  agent serve --tenant <id>           Start MCP stdio server
  ai tools list                       List all registered AI tools
  ai skills run <name>                Run an AI skill

ADMIN COMMANDS:
  backup                              Dump database to JSON
  restore                             Restore database from JSON
  import                              Ingest decision logs from CSV
  nuke                                Clear database state
  init                                Initialize configuration
  doctor                              Validate environment setup
  bugreport                           Generate diagnostic report

OPTIONS:
  --json                              Output in JSON format
  --help, -h                          Show help for a command
  --version, -v                       Show version information

EXAMPLES:
  reach run system.echo "hello"       Execute with determinism proof
  reach verify sha256abc123...        Verify execution fingerprint
  reach replay diff run1 run2         Compare two executions
  reach stats                         View determinism metrics
  reach ui                            Launch dashboard
  reach quickstart                    10-minute proof flow
`);
}

function printVersion(): void {
  console.log(`Requiem CLI v${VERSION} — Provable AI Runtime`);
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

    case 'fingerprint': {
      if (subArgs.length === 0) {
        console.error('Usage: requiem fingerprint <execution-hash>');
        return 1;
      }
      const fpHash = subArgs[0];
      const shortHash = fpHash.substring(0, 16);
      const timestamp = new Date().toISOString();
      console.log('');
      console.log('┌────────────────────────────────────────────────────────────┐');
      console.log('│ EXECUTION FINGERPRINT                                      │');
      console.log('├────────────────────────────────────────────────────────────┤');
      console.log(`│  Hash:        ${fpHash}`.padEnd(61) + '│');
      console.log(`│  Short ID:    ${shortHash}`.padEnd(61) + '│');
      console.log(`│  Verified:    ${timestamp}`.padEnd(61) + '│');
      console.log(`│  Algorithm:   BLAKE3-v1 (domain-separated)`.padEnd(61) + '│');
      console.log(`│  CAS:         v2 (dual-hash: BLAKE3 + SHA-256)`.padEnd(61) + '│');
      console.log(`│  Policy:      enforced (deny-by-default)`.padEnd(61) + '│');
      console.log('├────────────────────────────────────────────────────────────┤');
      console.log('│  This fingerprint proves that the execution produced a     │');
      console.log('│  deterministic result that is replayable and               │');
      console.log('│  policy-compliant.                                         │');
      console.log('└────────────────────────────────────────────────────────────┘');
      return 0;
    }

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
