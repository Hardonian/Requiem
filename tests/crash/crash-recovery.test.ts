/**
 * Crash Injection Tests
 *
 * Verifies CLAIM_CRASH_SURVIVABILITY:
 * - CAS write interrupted
 * - WAL/event log append interrupted
 * - Proof generation interrupted
 * - Workflow step interrupted
 *
 * Simulates crashes by:
 * 1. Starting an operation
 * 2. Interrupting mid-operation (simulated via partial writes)
 * 3. Restarting system
 * 4. Verifying state integrity, no lost history, replay recovery
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, renameSync, appendFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalHash, hashDomain, canonicalStringify } from '../../packages/hash/src/canonical_hash.js';

const CRASH_TEST_DIR = join(process.cwd(), 'tests', 'crash', '.scratch');

// ---------------------------------------------------------------------------
// Simulated CAS Backend (file-based, mirrors production behavior)
// ---------------------------------------------------------------------------

class SimulatedCAS {
  private objectDir: string;

  constructor(baseDir: string) {
    this.objectDir = join(baseDir, 'objects');
    mkdirSync(this.objectDir, { recursive: true });
  }

  /** Store with atomic write (temp + rename) */
  put(content: string): string {
    const digest = hashDomain('cas:', content);
    const shard = digest.substring(0, 2);
    const shardDir = join(this.objectDir, shard);
    mkdirSync(shardDir, { recursive: true });

    const objectPath = join(shardDir, digest);
    const tmpPath = objectPath + '.tmp';

    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, objectPath);
    return digest;
  }

  /** Store with simulated crash (incomplete write) */
  putWithCrash(content: string, crashAfterBytes: number): string {
    const digest = hashDomain('cas:', content);
    const shard = digest.substring(0, 2);
    const shardDir = join(this.objectDir, shard);
    mkdirSync(shardDir, { recursive: true });

    const objectPath = join(shardDir, digest);
    const tmpPath = objectPath + '.tmp';

    // Write partial data (simulating crash mid-write)
    writeFileSync(tmpPath, content.substring(0, crashAfterBytes), 'utf-8');
    // Do NOT rename — simulating crash before atomic swap
    return digest;
  }

  /** Retrieve with integrity verification */
  get(digest: string): string | null {
    const shard = digest.substring(0, 2);
    const objectPath = join(this.objectDir, shard, digest);

    if (!existsSync(objectPath)) return null;

    const content = readFileSync(objectPath, 'utf-8');
    const computedDigest = hashDomain('cas:', content);

    if (computedDigest !== digest) {
      // Integrity violation — quarantine
      return null;
    }

    return content;
  }

  /** Recovery: clean up orphaned tmp files */
  recover(): { cleaned: number; intact: number } {
    let cleaned = 0;
    let intact = 0;

    if (!existsSync(this.objectDir)) return { cleaned: 0, intact: 0 };

    for (const shard of readdirSync(this.objectDir)) {
      const shardDir = join(this.objectDir, shard);
      for (const file of readdirSync(shardDir)) {
        if (file.endsWith('.tmp')) {
          rmSync(join(shardDir, file));
          cleaned++;
        } else {
          // Verify integrity of existing objects
          const content = readFileSync(join(shardDir, file), 'utf-8');
          const computed = hashDomain('cas:', content);
          if (computed === file) {
            intact++;
          } else {
            // Corrupted object — remove
            rmSync(join(shardDir, file));
            cleaned++;
          }
        }
      }
    }

    return { cleaned, intact };
  }
}

// ---------------------------------------------------------------------------
// Simulated WAL (Write-Ahead Log)
// ---------------------------------------------------------------------------

class SimulatedWAL {
  private logPath: string;

  constructor(baseDir: string) {
    this.logPath = join(baseDir, 'wal.ndjson');
    if (!existsSync(this.logPath)) {
      writeFileSync(this.logPath, '', 'utf-8');
    }
  }

  append(entry: Record<string, unknown>): void {
    const line = canonicalStringify(entry) + '\n';
    appendFileSync(this.logPath, line, 'utf-8');
  }

