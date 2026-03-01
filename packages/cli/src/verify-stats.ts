#!/usr/bin/env tsx
import { DecisionRepository } from './db/decisions';
import { resetDB } from './db/connection';

async function main() {
  console.log('🧪 Verifying Stats and Trace commands...');
  resetDB();

  const tenantId = 'test-tenant-stats';

  // 1. Seed Data
  console.log('  Seeding decision data...');
  const id1 = DecisionRepository.create({
    tenant_id: tenantId,
    source_type: 'test',
    source_ref: 'ref1',
    input_fingerprint: 'fp1',
    decision_input: { q: 1 },
    usage: { prompt_tokens: 10, completion_tokens: 10, cost_usd: 0.001 },
    execution_latency: 100,
    status: 'evaluated',
    outcome_status: 'success'
  }).id;

  DecisionRepository.create({
    tenant_id: tenantId,
    source_type: 'test',
    source_ref: 'ref2',
    input_fingerprint: 'fp2',
    decision_input: { q: 2 },
    usage: { prompt_tokens: 20, completion_tokens: 20, cost_usd: 0.002 },
    execution_latency: 200,
    status: 'evaluated',
    outcome_status: 'failure'
  });

  // 2. Verify Stats Logic
  console.log('  Verifying stats aggregation...');
  const s = DecisionRepository.getStats(tenantId);

  if (s.total_decisions !== 2) throw new Error(`Expected 2 decisions, got ${s.total_decisions}`);
  if (s.avg_latency_ms !== 150) throw new Error(`Expected 150ms latency, got ${s.avg_latency_ms}`);
  if (Math.abs(s.total_cost_usd - 0.003) > 0.00001) throw new Error(`Expected $0.003 cost, got ${s.total_cost_usd}`);
  if (s.success_rate !== 0.5) throw new Error(`Expected 50% success, got ${s.success_rate}`);
  console.log('  ✓ Stats aggregation correct');

  // 3. Verify Latency Persistence (for Trace command)
  console.log(`  Verifying latency persistence for ID: ${id1}...`);
  const d = DecisionRepository.findById(id1);
  if (d?.execution_latency !== 100) throw new Error('Latency not persisted correctly');
  console.log('  ✓ Latency persisted correctly');

  console.log('✅ Verification Complete');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
