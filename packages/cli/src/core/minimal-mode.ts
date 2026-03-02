/**
 * Minimal Mode - Fast Help + Zero Overhead
 * 
 * When REQUIEM_MINIMAL=1:
 * - Disables ledger
 * - Disables signing
 * - Disables arbitration
 * - Raw execution path for benchmarks
 * 
 * For --help, version, status:
 * - No DB initialization
 * - No provider initialization
 * - Instant response
 */

import { env } from 'process';

// Commands that don't require heavy initialization
const FAST_HELP_COMMANDS = new Set([
  'help',
  '--help',
  '-h',
  'version',
  '--version',
  '-v',
]);

// Commands that need minimal init (no DB)
const MINIMAL_INIT_COMMANDS = new Set([
  'status',
  'doctor',
  'quickstart',
]);

export interface MinimalMode {
  enabled: boolean;
  skipLedger: boolean;
  skipSigning: boolean;
  skipArbitration: boolean;
  skipDB: boolean;
  skipProviders: boolean;
}

export function isMinimalMode(): boolean {
  return env.REQUIEM_MINIMAL === '1' || env.REQUIEM_MINIMAL === 'true';
}

export function shouldUseFastHelp(command: string): boolean {
  return FAST_HELP_COMMANDS.has(command);
}

export function shouldUseMinimalInit(command: string): boolean {
  return MINIMAL_INIT_COMMANDS.has(command) || isMinimalMode();
}

export function getMinimalMode(command: string): MinimalMode {
  const minimal = isMinimalMode();
  const fastHelp = shouldUseFastHelp(command);
  const minimalInit = shouldUseMinimalInit(command);

  return {
    enabled: minimal || fastHelp || minimalInit,
    skipLedger: minimal || fastHelp,
    skipSigning: minimal || fastHelp,
    skipArbitration: minimal || fastHelp,
    skipDB: minimal || fastHelp || minimalInit,
    skipProviders: minimal || fastHelp || minimalInit,
  };
}

// Lazy initialization wrapper
export async function withMinimalMode<T>(
  command: string,
  fn: (mode: MinimalMode) => Promise<T>
): Promise<T> {
  const mode = getMinimalMode(command);
  
  if (mode.enabled) {
    // Skip heavy initialization
    return fn(mode);
  }
  
  // Full initialization
  return fn(mode);
}

// Fast path for help/version
export function handleFastCommand(command: string, args: string[]): number {
  if (command === 'help' || command === '--help' || command === '-h') {
    printFastHelp();
    return 0;
  }
  
  if (command === 'version' || command === '--version' || command === '-v') {
    printFastVersion();
    return 0;
  }
  
  return -1; // Not handled
}

function printFastHelp(): void {
  process.stdout.write(`
Requiem CLI — Provable AI Runtime

USAGE:
  reach <command> [options]

CORE:
  run <name> [input]    Execute with determinism proof
  verify <hash>         Verify execution
  replay run <id>       Replay execution
  stats                 View metrics
  status                System health

GOVERNANCE:
  learn                 Learning signals
  symmetry              Show metrics
  economics             Cost metrics

INSPECTION:
  tool list             List tools
  trace <id>            Visualize trace

ADMIN:
  init                  Initialize config
  doctor                Validate setup
  backup                Dump database

OPTIONS:
  --json                JSON output
  --help, -h            Show help
  --version, -v         Show version

ENV:
  REQUIEM_MINIMAL=1     Disable ledger/signing
  REQUIEM_DEBUG=1       Enable debug logs

Run 'reach help' for full documentation.
`);
}

function printFastVersion(): void {
  const VERSION = '0.2.0';
  process.stdout.write(`Requiem CLI v${VERSION}\n`);
}