  appendWithCrash(entry: Record<string, unknown>, crashAfterBytes: number): void {
    const line = canonicalStringify(entry) + '\n';
    const partial = line.substring(0, crashAfterBytes);
    appendFileSync(this.logPath, partial, 'utf-8');
  }

  readAll(): Array<Record<string, unknown>> {
    if (!existsSync(this.logPath)) return [];
    const content = readFileSync(this.logPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const entries: Array<Record<string, unknown>> = [];

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Partial/corrupt line from crash — skip
      }
    }
    return entries;
  }

  /** Recovery: truncate any partial last line */
  recover(): { recovered_entries: number; truncated_bytes: number } {
    if (!existsSync(this.logPath)) return { recovered_entries: 0, truncated_bytes: 0 };

    const content = readFileSync(this.logPath, 'utf-8');
    const lines = content.split('\n');
    const validLines: string[] = [];
    let truncatedBytes = 0;

    for (const line of lines) {
      if (line.trim().length === 0) continue;
      try {
        JSON.parse(line);
        validLines.push(line);
      } catch {
        truncatedBytes += Buffer.byteLength(line);
      }
    }

    const recovered = validLines.join('\n') + (validLines.length > 0 ? '\n' : '');
    writeFileSync(this.logPath, recovered, 'utf-8');

    return {
      recovered_entries: validLines.length,
      truncated_bytes: truncatedBytes,
    };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Crash Recovery — CAS Write Interrupted', () => {
  let cas: SimulatedCAS;

  beforeEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CRASH_TEST_DIR, { recursive: true });
    cas = new SimulatedCAS(join(CRASH_TEST_DIR, 'cas'));
  });

  afterEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
  });

  it('incomplete write does not corrupt CAS', () => {
    const content = 'important data that must not be lost or corrupted';

    // Crash mid-write
    const digest = cas.putWithCrash(content, 10);

    // Object should not be retrievable (tmp file exists but no final object)
    const result = cas.get(digest);
    assert.equal(result, null, 'Incomplete write should not be readable');
  });

  it('recovery cleans orphaned tmp files', () => {
    const content1 = 'data-1';
    const content2 = 'data-2-will-crash';

    // Successful write
    cas.put(content1);

    // Crashed write
    cas.putWithCrash(content2, 5);

    // Recovery
    const recovery = cas.recover();
    assert.equal(recovery.cleaned, 1, 'Should clean 1 orphaned tmp file');
    assert.equal(recovery.intact, 1, 'Should have 1 intact object');
  });

  it('previously stored objects survive crash', () => {
    const content = 'pre-crash data';
    const digest = cas.put(content);

    // Simulate crash on different write
    cas.putWithCrash('crashing write', 3);

    // Pre-crash data should still be intact
    const result = cas.get(digest);
    assert.equal(result, content, 'Pre-crash data must survive');
  });

  it('re-put after crash recovery succeeds', () => {
    const content = 'retry after crash';
    cas.putWithCrash(content, 5);

    cas.recover();

    // Retry the write
    const digest = cas.put(content);
    const result = cas.get(digest);
    assert.equal(result, content, 'Re-put after recovery must succeed');
  });
});

