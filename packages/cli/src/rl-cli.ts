#!/usr/bin/env node
/**
 * ReadyLayer CLI (rl) — Ergonomic Operator Console
 *
 * Binary: `rl`
 *
 * Commands:
 *   rl status / doctor / env / version
 *   rl system fingerprint
 *   rl models (list providers, show throttles, show defaults)
 *   rl mode set (intensity, thinking mode, tool policy)
 *   rl prompt (list/get/add/run) with deterministic prompt IDs (hash)
 *   rl run (start/replay/inspect) with run_id + trace_id and artifact export
 *   rl graph (show repo lineage graph / run graph)
 *   rl dataset (list/gen/validate/replay deterministic datasets)
 *
 * INVARIANT: Graceful degradation - no crashes if optional deps missing.
 * INVARIANT: Print actionable errors with run_id/trace_id.
 * INVARIANT: Deterministic serialization for all exports.
 */

import { formatError, ErrorCodes, ErrorHints } from './core/cli-helpers.js';
import { initializeOperatorConsoleTables } from './db/operator-console.js';

const VERSION = '0.3.0';

// Lazy loaded modules
let _coreModule: typeof import('./core/index.js') | null = null;
let _logger: typeof import('./core/index.js')['logger'] | null = null;

async function getCoreModule(): Promise<typeof import('./core/index.js')> {
  if (!_coreModule) {
    _coreModule = await import('./core/index.js');
  }
  return _coreModule;
}

async function getLogger(): Promise<typeof import('./core/index.js')['logger']> {
  if (!_logger) {
    const core = await getCoreModule();
    _logger = core.logger;
  }
  return _logger;
}

export interface CommandContext {
  startTime: number;
  command: string;
  args: string[];
  traceId: string;
  json: boolean;
  minimal: boolean;
  explain: boolean;
  trace: boolean;
}

function generateTraceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateRunId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function isLightweightAppError(error: unknown): error is { code: string; message: string; severity?: string } {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error;
}

// ─── Help Text ─────────────────────────────────────────────────────────────────

function printHelp(): void {
  process.stdout.write(`
ReadyLayer CLI v${VERSION}  —  Ergonomic Operator Console

USAGE:
  rl <command> [subcommand] [options]

CORE COMMANDS:
  status                              Show system health and ready state
  doctor                              Validate environment, print fixes
  env                                 Show environment configuration
  version                             Show version information

MODEL & PROVIDER COMMANDS:
  models list                         List all providers and models
  models show <provider>              Show provider details and throttles
  models defaults                     Show default provider settings

MODE COMMANDS:
  mode show                           Show current operator mode
  mode set intensity <level>          Set intensity: minimal|normal|aggressive
  mode set thinking <mode>            Set thinking: fast|balanced|deep
  mode set tool-policy <policy>       Set policy: deny_all|ask|allow_registered|allow_all

PROMPT COMMANDS:
  prompt list [--tag <tag>]           List prompt packs
  prompt get <name> [--version]       Get prompt content
  prompt add <name> <file>            Add a new prompt pack
  prompt run <name> [vars...]         Run a prompt with variables

RUN COMMANDS:
  run start <prompt> [vars...]        Start a new run
  run replay <run_id>                 Replay a previous run
  run inspect <run_id>                Inspect run details and artifacts
  run list [--limit N]                List recent runs

GRAPH COMMANDS:
  graph repo                          Show repository lineage graph
  graph run <run_id>                  Show run dependency graph
  graph trace <trace_id>              Show trace execution graph

SYSTEM COMMANDS:
  system fingerprint                  Emit runtime self-fingerprint + persist to CAS

DATASET COMMANDS:
  dataset list [--json]               List all registered datasets
  dataset gen <CODE> --seed <n>       Generate dataset artifacts
  dataset validate <CODE> --seed <n> Validate dataset
  dataset replay <run_id>             Replay a dataset run

INTEROP COMMANDS:
  interop ingest github --payload <json>    Normalize GitHub payload
  interop ingest sentry --payload <json>    Normalize Sentry payload

REVIEW COMMANDS:
  review run --engine <name> --proof <cas>  Run review engine
  review propose --review <cas>              Build correction proposal
  review open-pr --proposal <cas>            Prepare GitHub PR payload
  review verify --pr <number>                Verify replay for PR
  review arena --engines a,b,c               Compare multiple engines

OPTIONS:
  --json                              Output in JSON format
  --minimal                           Quiet, deterministic output
  --help, -h                          Show help for a command
  --version, -v                       Show version information

EXAMPLES:
  rl status                           Check system health
  rl models list                      List available providers
  rl mode set intensity aggressive    Set aggressive mode
  rl prompt list --tag review         List prompts tagged 'review'
  rl run start code_review file.ts    Run code review prompt
  rl run inspect run_abc123           Inspect run artifacts
  rl graph run run_abc123             Show run graph
`);
}

