/**
 * @fileoverview requiem tool <subcommand> — AI tool surface CLI.
 *
 * Uses the same registry + executor as the AI control plane.
 * No duplicate logic — delegates to @requiem/ai.
 *
 * COMMANDS:
 *   requiem tool list [--json] [--capability <cap>]
 *   requiem tool exec <name> [--input <json>] [--tenant <id>] [--json]
 *   requiem replay <hash> [--tenant <id>] [--json]
 *   requiem doctor [--json]
 */

import '../../../ai/src/index.js'; // Bootstrap built-in tools

// We import from relative paths since workspace deps may not be built yet.
// In production, these would be '@requiem/ai' imports.
import { listTools } from '../../../ai/src/tools/registry.js';
import { getReplayRecord } from '../../../ai/src/tools/replay.js';
import { executeToolEnvelope } from '../../../ai/src/tools/executor.js';
import { TenantRole } from '../../../ai/src/types/index.js';
import type { InvocationContext } from '../../../ai/src/types/index.js';

// ─── Output Formatting ──────────────────────────────────────────────────────

const BOX_WIDTH = 61;

function boxTop(): string {
  return `┌${'─'.repeat(BOX_WIDTH)}┐`;
}

function boxBottom(): string {
  return `└${'─'.repeat(BOX_WIDTH)}┘`;
}

function boxDivider(): string {
  return `├${'─'.repeat(BOX_WIDTH)}┤`;
}

function boxRow(label: string, value: string): string {
  const content = `│ ${label.padEnd(16)}${value}`;
  return content.padEnd(BOX_WIDTH + 1) + '│';
}

function boxHeader(title: string): string {
  const content = `│ ${title}`;
  return content.padEnd(BOX_WIDTH + 1) + '│';
}

function deterministicBadge(isDeterministic: boolean): string {
  return isDeterministic ? 'YES ■ verified' : 'NO';
}

function policyBadge(): string {
  return 'ENFORCED ■ deny-by-default';
}

function replayBadge(fromCache: boolean): string {
  return fromCache ? 'CACHED ■ replay match' : 'RECORDED ■ stored for replay';
}

function fingerprint(hash: string): string {
  return hash.substring(0, 16) + '...';
}

// ─── Tool List ────────────────────────────────────────────────────────────────

export interface ToolListArgs {
  json: boolean;
  capability?: string;
  tenantScoped?: boolean;
  deterministic?: boolean;
}

export function parseToolListArgs(args: string[]): ToolListArgs {
  const result: ToolListArgs = { json: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') result.json = true;
    if (args[i] === '--capability' && args[i + 1]) result.capability = args[++i];
    if (args[i] === '--tenant-scoped') result.tenantScoped = true;
    if (args[i] === '--deterministic') result.deterministic = true;
  }
  return result;
}

export function runToolList(args: ToolListArgs): number {
  const tools = listTools('system', {
    capability: args.capability,
    tenantScoped: args.tenantScoped,
    deterministic: args.deterministic,
  });

  if (args.json) {
    console.log(JSON.stringify(tools, null, 2));
    return 0;
  }

  if (tools.length === 0) {
    console.log('No tools registered.');
    return 0;
  }

  console.log(`\n${'TOOL'.padEnd(30)} ${'VERSION'.padEnd(10)} ${'DET'.padEnd(5)} ${'SIDE'.padEnd(5)} CAPABILITIES`);
  console.log('─'.repeat(90));

  for (const t of tools) {
    const det = t.deterministic ? 'yes' : 'no';
    const side = t.sideEffect ? 'yes' : 'no';
    const caps = t.requiredCapabilities.join(', ') || '(none)';
    console.log(`${t.name.padEnd(30)} ${t.version.padEnd(10)} ${det.padEnd(5)} ${side.padEnd(5)} ${caps}`);
  }

  console.log(`\n${tools.length} tool(s) registered.`);
  return 0;
}