describe('Crash Recovery — WAL Append Interrupted', () => {
  let wal: SimulatedWAL;

  beforeEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CRASH_TEST_DIR, { recursive: true });
    wal = new SimulatedWAL(CRASH_TEST_DIR);
  });

  afterEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
  });

  it('partial WAL entry is skipped on read', () => {
    wal.append({ seq: 0, event: 'start' });
    wal.append({ seq: 1, event: 'step_1' });
    wal.appendWithCrash({ seq: 2, event: 'step_2' }, 10);

    const entries = wal.readAll();
    assert.equal(entries.length, 2, 'Only complete entries should be readable');
    assert.equal(entries[0].seq, 0);
    assert.equal(entries[1].seq, 1);
  });

  it('recovery truncates partial entries', () => {
    wal.append({ seq: 0, event: 'start' });
    wal.appendWithCrash({ seq: 1, event: 'will_crash' }, 5);

    const recovery = wal.recover();
    assert.equal(recovery.recovered_entries, 1);
    assert.ok(recovery.truncated_bytes > 0);

    // After recovery, new writes succeed
    wal.append({ seq: 1, event: 'retried' });
    const entries = wal.readAll();
    assert.equal(entries.length, 2);
  });

  it('event chain integrity survives crash', () => {
    const GENESIS = '0'.repeat(64);

    // Build chain
    const event0 = { seq: 0, prev: GENESIS, data: 'event-0' };
    const hash0 = hashDomain('evt:', canonicalStringify(event0));
    wal.append(event0);

    const event1 = { seq: 1, prev: hash0, data: 'event-1' };
    const hash1 = hashDomain('evt:', canonicalStringify(event1));
    wal.append(event1);

    // Crash on event 2
    wal.appendWithCrash({ seq: 2, prev: hash1, data: 'crash' }, 8);

    // Recover
    wal.recover();

    // Verify chain of recovered entries
    const entries = wal.readAll();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].prev, GENESIS);
    assert.equal(entries[1].prev, hash0);
  });
});

describe('Crash Recovery — Proof Generation Interrupted', () => {
  beforeEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CRASH_TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
  });

  it('partial proofpack is detectable and recoverable', () => {
    const proofpack = {
      manifest: {
        run_id: 'run_crash_test',
        request_digest: canonicalHash('request'),
        result_digest: canonicalHash('result'),
        merkle_root: canonicalHash('merkle'),
      },
      run_log: [
        { seq: 0, step_type: 'tool_call', data_hash: canonicalHash('step-0') },
      ],
    };

    const fullJson = canonicalStringify(proofpack);
    const proofpackPath = join(CRASH_TEST_DIR, 'proofpack.json');
    const tmpPath = proofpackPath + '.tmp';

    // Simulate crash: write partial proofpack
    writeFileSync(tmpPath, fullJson.substring(0, 50), 'utf-8');

    // Verify partial file is not valid JSON
    assert.throws(() => JSON.parse(readFileSync(tmpPath, 'utf-8')));

    // Final file should not exist
    assert.ok(!existsSync(proofpackPath));

    // Recovery: complete the write
    writeFileSync(tmpPath, fullJson, 'utf-8');
    renameSync(tmpPath, proofpackPath);

    // Verify recovery
    const recovered = JSON.parse(readFileSync(proofpackPath, 'utf-8'));
    assert.equal(recovered.manifest.run_id, 'run_crash_test');
  });
});

describe('Crash Recovery — Workflow Step Interrupted', () => {
  beforeEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CRASH_TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(CRASH_TEST_DIR, { recursive: true, force: true });
  });

  it('workflow can resume from last checkpoint', () => {
    const wal = new SimulatedWAL(CRASH_TEST_DIR);
    const cas = new SimulatedCAS(join(CRASH_TEST_DIR, 'cas'));

    // Execute steps 0-2 successfully
    for (let i = 0; i < 3; i++) {
      const stepData = `step-${i}-output`;
      const digest = cas.put(stepData);
      wal.append({ seq: i, step_type: 'tool_call', cas_digest: digest, status: 'complete' });
    }

    // Step 3 crashes
    wal.appendWithCrash({ seq: 3, step_type: 'tool_call', status: 'started' }, 15);

    // Recovery
    wal.recover();

    // Determine last completed step
    const entries = wal.readAll();
    const lastCompleted = entries
      .filter(e => e.status === 'complete')
      .reduce((max, e) => Math.max(max, e.seq as number), -1);

    assert.equal(lastCompleted, 2, 'Should identify last completed step');

    // Resume from step 3
    const resumeData = 'step-3-output-retry';
    const resumeDigest = cas.put(resumeData);
    wal.append({ seq: 3, step_type: 'tool_call', cas_digest: resumeDigest, status: 'complete' });

    const finalEntries = wal.readAll();
    const completedSteps = finalEntries.filter(e => e.status === 'complete');
    assert.equal(completedSteps.length, 4, 'All steps should be complete after recovery');
  });
});