function printVersion(): void {
  process.stdout.write(`ReadyLayer CLI v${VERSION}\n`);
}

// ─── Error Handling ────────────────────────────────────────────────────────────

async function handleError(error: unknown, ctx: CommandContext): Promise<number> {
  const duration = Date.now() - ctx.startTime;

  // Generate error reference for user support
  const errorRef = `ERR-${ctx.traceId.slice(0, 8).toUpperCase()}`;

  if (isLightweightAppError(error)) {
    try {
      const logger = await getLogger();
      logger.error('rl.command_failed', error.message, {
        code: error.code,
        command: ctx.command,
        durationMs: duration,
        traceId: ctx.traceId,
        errorRef,
      });
    } catch {
      // Logger not available
    }

    const errorOutput = formatError({
      code: error.code,
      message: error.message,
      traceId: ctx.traceId,
      timestamp: new Date().toISOString(),
    }, ctx);

    process.stderr.write(errorOutput + '\n');
    process.stderr.write(`\nReference: ${errorRef}\n`);
    process.stderr.write(`Run 'rl doctor' for diagnostic information.\n`);
    return 1;
  }

  const message = error instanceof Error ? error.message : String(error);

  try {
    const logger = await getLogger();
    logger.error('rl.unexpected_error', 'Command failed with unexpected error', {
      command: ctx.command,
      error: message,
      durationMs: duration,
      traceId: ctx.traceId,
      errorRef,
    });
  } catch {
    // Logger failed to load
  }

  const errorOutput = formatError({
    code: ErrorCodes.E_UNKNOWN,
    message: message || 'An unexpected error occurred',
    hint: ErrorHints[ErrorCodes.E_UNKNOWN],
    traceId: ctx.traceId,
    timestamp: new Date().toISOString(),
  }, ctx);

  process.stderr.write(errorOutput + '\n');
  process.stderr.write(`\nReference: ${errorRef}\n`);
  process.stderr.write(`Run 'rl doctor' for diagnostic information.\n`);
  return 1;
}

// ─── Lazy Command Loader ───────────────────────────────────────────────────────

