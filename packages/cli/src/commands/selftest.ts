/**
 * Selftest Command
 *
 * `reach selftest`
 *
 * Runs:
 * - Invariant checks (state machine, assertions, types)
 * - DB consistency checks
 * - CAS consistency checks
 * - Signature verification (placeholder)
 * - Replay deterministic sample
 * - Arbitration deterministic sample
 *
 * Returns structured JSON and human-readable output.
 */

import { Command } from 'commander';
import { getDB, getDatabaseStatus } from '../db/connection.js';
import { hash } from '../lib/hash.js';
import { createRunLifecycleStateMachine, RunLifecycleStates, RunLifecycleTracker } from '../lib/run-lifecycle.js';
import { createExecutionStateMachine, createJunctionStateMachine } from '../lib/state-machine.js';
import { evaluateDecisionFallback } from '../lib/fallback.js';
import { capturePolicySnapshotHash } from '../lib/policy-snapshot.js';
import { ErrorCode } from '../lib/errors.js';

interface SelftestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  durationMs: number;
}

interface SelftestReport {
  timestamp: string;
  version: string;
  results: SelftestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  status: 'GREEN' | 'RED';
}

function runCheck(name: string, fn: () => void): SelftestResult {
  const start = Date.now();
  try {
    fn();
    return {
      name,
      status: 'pass',
      message: 'OK',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      status: 'fail',
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

async function runCheckAsync(name: string, fn: () => Promise<void>): Promise<SelftestResult> {
  const start = Date.now();
  try {
    await fn();
    return {
      name,
      status: 'pass',
      message: 'OK',
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name,
      status: 'fail',
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

export const selftest = new Command('selftest')
  .description('Run comprehensive self-diagnostic checks')
  .option('--json', 'Output in JSON format')
  .action(async (options: { json?: boolean }) => {
    const results: SelftestResult[] = [];

    // ─── 1. State Machine Invariants ─────────────────────────────────────
    results.push(runCheck('state-machine:execution', () => {
      const sm = createExecutionStateMachine();
      if (!sm.canTransition('pending', 'queued')) {
        throw new Error('Execution SM: pending → queued should be valid');
      }
      if (sm.canTransition('succeeded', 'running')) {
        throw new Error('Execution SM: succeeded → running should be invalid');
      }
    }));

    results.push(runCheck('state-machine:junction', () => {
      const sm = createJunctionStateMachine();
      if (!sm.canTransition('detected', 'validating')) {
        throw new Error('Junction SM: detected → validating should be valid');
      }
      if (sm.canTransition('resolved', 'detected')) {
        throw new Error('Junction SM: resolved → detected should be invalid');
      }
    }));

    results.push(runCheck('state-machine:run-lifecycle', () => {
      const sm = createRunLifecycleStateMachine();
      if (!sm.canTransition(RunLifecycleStates.INIT, RunLifecycleStates.POLICY_CHECKED)) {
        throw new Error('Run lifecycle: INIT → POLICY_CHECKED should be valid');
      }
      if (sm.canTransition(RunLifecycleStates.COMPLETE, RunLifecycleStates.INIT)) {
        throw new Error('Run lifecycle: COMPLETE → INIT should be invalid');
      }
    }));

    results.push(runCheck('state-machine:run-lifecycle-tracker', () => {
      const tracker = new RunLifecycleTracker('selftest-run');
      tracker.advance(RunLifecycleStates.POLICY_CHECKED);
      tracker.advance(RunLifecycleStates.ARBITRATED);

      // Attempt illegal skip
      let caught = false;
      try {
        tracker.advance(RunLifecycleStates.SIGNED);
      } catch {
        caught = true;
      }
      if (!caught) {
        throw new Error('Run lifecycle should reject skip from ARBITRATED to SIGNED');
      }
    }));

    // ─── 2. DB Consistency ───────────────────────────────────────────────
    results.push(await runCheckAsync('db:connectivity', async () => {
      const status = await getDatabaseStatus();
      if (!status.connected) {
        throw new Error(`DB not connected: ${status.error}`);
      }
    }));

    results.push(runCheck('db:table-existence', () => {
      const db = getDB();
      // Verify critical tables exist by attempting a query
      const tables = ['decisions', 'junctions', 'ledger', 'economic_events', 'artifacts'];
      for (const table of tables) {
        try {
          db.prepare(`SELECT 1 FROM ${table} LIMIT 0`).all();
        } catch {
          throw new Error(`Required table "${table}" not accessible`);
        }
      }
    }));

    // ─── 3. CAS Consistency ──────────────────────────────────────────────
    results.push(runCheck('cas:hash-determinism', () => {
      const input = 'hello, deterministic world';
      const hash1 = hash(input);
      const hash2 = hash(input);
      if (hash1 !== hash2) {
        throw new Error(`Hash non-deterministic: ${hash1} !== ${hash2}`);
      }
      if (!/^[a-f0-9]{64}$/.test(hash1)) {
        throw new Error(`Hash format invalid: ${hash1}`);
      }
    }));

    results.push(runCheck('cas:empty-string-hash', () => {
      const emptyHash = hash('');
      if (!/^[a-f0-9]{64}$/.test(emptyHash)) {
        throw new Error(`Empty string hash format invalid: ${emptyHash}`);
      }
    }));

    // ─── 4. Signature Verification (structural check) ────────────────────
    results.push(runCheck('signing:error-codes-exist', () => {
      // Verify the error code enum has the critical invariant codes
      const required = [
        ErrorCode.INVARIANT_VIOLATION,
        ErrorCode.DETERMINISM_VIOLATION,
        ErrorCode.CAS_INTEGRITY_FAILED,
        ErrorCode.HASH_MISMATCH,
        ErrorCode.REPLAY_MISMATCH,
      ];
      for (const code of required) {
        if (!code) {
          throw new Error('Missing required error code');
        }
      }
    }));

    // ─── 5. Replay Deterministic Sample ──────────────────────────────────
    results.push(runCheck('replay:determinism-10x', () => {
      const input = {
        actions: ['accept', 'reject', 'defer'],
        states: ['critical', 'high', 'medium'],
        outcomes: {
          accept: { critical: 0.1, high: 0.8, medium: 0.9 },
          reject: { critical: 0.0, high: 0.2, medium: 0.4 },
          defer: { critical: 0.3, high: 0.5, medium: 0.7 },
        },
        algorithm: 'minimax_regret' as const,
      };

      const firstResult = evaluateDecisionFallback(input);
      const firstHash = hash(JSON.stringify({
        recommended_action: firstResult.recommended_action,
        ranking: firstResult.ranking,
        algorithm: firstResult.trace.algorithm,
        scores: firstResult.trace.scores,
      }));

      for (let i = 0; i < 10; i++) {
        const result = evaluateDecisionFallback({ ...input });
        const resultHash = hash(JSON.stringify({
          recommended_action: result.recommended_action,
          ranking: result.ranking,
          algorithm: result.trace.algorithm,
          scores: result.trace.scores,
        }));

        if (resultHash !== firstHash) {
          throw new Error(`Determinism violation on iteration ${i + 1}: ${resultHash} !== ${firstHash}`);
        }
      }
    }));

    // ─── 6. Arbitration Deterministic Sample ─────────────────────────────
    results.push(runCheck('arbitration:algorithm-idempotency', () => {
      const algorithms = ['minimax_regret', 'maximin', 'softmax', 'hurwicz', 'laplace', 'topsis'] as const;

      for (const algo of algorithms) {
        const input = {
          actions: ['a', 'b', 'c'],
          states: ['s1', 's2'],
          outcomes: {
            a: { s1: 1.0, s2: 0.5 },
            b: { s1: 0.5, s2: 1.0 },
            c: { s1: 0.7, s2: 0.7 },
          },
          algorithm: algo,
        };

        const r1 = evaluateDecisionFallback(input);
        const r2 = evaluateDecisionFallback({ ...input });

        if (r1.recommended_action !== r2.recommended_action) {
          throw new Error(
            `Algorithm ${algo} non-deterministic: ${r1.recommended_action} !== ${r2.recommended_action}`,
          );
        }
      }
    }));

    // ─── 7. Policy Snapshot ──────────────────────────────────────────────
    results.push(runCheck('policy:snapshot-determinism', () => {
      const hash1 = capturePolicySnapshotHash();
      const hash2 = capturePolicySnapshotHash();
      if (hash1 !== hash2) {
        throw new Error(`Policy snapshot non-deterministic: ${hash1} !== ${hash2}`);
      }
    }));

    // ─── Report ──────────────────────────────────────────────────────────
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    const report: SelftestReport = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        skipped,
      },
      status: failed === 0 ? 'GREEN' : 'RED',
    };

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('');
      console.log('┌────────────────────────────────────────────────────────────┐');
      console.log('│ REQUIEM SELFTEST                                           │');
      console.log('├────────────────────────────────────────────────────────────┤');

      for (const r of results) {
        const icon = r.status === 'pass' ? '■' : r.status === 'fail' ? '✗' : '○';
        const line = `│  ${icon} ${r.name.padEnd(40)} ${r.status.toUpperCase().padEnd(6)} ${r.durationMs}ms`;
        console.log(line.padEnd(61) + '│');
        if (r.status === 'fail') {
          const msgLine = `│    ${r.message.substring(0, 54)}`;
          console.log(msgLine.padEnd(61) + '│');
        }
      }

      console.log('├────────────────────────────────────────────────────────────┤');
      console.log(`│  Total: ${report.summary.total}  Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}`.padEnd(61) + '│');
      console.log(`│  Status: ${report.status}`.padEnd(61) + '│');
      console.log('└────────────────────────────────────────────────────────────┘');
    }

    if (failed > 0) {
      process.exit(1);
    }
  });

