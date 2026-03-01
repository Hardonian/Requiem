#!/usr/bin/env tsx
/**
 * Migration: Backfill decisions.execution_latency
 *
 * Adds the 'execution_latency' column to the decisions table if missing,
 * and populates existing records with a default value (0).
 */

import { getDB } from './connection';

async function main() {
  console.log('🔄 Starting migration: decisions.execution_latency backfill');

  const db = getDB();

  // 1. Fetch all decisions
  const decisions = db.prepare('SELECT * FROM decisions').all() as Array<Record<string, unknown>>;
  console.log(`Found ${decisions.length} decisions to check.`);

  let updated = 0;

  for (const decision of decisions) {
    if (decision.execution_latency === undefined || decision.execution_latency === null) {
      // Update record with default latency
      db.prepare('UPDATE decisions SET execution_latency = ? WHERE id = ?').run(0, decision.id);
      updated++;
    }
  }

  console.log(`✅ Migration complete. Updated ${updated} records.`);
}

void main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
