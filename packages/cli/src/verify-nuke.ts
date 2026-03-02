#!/usr/bin/env tsx
import { nuke } from './commands/nuke.js';
import { DecisionRepository } from './db/decisions.js';
import { getDB } from './db/connection.js';

async function main() {
  console.log('💥 Verifying Nuke command...');

  // 1. Seed Data
  DecisionRepository.create({
    tenant_id: 'nuke-test',
    source_type: 'test',
    source_ref: 'ref',
    input_fingerprint: 'fp',
    decision_input: {},
    status: 'evaluated'
  });

  const db = getDB();
  const countBefore = (db.prepare('SELECT count(*) as c FROM decisions').get() as any).c;
  console.log(`  Records before nuke: ${countBefore}`);

  if (countBefore === 0) throw new Error('Failed to seed database');

  // 2. Run Nuke
  // We invoke the action handler via parseAsync to simulate CLI execution
  await nuke.parseAsync(['node', 'test', '--force']);

  // 3. Verify Empty
  const countAfter = (db.prepare('SELECT count(*) as c FROM decisions').get() as any).c;
  console.log(`  Records after nuke: ${countAfter}`);

  if (countAfter !== 0) throw new Error('Database not cleared!');

  console.log('✅ Nuke verification passed');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