async function loadCommand(modulePath: string): Promise<unknown> {
  return import(modulePath);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  const traceId = generateTraceId();

  // Fast path for help/version
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    printHelp();
    return 0;
  }
  if (args[0] === '--version' || args[0] === '-v' || args[0] === 'version') {
    printVersion();
    return 0;
  }

  // Enable dev logging
  const isDev = process.env.NODE_ENV === 'development' || process.env.RL_DEBUG;
  if (isDev) {
    const core = await getCoreModule();
    core.enablePrettyLogs('debug');
  }

  const logger = await getLogger();
  logger.debug('rl.startup', 'ReadyLayer CLI starting', {
    version: VERSION,
    traceId,
    args: args.join(' '),
  });

  const command = args[0];
  const subArgs = args.slice(1);
  const json = subArgs.includes('--json');
  const minimal = subArgs.includes('--minimal');

  const ctx: CommandContext = {
    startTime,
    command,
    args: subArgs,
    traceId,
    json,
    minimal,
    explain: false,
    trace: false,
  };

  try {
    // Initialize operator console tables
    try {
      initializeOperatorConsoleTables();
    } catch (e) {
      logger.warn('rl.db_init', 'Failed to initialize operator console tables', {
        error: e instanceof Error ? e.message : String(e),
      });
      // Continue gracefully - tables may already exist
    }

    let result: number;

    switch (command) {
      // Core commands
      case 'status': {
        const { runStatus } = await loadCommand('./commands/rl-status.js') as {
          runStatus: (opts: { json: boolean }) => Promise<number>;
        };
        result = await runStatus({ json });
        break;
      }

      case 'doctor': {
        const { runDoctor } = await loadCommand('./commands/rl-doctor.js') as {
          runDoctor: (opts: { json: boolean; fix?: boolean }) => Promise<number>;
        };
        result = await runDoctor({ json, fix: subArgs.includes('--fix') });
        break;
      }

      case 'env': {
        const { runEnv } = await loadCommand('./commands/rl-env.js') as {
          runEnv: (opts: { json: boolean }) => Promise<number>;
        };
        result = await runEnv({ json });
        break;
      }

      // Model commands
      case 'models': {
        const { runModels } = await loadCommand('./commands/rl-models.js') as {
          runModels: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runModels(subArgs[0] ?? 'list', subArgs.slice(1), { json });
        break;
      }

      // Mode commands
      case 'mode': {
        const { runMode } = await loadCommand('./commands/rl-mode.js') as {
          runMode: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runMode(subArgs[0] ?? 'show', subArgs.slice(1), { json });
        break;
      }

      // Prompt commands
      case 'prompt': {
        const { runPrompt } = await loadCommand('./commands/rl-prompt.js') as {
          runPrompt: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runPrompt(subArgs[0] ?? 'list', subArgs.slice(1), { json });
        break;
      }

      // Run commands
      case 'run': {
        const runId = generateRunId();
        const { runRunCommand } = await loadCommand('./commands/rl-run.js') as {
          runRunCommand: (subcommand: string, args: string[], opts: { json: boolean; traceId: string; runId: string }) => Promise<number>;
        };
        result = await runRunCommand(subArgs[0] ?? 'list', subArgs.slice(1), { json, traceId, runId });
        break;
      }

      // Graph commands
      case 'graph': {
        const { runGraph } = await loadCommand('./commands/rl-graph.js') as {
          runGraph: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runGraph(subArgs[0] ?? 'repo', subArgs.slice(1), { json });
        break;
      }


      // System commands
      case 'system': {
        const { runSystem } = await loadCommand('./commands/rl-system.js') as {
          runSystem: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runSystem(subArgs[0] ?? 'fingerprint', subArgs.slice(1), { json });
      // Interop commands
      case 'interop': {
        const { runInterop } = await loadCommand('./commands/rl-interop.js') as {
          runInterop: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runInterop(subArgs[0] ?? 'ingest', subArgs.slice(1), { json });
        break;
      }

      // Review commands
      case 'review': {
        const { runReview } = await loadCommand('./commands/rl-review.js') as {
          runReview: (subcommand: string, args: string[], opts: { json: boolean }) => Promise<number>;
        };
        result = await runReview(subArgs[0] ?? 'run', subArgs.slice(1), { json });
        break;
      }

      // Dataset commands (Test Data Foundry)
      case 'dataset':
      case 'ds': {
        const { runDataset } = await loadCommand('./commands/dataset.js') as {
          runDataset: (subcommand: string, args: string[], opts: { json?: boolean }) => Promise<void>;
        };
        await runDataset(subArgs[0] ?? 'list', subArgs.slice(1), { json });
        result = 0;
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}. Run "rl help" for usage.`);
    }

    const duration = Date.now() - startTime;
    logger.info('rl.command_complete', 'Command completed', {
      command,
      result,
      durationMs: duration,
      traceId,
    });

    return result;

  } catch (error) {
    return await handleError(error, ctx);
  }
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
