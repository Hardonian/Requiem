#!/usr/bin/env node
/**
 * @fileoverview CAS command — Content-Addressable Storage operations
 *
 * Commands:
 *   reach cas put <file>                   Store a file in CAS
 *   reach cas get <digest>                 Retrieve file by digest
 *   reach cas ls [prefix]                  List CAS objects
 *   reach cas verify [--fix]               Verify CAS integrity
 *   reach cas gc [--dry-run] [--age=N]    Safe garbage collection
 *
 * INVARIANT: All commands support --json for machine use.
 * INVARIANT: No secrets exposed - only digests/fingerprints.
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════════════
// CAS STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const CAS_DIR = join(process.cwd(), '.reach', 'cas');
const CAS_INDEX_FILE = join(CAS_DIR, 'index.json');

interface CasIndex {
  objects: Record<string, { size: number; addedAt: string; refs: number }>;
  metadata: { version: string; createdAt: string };
}

function ensureCasDir(): void {
  if (!existsSync(CAS_DIR)) {
    mkdirSync(CAS_DIR, { recursive: true });
  }
}

function loadIndex(): CasIndex {
  ensureCasDir();
  if (!existsSync(CAS_INDEX_FILE)) {
    const emptyIndex: CasIndex = {
      objects: {},
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    writeFileSync(CAS_INDEX_FILE, JSON.stringify(emptyIndex, null, 2));
    return emptyIndex;
  }
  try {
    return JSON.parse(readFileSync(CAS_INDEX_FILE, 'utf-8'));
  } catch {
    const emptyIndex: CasIndex = {
      objects: {},
      metadata: { version: '1.0.0', createdAt: new Date().toISOString() },
    };
    return emptyIndex;
  }
}

function saveIndex(index: CasIndex): void {
  ensureCasDir();
  writeFileSync(CAS_INDEX_FILE, JSON.stringify(index, null, 2));
}

function computeDigest(content: string | Buffer): string {
  const hash = createHash('blake3');
  hash.update(content);
  return hash.digest('hex');
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

function formatObjectList(objects: Array<{ digest: string; size: number; refs: number; addedAt: string }>, ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput({ ok: true, objects, count: objects.length }, ctx);
    return;
  }

  if (objects.length === 0) {
    console.log('No objects in CAS.');
    return;
  }

  console.log('┌─────────────────────────────────────────────────────────────────────────┐');
  console.log('│ CAS Objects                                                                  │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');
  console.log('│ Digest                           Size      Refs  Added At                 │');
  console.log('├─────────────────────────────────────────────────────────────────────────┤');

  for (const obj of objects) {
    const sizeStr = String(obj.size).padStart(9);
    const refsStr = String(obj.refs).padStart(5);
    const addedStr = obj.addedAt.substring(0, 19);
    console.log(`│ ${obj.digest.substring(0, 32).padEnd(32)} ${sizeStr}  ${refsStr}  ${addedStr} │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────────┘');
  console.log(`Total: ${objects.length} objects`);
}

function formatVerifyResult(result: { valid: boolean; checked: number; errors: string[] }, ctx: OutputContext): void {
  if (ctx.json) {
    formatOutput(result, ctx);
    return;
  }

  if (result.valid) {
    console.log(`✓ CAS integrity verified (${result.checked} objects checked)`);
  } else {
    console.log(`✗ CAS integrity FAILED`);
    console.log(`  Checked: ${result.checked} objects`);
    console.log(`  Errors: ${result.errors.length}`);
    for (const err of result.errors.slice(0, 10)) {
      console.log(`    - ${err}`);
    }
    if (result.errors.length > 10) {
      console.log(`    ... and ${result.errors.length - 10} more`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export function createCasCommand(): Command {
  const casCmd = new Command('cas')
    .description('Content-Addressable Storage — store and retrieve content by digest')
    .option('--json', 'Output in JSON format')
    .option('--minimal', 'Minimal output');

  // cas put <file>
  casCmd
    .command('put <file>')
    .description('Store a file in CAS')
    .option('--ref <name>', 'Optional reference name')
    .action(async (file: string, options: { ref?: string }) => {
      const ctx = { json: casCmd.opts().json || false, minimal: casCmd.opts().minimal || false };

      try {
        if (!existsSync(file)) {
          formatOutput({ ok: false, error: { code: 'file_not_found', message: `File not found: ${file}` } }, ctx);
          process.exit(1);
        }

        const content = readFileSync(file);
        const digest = computeDigest(content);
        const objectPath = join(CAS_DIR, digest.substring(0, 2), digest.substring(2, 4), digest);

        // Ensure directory exists
        const objDir = dirname(objectPath);
        if (!existsSync(objDir)) {
          mkdirSync(objDir, { recursive: true });
        }

        // Write object if not exists
        if (!existsSync(objectPath)) {
          writeFileSync(objectPath, content);
        }

        // Update index
        const index = loadIndex();
        if (!index.objects[digest]) {
          index.objects[digest] = {
            size: content.length,
            addedAt: new Date().toISOString(),
            refs: 0,
          };
        }
        if (options.ref) {
          index.objects[digest].refs++;
        }
        saveIndex(index);

        const result = {
          ok: true,
          digest,
          size: content.length,
          path: objectPath,
          referenced: options.ref || null,
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Stored in CAS: ${digest}`);
          console.log(`  Size: ${content.length} bytes`);
          if (options.ref) {
            console.log(`  Reference: ${options.ref}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'cas_put_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // cas get <digest>
  casCmd
    .command('get <digest>')
    .description('Retrieve file by digest')
    .option('-o, --output <file>', 'Output file path')
    .action(async (digest: string, options: { output?: string }) => {
      const ctx = { json: casCmd.opts().json || false, minimal: casCmd.opts().minimal || false };

      try {
        const objectPath = join(CAS_DIR, digest.substring(0, 2), digest.substring(2, 4), digest);

        if (!existsSync(objectPath)) {
          formatOutput({ ok: false, error: { code: 'object_not_found', message: `Object not found: ${digest}` } }, ctx);
          process.exit(1);
        }

        const content = readFileSync(objectPath);

        if (options.output) {
          writeFileSync(options.output, content);
          if (!ctx.json) {
            console.log(`✓ Written to: ${options.output}`);
          }
        } else {
          process.stdout.write(content);
        }

        if (ctx.json) {
          formatOutput({ ok: true, digest, size: content.length, content: content.toString('base64') }, ctx);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'cas_get_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // cas ls [prefix]
  casCmd
    .command('ls [prefix]')
    .description('List CAS objects')
    .option('--limit <n>', 'Limit results', '100')
    .option('--offset <n>', 'Offset results', '0')
    .action(async (prefix: string = '', options: { limit?: string; offset?: string }) => {
      const ctx = { json: casCmd.opts().json || false, minimal: casCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const limit = parseInt(options.limit || '100', 10);
        const offset = parseInt(options.offset || '0', 10);

        let objects = Object.entries(index.objects).map(([digest, meta]) => ({
          digest,
          size: meta.size,
          refs: meta.refs,
          addedAt: meta.addedAt,
        }));

        if (prefix) {
          objects = objects.filter(obj => obj.digest.startsWith(prefix));
        }

        objects.sort((a, b) => b.addedAt.localeCompare(a.addedAt));

        const total = objects.length;
        objects = objects.slice(offset, offset + limit);

        if (ctx.json) {
          formatOutput({ ok: true, objects, total, limit, offset }, ctx);
        } else {
          formatObjectList(objects, ctx);
          if (total > limit) {
            console.log(`Showing ${offset + 1}-${offset + objects.length} of ${total}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'cas_ls_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // cas verify [--fix]
  casCmd
    .command('verify')
    .description('Verify CAS integrity')
    .option('--fix', 'Attempt to fix issues')
    .action(async (options: { fix?: boolean }) => {
      const ctx = { json: casCmd.opts().json || false, minimal: casCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const errors: string[] = [];
        let checked = 0;

        for (const [digest, meta] of Object.entries(index.objects)) {
          checked++;
          const objectPath = join(CAS_DIR, digest.substring(0, 2), digest.substring(2, 4), digest);

          if (!existsSync(objectPath)) {
            errors.push(`Missing object: ${digest}`);
            if (options.fix) {
              delete index.objects[digest];
            }
          } else {
            const content = readFileSync(objectPath);
            const actualDigest = computeDigest(content);
            if (actualDigest !== digest) {
              errors.push(`Digest mismatch: ${digest} (expected) vs ${actualDigest} (actual)`);
            }
            if (content.length !== meta.size) {
              errors.push(`Size mismatch for ${digest}: ${meta.size} (index) vs ${content.length} (actual)`);
            }
          }
        }

        if (options.fix && errors.length > 0) {
          saveIndex(index);
        }

        const result = {
          valid: errors.length === 0,
          checked,
          errors,
          fixed: options.fix && errors.length > 0,
        };

        formatVerifyResult(result, ctx);
        process.exit(result.valid ? 0 : 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'cas_verify_failed', message } }, ctx);
        process.exit(1);
      }
    });

  // cas gc [--dry-run] [--age=N]
  casCmd
    .command('gc')
    .description('Safe garbage collection - remove unreferenced objects')
    .option('--dry-run', 'Show what would be deleted without deleting')
    .option('--age <days>', 'Only collect objects older than N days', '30')
    .action(async (options: { dryRun?: boolean; age?: string }) => {
      const ctx = { json: casCmd.opts().json || false, minimal: casCmd.opts().minimal || false };

      try {
        const index = loadIndex();
        const ageDays = parseInt(options.age || '30', 10);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - ageDays);

        const toDelete: string[] = [];
        const now = new Date();

        for (const [digest, meta] of Object.entries(index.objects)) {
          if (meta.refs === 0) {
            const addedDate = new Date(meta.addedAt);
            if (addedDate < cutoffDate) {
              toDelete.push(digest);
            }
          }
        }

        if (options.dryRun) {
          if (ctx.json) {
            formatOutput({ ok: true, dryRun: true, wouldDelete: toDelete, count: toDelete.length }, ctx);
          } else {
            console.log(`DRY RUN: Would delete ${toDelete.length} objects`);
            for (const digest of toDelete.slice(0, 10)) {
              console.log(`  - ${digest}`);
            }
            if (toDelete.length > 10) {
              console.log(`  ... and ${toDelete.length - 10} more`);
            }
          }
          return;
        }

        let deleted = 0;
        for (const digest of toDelete) {
          const objectPath = join(CAS_DIR, digest.substring(0, 2), digest.substring(2, 4), digest);
          if (existsSync(objectPath)) {
            unlinkSync(objectPath);
            deleted++;
          }
          delete index.objects[digest];
        }

        saveIndex(index);

        const result = {
          ok: true,
          collected: deleted,
          totalScanned: Object.keys(index.objects).length,
        };

        if (ctx.json) {
          formatOutput(result, ctx);
        } else {
          console.log(`✓ Garbage collection complete`);
          console.log(`  Deleted: ${deleted} objects`);
          console.log(`  Remaining: ${Object.keys(index.objects).length} objects`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatOutput({ ok: false, error: { code: 'cas_gc_failed', message } }, ctx);
        process.exit(1);
      }
    });

  return casCmd;
}

// Default export for dynamic imports
export default createCasCommand;