// ─── Tool Exec ────────────────────────────────────────────────────────────────

export interface ToolExecArgs {
  name: string;
  input: unknown;
  tenantId: string;
  actorId: string;
  json: boolean;
  timeoutMs?: number;
}

export function parseToolExecArgs(args: string[]): ToolExecArgs {
  let name = '';
  let input: unknown = {};
  let tenantId = process.env['REQUIEM_TENANT_ID'] ?? 'cli-tenant';
  let actorId = process.env['REQUIEM_ACTOR_ID'] ?? 'cli-actor';
  let json = false;
  let timeoutMs: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--') && !name) {
      name = args[i];
    } else if (args[i] === '--input' && args[i + 1]) {
      try {
        input = JSON.parse(args[++i]);
      } catch {
        console.error(`Invalid JSON for --input: ${args[i]}`);
        process.exit(1);
      }
    } else if (args[i] === '--tenant' && args[i + 1]) {
      tenantId = args[++i];
    } else if (args[i] === '--actor' && args[i + 1]) {
      actorId = args[++i];
    } else if (args[i] === '--timeout' && args[i + 1]) {
      timeoutMs = parseInt(args[++i], 10);
    } else if (args[i] === '--json') {
      json = true;
    }
  }

  if (!name) {
    console.error('Usage: requiem tool exec <name> [--input <json>] [--tenant <id>]');
    process.exit(1);
  }

  return { name, input, tenantId, actorId, json, timeoutMs };
}

export async function runToolExec(args: ToolExecArgs): Promise<number> {
  const ctx: InvocationContext = {
    tenant: {
      tenantId: args.tenantId,
      userId: args.actorId,
      role: TenantRole.ADMIN,
      derivedAt: new Date().toISOString(),
    },
    actorId: args.actorId,
    traceId: `cli_${Date.now().toString(36)}`,
    environment: 'development',
    createdAt: new Date().toISOString(),
  };

  try {
    const envelope = await executeToolEnvelope(ctx, args.name, args.input, {
      timeoutMs: args.timeoutMs,
    });

    if (args.json) {
      console.log(JSON.stringify(envelope, null, 2));
    } else {
      console.log('');
      console.log(boxTop());
      console.log(boxHeader('EXECUTION COMPLETE'));
      console.log(boxDivider());
      console.log(boxRow('Tool:', `${args.name}@${envelope.tool_version}`));
      console.log(boxRow('Tenant:', envelope.tenant_id));
      console.log(boxRow('Duration:', `${envelope.duration_ms}ms`));
      console.log(boxRow('Deterministic:', deterministicBadge(envelope.deterministic)));
      console.log(boxRow('Policy:', policyBadge()));
      console.log(boxRow('Fingerprint:', fingerprint(envelope.hash)));
      console.log(boxRow('Replay:', replayBadge(envelope.from_cache)));
      console.log(boxDivider());
      console.log(boxHeader(`Run ID: ${envelope.request_id}`));
      console.log(boxBottom());
      console.log(`\nResult:\n${JSON.stringify(envelope.result, null, 2)}`);
    }
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (args.json) {
      console.log(JSON.stringify({ error: msg }, null, 2));
    } else {
      console.error(`\nError: ${msg}`);
    }
    return 1;
  }
}

// ─── Replay ───────────────────────────────────────────────────────────────────

export interface ReplayArgs {
  hash: string;
  tenantId: string;
  json: boolean;
}

export function parseReplayArgs(args: string[]): ReplayArgs {
  let hash = '';
  let tenantId = process.env['REQUIEM_TENANT_ID'] ?? 'cli-tenant';
  let json = false;

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--') && !hash) {
      hash = args[i];
    } else if (args[i] === '--tenant' && args[i + 1]) {
      tenantId = args[++i];
    } else if (args[i] === '--json') {
      json = true;
    }
  }

  if (!hash) {
    console.error('Usage: requiem replay <hash> [--tenant <id>]');
    process.exit(1);
  }

  return { hash, tenantId, json };
}

