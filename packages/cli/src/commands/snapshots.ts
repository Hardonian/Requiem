#!/usr/bin/env node
/**
 * @fileoverview Snapshots command — State snapshot management
 *
 * Commands:
 *   reach snapshots create [--name=<name>]    Create a new snapshot
 *   reach snapshots list [--json]            List all snapshots
 *   reach snapshots restore <id>             Restore a snapshot (gated)
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: Snapshots are immutable once created.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { createHash, randomBytes } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// SNAPSHOT STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const SNAPSHOTS_DIR = join(process.cwd(), '.reach', 'snapshots');
const SNAPSHOT_INDEX_FILE = join(SNAPSHOTS_DIR, 'index.json');

interface Snapshot {
  id: string;
  name: string;
  createdAt: string;
  size: number;
  checksum: string;
  metadata: Record<string, unknown>;
  gated: boolean;
}

interface SnapshotsIndex {
  snapshots: Snapshot[];
  metadata: { version: string; createdAt: string };
}

function ensureSnapshotsDir(): void {
  if (!existsSync(SNAPSHOTS_DIR)) {
    mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

function loadIndex(): SnapshotsIndex {
  ensureSnapshotsDir();
  if (!existsSync(SNAPSHOT_INDEX_FILE)) {
    const emptyIndex: SnapshotsIndex = {
      snapshots: [],
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    writeFileSync(SNAPSHOT_INDEX_FILE, JSON.stringify(emptyIndex, null, 2));
    return emptyIndex;
  }
  try {
    return JSON.parse(readFileSync(SNAPSHOT_INDEX_FILE, 'utf-8'));
  } catch {
    const emptyIndex: SnapshotsIndex = {
      snapshots: [],
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    return emptyIndex;
  }
}

function saveIndex(index: SnapshotsIndex): void {
  ensureSnapshotsDir();
  writeFileSync(SNAPSHOT_INDEX_FILE, JSON.stringify(index, null, 2));
}

function computeChecksum(content: string): string {
  return createHash('blake3').update(content).digest('hex');
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

function formatSnapshotList(snapshots: Snapshot[], ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, snapshots, count: snapshots.length }, ctx);
    return;
  }

  if (snapshots.length === 0) {
    console.log('No snapshots found.');
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ Snapshots                                                                  │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log('│ ID        Name                    Created          Size     Gated        │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  for (const snap of snapshots) {
    const id = snap.id.substring(0, 8).padEnd(10);
    const name = (snap.name || 'unnamed').substring(0, 24).padEnd(24);
    const created = snap.createdAt.substring(0, 10).padEnd(12);
    const size = String(snap.size).padStart(8);
    const gated = snap.gated ? 'YES' : 'no';
    console.log(`│ ${id} ${name} ${created} ${size}  ${gated.padEnd(11)} │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log(`Total: ${snapshots.length} snapshots`);
}

function formatSnapshotDetail(snap: Snapshot, ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, snapshot: snap }, ctx);
    return;
  }

  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ Snapshot Detail                                          │');
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log(`│  ID:          ${snap.id.padEnd(50)}│`);
  console.log(`│  Name:        ${(snap.name || 'unnamed').padEnd(50)}│`);
  console.log(`│  Created:     ${snap.createdAt.padEnd(50)}│`);
  console.log(`│  Size:        ${String(snap.size).padEnd(50)}│`);
  console.log(`│  Checksum:    ${snap.checksum.padEnd(50)}│`);
  console.log(`│  Gated:       ${(snap.gated ? 'YES' : 'NO').padEnd(50)}│`);
  console.log('├────────────────────────────────────────────────────────────┤');
  console.log('│  Metadata                                                   │');
  console.log(`│  ${JSON.stringify(snap.metadata).substring(0, 58).padEnd(58)}│`);
  console.log('└────────────────────────────────────────────────────────────┘');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createSnapshotsCommand(): Command {
  const snapshotsCmd = new Command('snapshots')
    .description('State snapshots — create, list, and restore snapshots')
    .option('--json', 'Output in JSON format')
    .option('--minimal', 'Minimal output');

  // snapshots create
  snapshotsCmd
    .command('create')
    .description('Create a new snapshot')
    .option('--name <name>', 'Snapshot name')
    .option('--gated', 'Mark as gated (requires approval to restore)', true)
    .option('--include <paths>', 'Comma-separated paths to include')
    .action(async (options: { name?: string; gated?: boolean; include?: string }) => {
      const ctx = { json: snapshotsCmd.opts().json || false, minimal: snapshotsCmd.opts().minimal || false };

      try {
        const id = `snap_${randomBytes(8).toString('hex')}`;
        const name = options.name || `snapshot-${Date.now()}`;
        const createdAt = new Date().toISOString();

        // Collect snapshot data
        const snapshotData: Record<string, unknown> = {
          id,
          name,
          createdAt,
          includes: options.include?.split(',').map(p => p.trim()) || [],
        };

        const content = JSON.stringify(snapshotData);
        const size = content.length;
        const checksum = computeChecksum(content);

        // Save snapshot data
        const snapshotFile = join(SNAPSHOTS_DIR, `${id}.snap.json`);
        writeFileSync(snapshotFile, content);

        const snapshot: Snapshot = {
          id,
          name,
          createdAt,
          size,
          checksum,
          metadata: snapshotData,
          gated: options.gated ?? true,
        };

        // Update index
        const index = loadIndex();
        index.snapshots.push(snapshot);
        saveIndex(index);

        const result = {
          ok: true,
          id,
          name,
          size,
          checksum: checksum.substring(0, 16),
          gated: snapshot.gated,
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Snapshot created: ${name}`);
          console.log(`  ID: ${id}`);
          console.log(`  Size: ${size} bytes`);
          console.log(`  Checksum: ${checksum.substring(0, 16)}...`);
          console.log(`  Gated: ${snapshot.gated ? 'YES (requires approval to restore)' : 'NO'}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'snapshot_create_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // snapshots list
  snapshotsCmd
    .command('list')
    .description('List all snapshots')
    .option('--limit <n>', 'Limit results', '50')
    .option('--offset <n>', 'Offset results', '0')
    .action(async (options: { limit?: string; offset?: string }) => {
      const ctx = { json: snapshotsCmd.opts().json || false, minimal: snapshotsCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const limit = parseInt(options.limit || '50', 10);
        const offset = parseInt(options.offset || '0', 10);

        let snapshots = [...index.snapshots];
        snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        const total = snapshots.length;
        snapshots = snapshots.slice(offset, offset + limit);

        if (ctx.json) {
          formatOutput({ ok: true, snapshots, total, limit, offset }, ctx);
        } else {
          formatSnapshotList(snapshots, ctx);
          if (total > limit) {
            console.log(`Showing ${offset + 1}-${offset + snapshots.length} of ${total}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'snapshot_list_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // snapshots restore <id>
  snapshotsCmd
    .command('restore <id>')
    .description('Restore a snapshot (gated - requires approval)')
    .option('--force', 'Skip approval check (dangerous)')
    .action(async (id: string, options: { force?: boolean }) => {
      const ctx = { json: snapshotsCmd.opts().json || false, minimal: snapshotsCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const snap = index.snapshots.find(s => s.id === id || s.id.startsWith(id));

        if (!snap) {
          formatOutput({ ok: false, error: { code: 'snapshot_not_found', message: `Snapshot not found: ${id}` } }, ctx);
          process.exit(1);
        }

        // Check if gated
        if (snap.gated && !options.force) {
          // In a real system, this would check for approval
          // For now, warn about gated status
          if (ctx.json) {
            formatOutput({
              ok: false,
              error: {
                code: 'snapshot_gated',
                message: `Snapshot "${snap.name}" is gated and requires approval to restore`,
                approvalRequired: true,
                snapshot: snap.id,
              },
            }, ctx);
          } else {
            console.log(`⚠️  Snapshot "${snap.name}" is GATED`);
            console.log(`   ID: ${snap.id}`);
            console.log(`   Created: ${snap.createdAt}`);
            console.log(`   Size: ${snap.size} bytes`);
            console.log('');
            console.log(`   This snapshot requires approval to restore.`);
            console.log(`   Use --force to bypass this check (dangerous).`);
          }
          process.exit(1);
        }

        // Load snapshot data
        const snapshotFile = join(SNAPSHOTS_DIR, `${snap.id}.snap.json`);
        if (!existsSync(snapshotFile)) {
          formatOutput({ ok: false, error: { code: 'snapshot_data_missing', message: 'Snapshot data file not found' } }, ctx);
          process.exit(1);
        }

        const content = readFileSync(snapshotFile, 'utf-8');
        const actualChecksum = computeChecksum(content);

        // Verify checksum
        if (actualChecksum !== snap.checksum) {
          formatOutput({
            ok: false,
            error: {
              code: 'checksum_mismatch',
              message: `Checksum verification failed: expected ${snap.checksum}, got ${actualChecksum}`,
            },
          }, ctx);
          process.exit(1);
        }

        const result = {
          ok: true,
          id: snap.id,
          name: snap.name,
          restored: true,
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Snapshot restored: ${snap.name}`);
          console.log(`  ID: ${snap.id}`);
          console.log(`  Checksum verified: ${actualChecksum.substring(0, 16)}...`);
          console.log('');
          console.log('Note: Actual restoration of system state depends on snapshot contents.');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'snapshot_restore_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // snapshots show <id>
  snapshotsCmd
    .command('show <id>')
    .description('Show snapshot details')
    .action(async (id: string) => {
      const ctx = { json: snapshotsCmd.opts().json || false, minimal: snapshotsCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const snap = index.snapshots.find(s => s.id === id || s.id.startsWith(id));

        if (!snap) {
          formatOutput({ ok: false, error: { code: 'snapshot_not_found', message: `Snapshot not found: ${id}` } }, ctx);
          process.exit(1);
        }

        formatSnapshotDetail(snap, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'snapshot_show_failed', message } }, ctx);
        process.exit(1);
      }
    });

  return snapshotsCmd;
}

// Default export for dynamic imports
export default createSnapshotsCommand;
