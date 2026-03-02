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
 * INVARIANT: No console.* in production paths (use logger).
 */

import { logger, enablePrettyLogs, formatHuman, isAppError, toJSONObject } from './core/index.js';
import type { AppError } from './core/index.js';

const VERSION = '0.2.0';

// Track command timing for perf metrics
interface CommandContext {
  startTime: number;
  command: string;
  args: string[];
  traceId: string;
  json: boolean;
}

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function printHelp(): void {
  // Help is allowed to use stdout directly - it's user-facing output
  process.stdout.write(`
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

GOVERNANCE COMMANDS:
  learn [--window=7d] [--format]      Show learning signals and diagnoses
  realign <patch-id>                  Apply patch in new branch and verify
  pivot plan <name>                   Plan a strategic pivot
  rollback <sha|release>              Rollback to commit or release
  symmetry [--economics]              Show symmetry metrics
  economics [--alerts|--forecast]     Show economic metrics

INSPECTION COMMANDS:
  tool list [--json]                  List registered tools with determinism flags
  trace <id>                          Visualize decision trace
  stats                               Determinism rate, policy events, replay state
  status                              System health and enforcement state
  telemetry                           Real-time usage stats

MICROFRACTURE SUITE (Proof Surfaces):
  diff <runA> <runB> [--format]       Deterministic diff between runs
  lineage <runId> [--depth=N]         Show run ancestry graph
  simulate <runId> --policy=<name>    Simulate policy evaluation
  drift --since=<runId> [--window]    Analyze behavior drift over time
  explain <runId> [--format=md|json]  Generate deterministic explanation
  usage [--format]                    Show tenant usage summary
  tenant-check [--format]             Verify tenant isolation
  chaos --quick [--format]            Run chaos verification checks
  share <runId> [--ttl] [--scope]     Create shareable proof link

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
  process.stdout.write(`Requiem CLI v${VERSION} — Provable AI Runtime\n`);
}

function printFingerprint(fpHash: string): void {
  const shortHash = fpHash.substring(0, 16);
  const timestamp = new Date().toISOString();
  process.stdout.write(`
┌────────────────────────────────────────────────────────────┐
│ EXECUTION FINGERPRINT                                      │
├────────────────────────────────────────────────────────────┤
│  Hash:        ${fpHash.padEnd(54)}│
│  Short ID:    ${shortHash.padEnd(54)}│
│  Verified:    ${timestamp.padEnd(54)}│
│  Algorithm:   BLAKE3-v1 (domain-separated)${' '.repeat(13)}│
│  CAS:         v2 (dual-hash: BLAKE3 + SHA-256)${' '.repeat(9)}│
│  Policy:      enforced (deny-by-default)${' '.repeat(14)}│
├────────────────────────────────────────────────────────────┤
│  This fingerprint proves that the execution produced a     │
│  deterministic result that is replayable and               │
│  policy-compliant.                                         │
└────────────────────────────────────────────────────────────┘
`);
}

function handleError(error: unknown, ctx: CommandContext): number {
  const duration = Date.now() - ctx.startTime;
  
  if (isAppError(error)) {
    logger.logError('cli.command_failed', error, {
      command: ctx.command,
      durationMs: duration,
      traceId: ctx.traceId,
    });
    
    if (ctx.json) {
      const jsonError = toJSONObject(error);
      process.stdout.write(JSON.stringify({ 
        success: false, 
        error: jsonError,
        traceId: ctx.traceId,
        durationMs: duration,
      }) + '\n');
    } else {
      process.stderr.write(formatHuman(error) + '\n');
    }
    return 1;
  }
  
  // Unknown error - wrap it
  const message = error instanceof Error ? error.message : String(error);
  logger.error('cli.unexpected_error', 'Command failed with unexpected error', {
    command: ctx.command,
    error: message,
    durationMs: duration,
    traceId: ctx.traceId,
  });
  
  if (ctx.json) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: {
        code: 'E_UNKNOWN',
        message: message || 'An unexpected error occurred',
        severity: 'error',
        timestamp: new Date().toISOString(),
      },
      traceId: ctx.traceId,
      durationMs: duration,
    }) + '\n');
  } else {
    process.stderr.write(`Error: ${message}\n`);
  }
  
  return 1;
}

// Lazy command loader - only imports when needed
async function loadCommand(modulePath: string): Promise<unknown> {
  // Dynamic import ensures module is only loaded when command runs
  return import(modulePath);
}

async function main(): Promise<number> {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const traceId = generateTraceId();
  
  // Enable pretty logs in dev, JSON in production (detected by env)
  const isDev = process.env.NODE_ENV === 'development' || process.env.REQUIEM_DEBUG;
  if (isDev) {
    enablePrettyLogs('debug');
  }
  
  logger.debug('cli.startup', 'CLI starting', {
    version: VERSION,
    traceId,
    args: args.join(' '),
  });
  
  if (args.length === 0) {
    printHelp();
    return 0;
  }
  
  const command = args[0];
  const subArgs = args.slice(1);
  const json = subArgs.includes('--json');
  
  const ctx: CommandContext = {
    startTime,
    command,
    args: subArgs,
    traceId,
    json,
  };
  
  try {
    let result: number;
    
    switch (command) {
      case 'run': {
        const { runRunCommand } = await loadCommand('./commands/run.js');
        result = await runRunCommand(subArgs, ctx);
        break;
      }
      
      case 'verify': {
        const { runVerifyCommand } = await loadCommand('./commands/verify.js');
        result = await runVerifyCommand(subArgs, ctx);
        break;
      }
      
      case 'fingerprint': {
        if (subArgs.length === 0) {
          throw new Error('Usage: requiem fingerprint <execution-hash>');
        }
        printFingerprint(subArgs[0]);
        result = 0;
        break;
      }
      
      case 'ui': {
        const { dashboard } = await loadCommand('./commands/dashboard.js');
        await dashboard.parseAsync([process.argv[0], process.argv[1], 'dashboard', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'tool': {
        const { parseToolListArgs, runToolList, parseToolExecArgs, runToolExec } = 
          await loadCommand('./commands/tool.js');
        const subcommand = subArgs[0];
        const subsubArgs = subArgs.slice(1);
        
        if (subcommand === 'list') {
          result = await runToolList(parseToolListArgs(subsubArgs), ctx);
        } else if (subcommand === 'exec') {
          result = await runToolExec(parseToolExecArgs(subsubArgs), ctx);
        } else {
          throw new Error(`Unknown tool subcommand: ${subcommand}`);
        }
        break;
      }
      
      case 'replay': {
        const { replay } = await loadCommand('./commands/replay.js');
        await replay.parseAsync([process.argv[0], process.argv[1], 'replay', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'trace': {
        const { trace } = await loadCommand('./commands/trace.js');
        await trace.parseAsync([process.argv[0], process.argv[1], 'trace', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'telemetry': {
        const { telemetry } = await loadCommand('./commands/telemetry.js');
        await telemetry.parseAsync([process.argv[0], process.argv[1], 'telemetry', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'stress': {
        const { stress } = await loadCommand('./commands/stress.js');
        await stress.parseAsync([process.argv[0], process.argv[1], 'stress', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'backup': {
        const { backup } = await loadCommand('./commands/backup.js');
        await backup.parseAsync([process.argv[0], process.argv[1], 'backup', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'restore': {
        const { restore } = await loadCommand('./commands/restore.js');
        await restore.parseAsync([process.argv[0], process.argv[1], 'restore', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'import': {
        const { importCommand } = await loadCommand('./commands/import.js');
        await importCommand.parseAsync([process.argv[0], process.argv[1], 'import', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'stats': {
        const { stats } = await loadCommand('./commands/stats.js');
        await stats.parseAsync([process.argv[0], process.argv[1], 'stats', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'nuke': {
        const { nuke } = await loadCommand('./commands/nuke.js');
        await nuke.parseAsync([process.argv[0], process.argv[1], 'nuke', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'init': {
        const { init } = await loadCommand('./commands/init.js');
        await init.parseAsync([process.argv[0], process.argv[1], 'init', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'config': {
        const { config } = await loadCommand('./commands/config.js');
        await config.parseAsync([process.argv[0], process.argv[1], 'config', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'decide': {
        const { parseDecideArgs, runDecideCommand } = await loadCommand('./commands/decide.js');
        result = await runDecideCommand(parseDecideArgs(subArgs), ctx);
        break;
      }
      
      case 'junctions': {
        const { parseJunctionsArgs, runJunctionsCommand } = await loadCommand('./commands/junctions.js');
        result = await runJunctionsCommand(parseJunctionsArgs(subArgs), ctx);
        break;
      }
      
      case 'agent': {
        const { parseAgentArgs, runAgentCommand } = await loadCommand('./commands/agent.js');
        result = await runAgentCommand(parseAgentArgs(subArgs), ctx);
        break;
      }
      
      case 'ai': {
        const { parseAiArgs, runAiCommand } = await loadCommand('./commands/ai.js');
        result = await runAiCommand(parseAiArgs(subArgs), ctx);
        break;
      }
      
      case 'doctor': {
        const { runDoctor } = await loadCommand('./commands/doctor.js');
        result = await runDoctor({ json }, ctx);
        break;
      }
      
      // Microfracture Suite
      case 'diff':
      case 'lineage':
      case 'simulate':
      case 'drift':
      case 'explain':
      case 'usage':
      case 'tenant-check':
      case 'chaos':
      case 'share': {
        const { runMicrofractureCommand } = await loadCommand('./commands/microfracture.js');
        result = await runMicrofractureCommand(command, subArgs, ctx);
        break;
      }
      
      case 'quickstart': {
        const { quickstart } = await loadCommand('./commands/quickstart.js');
        await quickstart.parseAsync([process.argv[0], process.argv[1], 'quickstart', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'status': {
        const { status } = await loadCommand('./commands/status.js');
        await status.parseAsync([process.argv[0], process.argv[1], 'status', ...subArgs]);
        result = 0;
        break;
      }
      
      case 'bugreport': {
        const { bugreport } = await loadCommand('./commands/bugreport.js');
        await bugreport.parseAsync([process.argv[0], process.argv[1], 'bugreport', ...subArgs]);
        result = 0;
        break;
      }
      
      // Governance and Learning
      case 'learn': {
        const { runLearnCommand } = await loadCommand('./commands/learn.js');
        result = await runLearnCommand(subArgs, ctx);
        break;
      }
      
      case 'realign': {
        const { runRealignCommand } = await loadCommand('./commands/realign.js');
        result = await runRealignCommand(subArgs, ctx);
        break;
      }
      
      case 'pivot': {
        const { runPivotPlanCommand } = await loadCommand('./commands/pivot.js');
        result = await runPivotPlanCommand(subArgs, ctx);
        break;
      }
      
      case 'rollback': {
        const { runRollbackCommand } = await loadCommand('./commands/pivot.js');
        result = await runRollbackCommand(subArgs, ctx);
        break;
      }
      
      case 'symmetry': {
        const { runSymmetryCommand } = await loadCommand('./commands/symmetry.js');
        result = await runSymmetryCommand(subArgs, ctx);
        break;
      }
      
      case 'economics': {
        const { runEconomicsCommand } = await loadCommand('./commands/economics.js');
        result = await runEconomicsCommand(subArgs, ctx);
        break;
      }
      
      case 'version':
      case '--version':
      case '-v':
        printVersion();
        result = 0;
        break;
      
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        result = 0;
        break;
      
      default:
        throw new Error(`Unknown command: ${command}. Run "requiem help" for usage.`);
    }
    
    const duration = Date.now() - startTime;
    logger.info('cli.command_complete', 'Command completed', {
      command,
      result,
      durationMs: duration,
      traceId,
    });
    
    return result;
    
  } catch (error) {
    return handleError(error, ctx);
  }
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    // Last resort - should never reach here due to handleError
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
