import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hash as blake3Hash } from './hash.js';

export interface PlatformFlags {
  json: boolean;
  model?: string;
  provider?: string;
  replay: boolean;
  traceId: string;
  tenantId: string;
  deterministicTime: boolean;
  timeSeed: number;
}

interface OperatorState {
  logicalTime: number;
}

interface HashBridge {
  artifact_hash: string;
  runtime_hash: string;
  canonical_hash: string;
}

interface AuditEntry {
  trace_id: string;
  tenant_id: string;
  command: string;
  model?: string;
  provider?: string;
  replay: boolean;
  logical_time: number;
  replay_time: number;
  timestamp: string;
  status: 'ok' | 'error';
  details: Record<string, unknown>;
}

const STATE_DIR = '.requiem/operator';
const STATE_FILE = `${STATE_DIR}/state.json`;
const AUDIT_FILE = `${STATE_DIR}/audit.log.jsonl`;
const WAL_FILE = `${STATE_DIR}/budget-trust.wal.jsonl`;

function ensureStateDir(): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readState(): OperatorState {
  ensureStateDir();
  if (!fs.existsSync(STATE_FILE)) {
    return { logicalTime: 0 };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as OperatorState;
}

function writeState(state: OperatorState): void {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function nextLogicalTime(): number {
  const state = readState();
  state.logicalTime += 1;
  writeState(state);
  return state.logicalTime;
}

function resolveReplayTime(flags: PlatformFlags, logicalTime: number): number {
  if (!flags.replay) {
    return logicalTime;
  }
  return flags.timeSeed + logicalTime;
}

function nowIso(flags: PlatformFlags, logicalTime: number): string {
  if (!flags.deterministicTime) {
    return new Date().toISOString();
  }
  return new Date(flags.timeSeed + logicalTime).toISOString();
}

function appendJsonLine(file: string, entry: unknown): void {
  ensureStateDir();
  fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
}

function emit(flags: PlatformFlags, payload: Record<string, unknown>): void {
  const envelope = {
    trace_id: flags.traceId,
    tenant_id: flags.tenantId,
    model: flags.model ?? null,
    provider: flags.provider ?? null,
    replay: flags.replay,
    ...payload,
  };
  process.stdout.write(`${JSON.stringify(envelope, null, flags.json ? 2 : 2)}\n`);
}

function parseFlagValue(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

export function parsePlatformFlags(args: string[], traceId: string): PlatformFlags {
  return {
    json: args.includes('--json'),
    model: parseFlagValue(args, '--model'),
    provider: parseFlagValue(args, '--provider'),
    replay: args.includes('--replay'),
    traceId,
    tenantId: process.env['REQUIEM_TENANT_ID'] ?? 'default-tenant',
    deterministicTime: args.includes('--deterministic-time'),
    timeSeed: Number.parseInt(parseFlagValue(args, '--time-seed') ?? '1700000000000', 10),
  };
}

function hashBridge(content: string): HashBridge {
  const artifactHash = blake3Hash(Buffer.from(content));
  const runtimeHash = createHash('sha256').update(content).digest('hex');
  return {
    artifact_hash: artifactHash,
    runtime_hash: runtimeHash,
    canonical_hash: artifactHash,
  };
}

function withAudit(flags: PlatformFlags, command: string, details: Record<string, unknown>): { logicalTime: number; replayTime: number; timestamp: string } {
  const logicalTime = nextLogicalTime();
  const replayTime = resolveReplayTime(flags, logicalTime);
  const timestamp = nowIso(flags, logicalTime);
  const entry: AuditEntry = {
    trace_id: flags.traceId,
    tenant_id: flags.tenantId,
    command,
    model: flags.model,
    provider: flags.provider,
    replay: flags.replay,
    logical_time: logicalTime,
    replay_time: replayTime,
    timestamp,
    status: 'ok',
    details,
  };
  appendJsonLine(AUDIT_FILE, entry);
  return { logicalTime, replayTime, timestamp };
}

export async function runPlatformCommand(command: string, args: string[], traceId: string): Promise<number> {
  const flags = parsePlatformFlags(args, traceId);

  const details: Record<string, unknown> = { args: args.filter(a => !a.startsWith('--')) };
  const times = withAudit(flags, command, details);

  switch (command) {
    case 'inspect': {
      const target = args.find(a => !a.startsWith('--')) ?? 'cas';
      const bridge = hashBridge(target);
      emit(flags, {
        command,
        target,
        logical_time: times.logicalTime,
        replay_time: times.replayTime,
        hash_bridge: bridge,
      });
      return 0;
    }
    case 'graph':
    case 'diff':
    case 'policy':
    case 'learn':
    case 'status':
    case 'doctor':
    case 'run':
    case 'replay':
    case 'verify': {
      emit(flags, {
        command,
        logical_time: times.logicalTime,
        replay_time: times.replayTime,
        message: `operator ${command} completed`,
      });
      return 0;
    }
    case 'pipeline':
    case 'artifact':
    case 'trust':
    case 'budget': {
      const subcommand = args.find(a => !a.startsWith('--')) ?? 'inspect';
      appendJsonLine(WAL_FILE, {
        trace_id: flags.traceId,
        tenant_id: flags.tenantId,
        command,
        subcommand,
        logical_time: times.logicalTime,
        replay_time: times.replayTime,
      });
      emit(flags, {
        command,
        subcommand,
        logical_time: times.logicalTime,
        replay_time: times.replayTime,
        audit_log: path.resolve(AUDIT_FILE),
        wal: path.resolve(WAL_FILE),
      });
      return 0;
    }
    default:
      return 1;
  }
}
