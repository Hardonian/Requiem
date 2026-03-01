#!/usr/bin/env tsx
/**
 * verify-preflight.ts
 *
 * Verifies:
 * 1. 'replay' command is discoverable and has required subcommands.
 * 2. atabase schema supports the 'usage' column.
 */

import { replay } from '../commands/replay';
import { trace } from '../commands/trace';
import { getDB } from './connection';
import { randomBytes } from 'crypto';
import type { Command, Option } from 'commander';

async function main() {
  console.log('\n✈️  Running Preflight Checks...\n');
  let passed = true;

  // --- Check 1: CLI Command Discovery ---
  try {
    console.log('[1] Checking "replay" command registration...');
    if (replay.name() !== 'replay') throw new Error('Command name mismatch');

    const runCmd = replay.commands.find((c: Command) => c.name() === 'run');
    if (!runCmd) throw new Error('Subcommand "run" not found');

    const verifyOption = runCmd.options.find((o: Option) => o.flags.includes('--verify'));
    if (!verifyOption) throw new Error('Option "--verify" not found on "replay run"');

    console.log('  ✓ "replay run --verify" is discoverable');
  } catch (e) {
    console.error(`  ✗ CLI Check Failed: ${(e as Error).message}`);
    passed = false;
  }


    console.log('\n[2] Checking "trace" command registration...');
    if
  } catch (e) {
    console.error(`  ✗ CLI Check Failed: ${(e as Error).message}`);
    passed = false;
  }

  // --- Check 3: Database Schema ---
  try {
    console.log('\n[3] Checking database schema for "usage" column...');
    const db = getDB();
    const testId = `preflight_${randomBytes(4).toString('hex')}`;
    const testUsage = JSON.stringify({ prompt_tokens: 10, completion_tokens: 20, cost_usd: 0.001 });

    // Attempt insert with usage column
    db.prepare(`INSERT INTO decisions (id, usage) VALUES (?, ?)`).run(testId, testUsage);

    // Verify read
    const row = db.prepare('SELECT usage FROM decisions WHERE id = ?').get(testId) as Record<string, unknown> | undefined;

    if (!row) throw new Error('Failed to retrieve inserted record');
    if (row.usage !== testUsage) throw new Error(`Usage mismatch. Expected ${testUsage}, got ${row.usage}`);

    console.log('  ✓ Database accepts and persists "usage" column');
  } catch (e) {
    console.error(`  ✗ DB Check Failed: ${(e as Error).message}`);
    passed = false;
  }

  console.log('\n' + (passed ? '✅ PREFLIGHT PASSED' : '❌ PREFLIGHT FAILED'));
  process.exit(passed ? 0 : 1);
}

void main();
