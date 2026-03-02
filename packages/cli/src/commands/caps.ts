#!/usr/bin/env node
/**
 * @fileoverview Capabilities command — Capability token management
 *
 * Commands:
 *   reach caps mint <name> [--expires=<duration>]    Mint a new capability token
 *   reach caps inspect <token>                      Inspect a capability token
 *   reach caps list [--tenant=<id>]                 List active capabilities
 *   reach caps revoke <token>                      Revoke a capability token
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: No secrets exposed - only fingerprints.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const CAPS_DIR = join(process.cwd(), '.reach', 'caps');
const CAPS_INDEX_FILE = join(CAPS_DIR, 'index.json');

interface Capability {
  id: string;
  name: string;
  fingerprint: string;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  revokedAt: string | null;
  metadata: Record<string, unknown>;
}

interface CapsIndex {
  capabilities: Record<string, Capability>;
  metadata: { version: string; createdAt: string };
}

function ensureCapsDir(): void {
  if (!existsSync(CAPS_DIR)) {
    mkdirSync(CAPS_DIR, { recursive: true });
  }
}

function loadIndex(): CapsIndex {
  ensureCapsDir();
  if (!existsSync(CAPS_INDEX_FILE)) {
    const emptyIndex: CapsIndex = {
      capabilities: {},
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    writeFileSync(CAPS_INDEX_FILE, JSON.stringify(emptyIndex, null, 2));
    return emptyIndex;
  }
  try {
    return JSON.parse(readFileSync(CAPS_INDEX_FILE, 'utf-8'));
  } catch {
    const emptyIndex: CapsIndex = {
      capabilities: {},
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    return emptyIndex;
  }
}

function saveIndex(index: CapsIndex): void {
  ensureCapsDir();
  writeFileSync(CAPS_INDEX_FILE, JSON.stringify(index, null, 2));
}

function computeFingerprint(cap: Omit<Capability, 'fingerprint'>): string {
  const content = JSON.stringify({
    id: cap.id,
    name: cap.name,
    createdAt: cap.createdAt,
    expiresAt: cap.expiresAt,
    metadata: cap.metadata,
  });
  return createHash('blake3').update(content).digest('hex');
}

function parseDuration(duration: string): Date | null {
  if (!duration) return null;
  
  const now = new Date();
  const match = duration.match(/^(\d+)([dhms])$/);
  
  if (!match) return null;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      now.setDate(now.getDate() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 's':
      now.setSeconds(now.getSeconds() + value);
      break;
  }
  
  return now;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

interface OutputContext {
  json: boolean;
  minimal: boolean;
}

function formatOutput(data: unknown, ctx: OutputContext): void {
  if (ctx.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (ctx.minimal && typeof data === 'object') {
    console.log(JSON.stringify(data));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

function formatCapabilityList(caps: Capability[], ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, capabilities: caps, count: caps.length }, ctx);
    return;
  }

  if (caps.length === 0) {
    console.log('No capabilities found.');
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Capabilities                                                               │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log('│ ID/Name                           Status    Expires    Fingerprint       │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  for (const cap of caps) {
    const status = cap.revoked ? 'REVOKED' : 'ACTIVE';
    const expires = cap.expiresAt ? cap.expiresAt.substring(0, 10) : 'never';
    const name = (cap.id.substring(0, 12) + '/' + cap.name).substring(0, 32).padEnd(32);
    console.log(`│ ${name} ${status.padEnd(9)} ${expires.padEnd(11)} ${cap.fingerprint.substring(0, 16)}... │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log(`Total: ${caps.length} capabilities`);
}

function formatCapabilityDetail(cap: Capability, ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, capability: cap }, ctx);
    return;
  }

  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Capability Detail                                         │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  ID:          ${cap.id.padEnd(50)}│`);
  console.log(`│  Name:        ${cap.name.padEnd(50)}│`);
  console.log(`│  Fingerprint: ${cap.fingerprint.padEnd(50)}│`);
  console.log(`│  Created:     ${cap.createdAt.padEnd(50)}│`);
  console.log(`│  Expires:     ${(cap.expiresAt || 'never').padEnd(50)}│`);
  console.log(`│  Status:      ${(cap.revoked ? 'REVOKED' : 'ACTIVE').padEnd(50)}│`);
  if (cap.revokedAt) {
    console.log(`│  Revoked:     ${cap.revokedAt.padEnd(50)}│`);
  }
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  Metadata                                                  │');
  console.log(`│  ${JSON.stringify(cap.metadata).substring(0, 58).padEnd(58)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createCapsCommand(): Command {
  const capsCmd = new Command('caps')
    .description('Capability tokens — mint, inspect, list, and revoke capabilities')
    .option('--json', 'Output in JSON format')
    .option('--minimal', 'Minimal output');

  // caps mint <name>
  capsCmd
    .command('mint <name>')
    .description('Mint a new capability token')
    .option('--expires <duration>', 'Expiration (e.g., 7d, 24h, 30m)')
    .option('--metadata <json>', 'JSON metadata string')
    .action(async (name: string, options: { expires?: string; metadata?: string }) => {
      const ctx = { json: capsCmd.opts().json || false, minimal: capsCmd.opts().minimal || false };

      try {
        const id = `cap_${randomBytes(8).toString('hex')}`;
        const createdAt = new Date().toISOString();
        const expiresAt = options.expires ? parseDuration(options.expires)?.toISOString() || null : null;
        
        let metadata: Record<string, unknown> = {};
        if (options.metadata) {
          try {
            metadata = JSON.parse(options.metadata);
          } catch {
            formatOutput({ ok: false, error: { code: 'invalid_metadata', message: 'Invalid JSON in --metadata' } }, ctx);
            process.exit(1);
          }
        }

        const capability: Capability = {
          id,
          name,
          fingerprint: '', // Will be computed
          createdAt,
          expiresAt,
          revoked: false,
          revokedAt: null,
          metadata,
        };

        capability.fingerprint = computeFingerprint(capability);

        const index = loadIndex();
        index.capabilities[id] = capability;
        saveIndex(index);

        const result = {
          ok: true,
          id,
          name,
          fingerprint: capability.fingerprint,
          fingerprintShort: capability.fingerprint.substring(0, 16),
          createdAt,
          expiresAt,
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Capability minted: ${name}`);
          console.log(`  ID: ${id}`);
          console.log(`  Fingerprint: ${capability.fingerprint.substring(0, 16)}...`);
          console.log(`  Created: ${createdAt}`);
          if (expiresAt) {
            console.log(`  Expires: ${expiresAt}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'caps_mint_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // caps inspect <token>
  capsCmd
    .command('inspect <token>')
    .description('Inspect a capability token by ID or fingerprint')
    .action(async (token: string) => {
      const ctx = { json: capsCmd.opts().json || false, minimal: capsCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        
        // Try to find by ID or fingerprint prefix
        let cap: Capability | null = null;
        
        // Direct ID lookup
        if (index.capabilities[token]) {
          cap = index.capabilities[token];
        } else {
          // Fingerprint lookup
          for (const [id, c] of Object.entries(index.capabilities)) {
            if (c.fingerprint.startsWith(token) || c.fingerprint === token) {
              cap = c;
              break;
            }
          }
        }

        if (!cap) {
          formatOutput({ ok: false, error: { code: 'cap_not_found', message: `Capability not found: ${token}` } }, ctx);
          process.exit(1);
        }

        formatCapabilityDetail(cap, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'caps_inspect_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // caps list
  capsCmd
    .command('list')
    .description('List active capabilities')
    .option('--all', 'Include revoked capabilities')
    .option('--limit <n>', 'Limit results', '50')
    .option('--offset <n>', 'Offset results', '0')
    .action(async (options: { all?: boolean; limit?: string; offset?: string }) => {
      const ctx = { json: capsCmd.opts().json || false, minimal: capsCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const limit = parseInt(options.limit || '50', 10);
        const offset = parseInt(options.offset || '0', 10);

        let caps = Object.values(index.capabilities);

        // Filter by status
        if (!options.all) {
          caps = caps.filter(cap => !cap.revoked);
        }

        // Check expiration
        const now = new Date();
        caps = caps.filter(cap => {
          if (cap.revoked) return options.all;
          if (!cap.expiresAt) return true;
          return new Date(cap.expiresAt) > now;
        });

        const total = caps.length;
        caps = caps.slice(offset, offset + limit);

        if (ctx.json) {
          formatOutput({ ok: true, capabilities: caps, total, limit, offset }, ctx);
        } else {
          formatCapabilityList(caps, ctx);
          if (total > limit) {
            console.log(`Showing ${offset + 1}-${offset + caps.length} of ${total}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'caps_list_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // caps revoke <token>
  capsCmd
    .command('revoke <token>')
    .description('Revoke a capability token')
    .option('--force', 'Skip confirmation')
    .action(async (token: string, options: { force?: boolean }) => {
      const ctx = { json: capsCmd.opts().json || false, minimal: capsCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        
        // Find the capability
        let cap: Capability | null = null;
        let capId: string = '';
        
        if (index.capabilities[token]) {
          capId = token;
          cap = index.capabilities[token];
        } else {
          for (const [id, c] of Object.entries(index.capabilities)) {
            if (c.fingerprint.startsWith(token) || c.fingerprint === token) {
              capId = id;
              cap = c;
              break;
            }
          }
        }

        if (!cap) {
          formatOutput({ ok: false, error: { code: 'cap_not_found', message: `Capability not found: ${token}` } }, ctx);
          process.exit(1);
        }

        if (cap.revoked) {
          formatOutput({ ok: false, error: { code: 'cap_already_revoked', message: `Capability already revoked: ${token}` } }, ctx);
          process.exit(1);
        }

        // Revoke
        cap.revoked = true;
        cap.revokedAt = new Date().toISOString();
        index.capabilities[capId] = cap;
        saveIndex(index);

        const result = {
          ok: true,
          id: cap.id,
          name: cap.name,
          revokedAt: cap.revokedAt,
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Capability revoked: ${cap.name}`);
          console.log(`  ID: ${cap.id}`);
          console.log(`  Revoked at: ${cap.revokedAt}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'caps_revoke_failed', message } }, ctx);
        process.exit(1);
      }
    });

  return capsCmd;
}

// Default export for dynamic imports
export default createCapsCommand;
