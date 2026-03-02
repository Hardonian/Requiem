/**
 * Benchmark Suite
 *
 * Sub-millisecond latency baseline for engine operations.
 */

import { logger } from '../core/index.js';
import type { CommandContext } from '../cli.js';
import { getStorage } from '../db/sqlite-storage.js';
import { performance } from 'perf_hooks';

export async function runBench(ctx: CommandContext): Promise<number> {
  console.log('\n⚡ REQUIEM PERFORMANCE BASELINE\n');

  const results: Record<string, number> = {};

  // 1. Raw DB Latency (Prepared)
  try {
    const storage = getStorage();
    storage.initialize();

    const start = performance.now();
    const iterations = 1000;
    for (let i = 0; i < iterations; i++) {
      storage.getSchemaVersion();
    }
    const duration = performance.now() - start;
    results.db_read_ms = duration / iterations;
    console.log(`✓ DB Prepared Read:    ${results.db_read_ms.toFixed(4)}ms`);
  } catch (e) {
    console.log(`✗ DB Prepared Read:    Failed`);
  }

  // 2. Hash Latency (BLAKE3)
  try {
    const { hash } = await import('../lib/hash.js');
    const start = performance.now();
    const iterations = 1000;
    const data = 'bench'.repeat(100);
    for (let i = 0; i < iterations; i++) {
      hash(data);
    }
    const duration = performance.now() - start;
    results.hash_blake3_ms = duration / iterations;
    console.log(`✓ Hash BLAKE3:         ${results.hash_blake3_ms.toFixed(4)}ms`);
  } catch (e) {
    console.log(`✗ Hash BLAKE3:         Failed`);
  }

  if (ctx.json) {
    console.log(JSON.stringify(results, null, 2));
  }

  return 0;
}