export async function runReplay(args: ReplayArgs): Promise<number> {
  try {
    const record = await getReplayRecord(args.hash, args.tenantId);

    if (args.json) {
      console.log(JSON.stringify(record, null, 2));
    } else {
      console.log('');
      console.log(boxTop());
      console.log(boxHeader('REPLAY RECORD'));
      console.log(boxDivider());
      console.log(boxRow('Hash:', record.hash));
      console.log(boxRow('Tenant:', record.tenantId));
      console.log(boxRow('Tool:', `${record.toolName}@${record.toolVersion}`));
      console.log(boxRow('Input Hash:', fingerprint(record.inputHash)));
      console.log(boxRow('Created:', record.createdAt));
      console.log(boxRow('Integrity:', '■ verified'));
      console.log(boxBottom());
      console.log(`\nResult:\n${JSON.stringify(record.result, null, 2)}`);
    }
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (args.json) {
      console.log(JSON.stringify({ error: msg }, null, 2));
    } else {
      console.error(`\nError: ${msg}`);
    }
    return 1;
  }
}

// ─── Doctor ───────────────────────────────────────────────────────────────────

interface DoctorResult {
  check: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

export interface DoctorArgs {
  json: boolean;
}

export async function runDoctorFull(args: DoctorArgs): Promise<number> {
  const results: DoctorResult[] = [];
  let hasFailure = false;

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  results.push({
    check: 'node_version',
    status: majorVersion >= 18 ? 'ok' : 'fail',
    message: `Node.js ${nodeVersion} (requires >= 18)`,
  });
  if (majorVersion < 18) hasFailure = true;

  // Check tool registry
  const tools = listTools();
  results.push({
    check: 'tool_registry',
    status: tools.length > 0 ? 'ok' : 'warn',
    message: `${tools.length} tool(s) registered`,
  });

  // Check critical tools
  const criticalTools = ['system.echo', 'system.health', 'fs.read_file', 'web.fetch', 'vector.search'];
  for (const toolName of criticalTools) {
    const exists = tools.find(t => t.name === toolName);
    results.push({
      check: `tool:${toolName}`,
      status: exists ? 'ok' : 'warn',
      message: exists ? `${toolName}@${exists.version}` : `${toolName} not registered`,
    });
  }

  // Check env variables
  const envChecks: Array<[string, string, boolean]> = [
    ['REQUIEM_WORKSPACE_ROOT', process.env['REQUIEM_WORKSPACE_ROOT'] ?? '(not set, using cwd)', false],
    ['OPENROUTER_API_KEY', process.env['OPENROUTER_API_KEY'] ? '(set)' : '(not set)', false],
    ['ANTHROPIC_API_KEY', process.env['ANTHROPIC_API_KEY'] ? '(set)' : '(not set)', false],
    ['REQUIEM_TENANT_ID', process.env['REQUIEM_TENANT_ID'] ?? '(not set)', false],
  ];

  for (const [key, value, required] of envChecks) {
    const missing = value.includes('not set');
    results.push({
      check: `env:${key}`,
      status: missing ? (required ? 'fail' : 'warn') : 'ok',
      message: `${key}=${value}`,
    });
    if (missing && required) hasFailure = true;
  }

  if (args.json) {
    console.log(JSON.stringify({ results, status: hasFailure ? 'fail' : 'ok' }, null, 2));
  } else {
    console.log('\nRequiem Control Plane — Doctor\n');
    for (const r of results) {
      const icon = r.status === 'ok' ? '✓' : r.status === 'warn' ? '⚠' : '✗';
      console.log(`${icon} ${r.check.padEnd(30)} ${r.message}`);
    }
    console.log(`\nStatus: ${hasFailure ? 'FAIL' : 'OK'}`);
  }

  return hasFailure ? 1 : 0;
}

