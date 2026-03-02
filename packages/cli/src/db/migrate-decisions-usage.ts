#!/usr/bin/env tsx
/**
 * Migration: Backfill decisions.usage
 *
 * Adds the 'usage' column to the decisions table if missing,
 * and populates existing records with a zero-drift default.
 */

import { getDB } from './connection.js';

async function main() {
  console.log('🔄 Starting migration: decisions.usage backfill');

  const db = getDB();

  // 1. Fetch all decisions
  const decisions = db.prepare('SELECT * FROM decisions').all() as Array<Record<string, unknown>>;
  console.log(`Found ${decisions.length} decisions to check.`);

  let updated = 0;
  const defaultUsage = JSON.stringify({ prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 });

  for (const decision of decisions) {
    if (!decision.usage) {
      // Update record with default usage
      db.prepare('UPDATE decisions SET usage = ? WHERE id = ?').run(defaultUsage, decision.id);
      updated++;
    }
  }

  console.log(`✅ Migration complete. Updated ${updated} records.`);
}

void main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

