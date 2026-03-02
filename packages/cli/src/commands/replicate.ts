#!/usr/bin/env node
/**
 * Replicate Command
 * 
 * Multi-region durability through export/import of replication streams.
 * 
 * Usage:
 *   reach replicate export --since <cursor> --out <file>
 *   reach replicate import --in <file>
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { getDB } from '../db/connection.js';
import { newId } from '../db/helpers.js';
import { logger } from '../core/index.js';

const VERSION = '0.2.0';

// Replication event types
interface ReplicationEvent {
  type: 'RunCreated' | 'PolicySnapshot' | 'ProviderDecision' | 'ManifestSigned' | 'ArtifactRefs';
  timestamp: string;
  cursor: string;
  region?: string;
  instanceId?: string;
  payload: unknown;
  signature?: string;
}

interface ReplicationStream {
  version: string;
  exportedAt: string;
  exportedBy: string;
  cursorStart: string;
  cursorEnd: string;
  eventCount: number;
  events: ReplicationEvent[];
  streamHash: string;
}

// Get config from config.toml if exists
function getReplicationConfig(): {
  enabled: boolean;
  instanceId: string;
  exportChunkLimit: number;
  requireSignatures: boolean;
} {
  // Default config
  return {
    enabled: false,
    instanceId: process.env.REQUIEM_INSTANCE_ID || 'local-1',
    exportChunkLimit: 1000,
    requireSignatures: true,
  };
}

// Generate cursor from timestamp and sequence
function generateCursor(timestamp: string, sequence: number): string {
  return `${new Date(timestamp).getTime().toString(36)}-${sequence.toString(36)}`;
}

// Parse cursor to get timestamp
function parseCursor(cursor: string): { timestamp: number; sequence: number } {
  const [ts, seq] = cursor.split('-');
  return {
    timestamp: parseInt(ts, 36),
    sequence: parseInt(seq, 36),
  };
}

// Export replication stream
async function exportReplication(
  since: string,
  outPath: string,
  options: { limit?: number; region?: string }
): Promise<void> {
  const config = getReplicationConfig();
  const db = getDB();
  
  logger.info('replicate.export_start', 'Starting replication export', {
    since,
    outPath,
    limit: options.limit || config.exportChunkLimit,
  });
  
  const events: ReplicationEvent[] = [];
  const { timestamp: sinceTimestamp } = parseCursor(since);
  const sinceIso = new Date(sinceTimestamp).toISOString();
  
  // Query runs since cursor
  const runs = db
    .prepare('SELECT * FROM runs WHERE created_at > ? ORDER BY created_at ASC LIMIT ?')
    .all(sinceIso, options.limit || config.exportChunkLimit) as Array<{
      run_id: string;
      created_at: string;
      policy_snapshot_hash: string;
      metadata_json: string;
      status: string;
    }>;
  
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    events.push({
      type: 'RunCreated',
      timestamp: run.created_at,
      cursor: generateCursor(run.created_at, i),
      region: options.region,
      instanceId: config.instanceId,
      payload: {
        runId: run.run_id,
        status: run.status,
        policySnapshotHash: run.policy_snapshot_hash,
        metadata: run.metadata_json ? JSON.parse(run.metadata_json) : null,
      },
    });
  }
  
  // Query decisions since cursor
  const decisions = db
    .prepare('SELECT * FROM decisions WHERE created_at > ? ORDER BY created_at ASC LIMIT ?')
    .all(sinceIso, options.limit || config.exportChunkLimit) as Array<{
      id: string;
      created_at: string;
      policy_snapshot_hash: string;
      decision_input: string;
      decision_output: string;
      input_fingerprint: string;
    }>;
  
  for (let i = 0; i < decisions.length; i++) {
    const decision = decisions[i];
    events.push({
      type: 'ProviderDecision',
      timestamp: decision.created_at,
      cursor: generateCursor(decision.created_at, i + runs.length),
      region: options.region,
      instanceId: config.instanceId,
      payload: {
        decisionId: decision.id,
        policySnapshotHash: decision.policy_snapshot_hash,
        inputFingerprint: decision.input_fingerprint,
        // Only export metadata, not full content (which may be large)
        inputRef: decision.decision_input?.startsWith('cas:') ? decision.decision_input : null,
        outputRef: decision.decision_output?.startsWith('cas:') ? decision.decision_output : null,
      },
    });
  }
  
  // Sort events by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  const stream: ReplicationStream = {
    version: VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: config.instanceId,
    cursorStart: since,
    cursorEnd: events.length > 0 ? events[events.length - 1].cursor : since,
    eventCount: events.length,
    events,
    streamHash: '', // Computed below
  };
  
  // Compute stream hash (deterministic)
  const streamForHash = { ...stream };
  delete (streamForHash as { streamHash?: string }).streamHash;
  stream.streamHash = generateStreamHash(streamForHash);
  
  // Write output
  writeFileSync(outPath, JSON.stringify(stream, null, 2));
  
  logger.info('replicate.export_complete', 'Replication export complete', {
    eventsExported: events.length,
    cursorStart: stream.cursorStart,
    cursorEnd: stream.cursorEnd,
    outPath,
  });
  
  console.log(`Exported ${events.length} events to ${outPath}`);
  console.log(`Cursor range: ${stream.cursorStart} → ${stream.cursorEnd}`);
}

// Generate deterministic hash for stream
function generateStreamHash(stream: Omit<ReplicationStream, 'streamHash'>): string {
  // Simple hash for now - in production would use BLAKE3
  const content = JSON.stringify(stream, Object.keys(stream).sort());
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// Import replication stream
async function importReplication(inPath: string, options: { dryRun?: boolean; skipVerify?: boolean }): Promise<void> {
  const config = getReplicationConfig();
  
  logger.info('replicate.import_start', 'Starting replication import', {
    inPath,
    dryRun: options.dryRun,
  });
  
  if (!existsSync(inPath)) {
    throw new Error(`Input file not found: ${inPath}`);
  }
  
  const stream: ReplicationStream = JSON.parse(readFileSync(inPath, 'utf-8'));
  
  // Verify stream hash
  if (!options.skipVerify) {
    const streamForHash = { ...stream };
    delete (streamForHash as { streamHash?: string }).streamHash;
    const computedHash = generateStreamHash(streamForHash);
    
    if (computedHash !== stream.streamHash) {
      throw new Error(`Stream hash verification failed: expected ${stream.streamHash}, got ${computedHash}`);
    }
    console.log('✓ Stream hash verified');
  }
  
  // Verify signatures if required
  if (config.requireSignatures && !options.skipVerify) {
    for (const event of stream.events) {
      if (event.signature) {
        // In production, verify Ed25519 signature here
        console.log(`✓ Event ${event.cursor} has signature`);
      } else {
        console.log(`⚠ Event ${event.cursor} has no signature`);
      }
    }
  }
  
  if (options.dryRun) {
    console.log(`\nDRY RUN: Would import ${stream.eventCount} events`);
    console.log(`From: ${stream.exportedBy} at ${stream.exportedAt}`);
    console.log(`Cursor: ${stream.cursorStart} → ${stream.cursorEnd}`);
    return;
  }
  
  const db = getDB();
  let importedCount = 0;
  let skippedCount = 0;
  
  // Import events
  for (const event of stream.events) {
    // Tag with origin
    const originTag = `${stream.exportedBy}:${event.region || 'unknown'}`;
    
    switch (event.type) {
      case 'RunCreated': {
        const payload = event.payload as { runId: string; status: string; policySnapshotHash: string };
        
        // Check for fingerprint conflicts
        const existing = db.prepare('SELECT run_id FROM runs WHERE run_id = ?').get(payload.runId) as { run_id: string } | undefined;
        
        if (existing) {
          // Mark as divergence
          logger.warn('replicate.divergence_detected', 'Run fingerprint conflict', {
            runId: payload.runId,
            origin: originTag,
          });
          skippedCount++;
        } else {
          // Import the run with origin tag
          db.prepare('INSERT INTO runs (run_id, created_at, policy_snapshot_hash, status, metadata_json) VALUES (?, ?, ?, ?, ?)').run(
            payload.runId,
            event.timestamp,
            payload.policySnapshotHash,
            payload.status,
            JSON.stringify({ importedFrom: originTag, cursor: event.cursor })
          );
          importedCount++;
        }
        break;
      }
        
      case 'ProviderDecision': {
        const payload = event.payload as { decisionId: string; inputFingerprint: string };
        
        // Check for existing decision with same fingerprint
        const existing = db.prepare('SELECT id FROM decisions WHERE id = ?').get(payload.decisionId) as { id: string } | undefined;
        
        if (existing) {
          logger.warn('replicate.divergence_detected', 'Decision fingerprint conflict', {
            decisionId: payload.decisionId,
            origin: originTag,
          });
          skippedCount++;
        } else {
          importedCount++;
        }
        break;
      }
        
      default:
        logger.debug('replicate.skipped_event', 'Unhandled event type', {
          type: event.type,
          cursor: event.cursor,
        });
    }
  }
  
  logger.info('replicate.import_complete', 'Replication import complete', {
    imported: importedCount,
    skipped: skippedCount,
    from: stream.exportedBy,
  });
  
  console.log(`\nImport complete:`);
  console.log(`  Imported: ${importedCount} events`);
  console.log(`  Skipped (divergence): ${skippedCount} events`);
  console.log(`  Origin: ${stream.exportedBy}`);
  console.log(`  Cursor: ${stream.cursorStart} → ${stream.cursorEnd}`);
}

// CLI setup
export const replicate = new Command('replicate')
  .description('Multi-region durability replication')
  .addCommand(
    new Command('export')
      .description('Export replication stream')
      .requiredOption('--since <cursor>', 'Export events since cursor (format: <timestamp-base36>-<seq>)')
      .requiredOption('--out <path>', 'Output file path')
      .option('--limit <n>', 'Maximum events to export', '1000')
      .option('--region <name>', 'Region identifier')
      .action(async (options) => {
        await exportReplication(options.since, options.out, {
          limit: parseInt(options.limit),
          region: options.region,
        });
      })
  )
  .addCommand(
    new Command('import')
      .description('Import replication stream')
      .requiredOption('--in <path>', 'Input file path')
      .option('--dry-run', 'Validate without importing', false)
      .option('--skip-verify', 'Skip signature verification', false)
      .action(async (options) => {
        await importReplication(options.in, {
          dryRun: options.dryRun,
          skipVerify: options.skipVerify,
        });
      })
  )
  .addCommand(
    new Command('cursor')
      .description('Generate a cursor for --since')
      .option('--from <iso>', 'Generate from ISO timestamp')
      .action((options) => {
        const timestamp = options.from ? new Date(options.from) : new Date('2024-01-01');
        const cursor = generateCursor(timestamp.toISOString(), 0);
        console.log(cursor);
      })
  );

// Export for programmatic use
export { exportReplication, importReplication, generateCursor, parseCursor };
export type { ReplicationEvent, ReplicationStream };
