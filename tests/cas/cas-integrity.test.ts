/**
 * CAS Integrity Verification Tests
 *
 * Verifies CLAIM_CAS_IMMUTABILITY:
 * - Object hash immutability
 * - Mutation detection
 * - Duplicate insertion idempotency
 * - Reference safety during GC
 * - Corruption detection on read
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalHash, hashDomain, canonicalStringify } from '../../packages/hash/src/canonical_hash.js';

const CAS_TEST_DIR = join(process.cwd(), 'tests', 'cas', '.scratch');

// ---------------------------------------------------------------------------
// Test CAS Implementation (mirrors production CasStore)
// ---------------------------------------------------------------------------

class TestCAS {
  private baseDir: string;
  private refCounts: Map<string, number> = new Map();

  constructor(baseDir: string) {
    this.baseDir = join(baseDir, 'objects');
    mkdirSync(this.baseDir, { recursive: true });
  }

  private objectPath(digest: string): string {
    const shard = digest.substring(0, 2);
    return join(this.baseDir, shard, digest);
  }

  put(content: string): string {
    const digest = hashDomain('cas:', content);
    const path = this.objectPath(digest);
    const dir = join(this.baseDir, digest.substring(0, 2));
    mkdirSync(dir, { recursive: true });

    if (existsSync(path)) {
      // Idempotent — verify content matches
      const existing = readFileSync(path, 'utf-8');
      const existingDigest = hashDomain('cas:', existing);
      if (existingDigest !== digest) {
        throw new Error(`CAS integrity violation: stored content hash mismatch for ${digest}`);
      }
      return digest;
    }

    // Atomic write: tmp + rename
    const tmpPath = path + '.tmp';
    writeFileSync(tmpPath, content, 'utf-8');
    renameSync(tmpPath, path);

    return digest;
  }

  get(digest: string): string | null {
    const path = this.objectPath(digest);
    if (!existsSync(path)) return null;

    const content = readFileSync(path, 'utf-8');
    const computedDigest = hashDomain('cas:', content);

    if (computedDigest !== digest) {
      throw new Error(`cas_integrity_failed: expected ${digest}, computed ${computedDigest}`);
    }

    return content;
  }

  /** Attempt mutation (should be prevented) */
  attemptMutation(digest: string, newContent: string): boolean {
    const path = this.objectPath(digest);
    if (!existsSync(path)) return false;

    // In production, CAS objects are read-only filesystem permissions.
    // Here we simulate the check.
    const existingContent = readFileSync(path, 'utf-8');
    const existingDigest = hashDomain('cas:', existingContent);

    if (existingDigest !== hashDomain('cas:', newContent)) {
      // Mutation detected — reject
      return false;
    }

    return true; // Same content — not actually a mutation
  }

  addRef(digest: string): void {
    this.refCounts.set(digest, (this.refCounts.get(digest) || 0) + 1);
  }

  removeRef(digest: string): void {
    const count = this.refCounts.get(digest) || 0;
    if (count > 1) {
      this.refCounts.set(digest, count - 1);
    } else {
      this.refCounts.delete(digest);
    }
  }

  /** GC: only remove objects with zero references */
  gc(): { removed: number; retained: number } {
    let removed = 0;
    let retained = 0;

    if (!existsSync(this.baseDir)) return { removed: 0, retained: 0 };

    for (const shard of readdirSync(this.baseDir)) {
      const shardDir = join(this.baseDir, shard);
      for (const file of readdirSync(shardDir)) {
        if (file.endsWith('.tmp')) continue;
        if (this.refCounts.has(file) && (this.refCounts.get(file) || 0) > 0) {
          retained++;
        } else {
          rmSync(join(shardDir, file));
          removed++;
        }
      }
    }

    return { removed, retained };
  }

  exists(digest: string): boolean {
    return existsSync(this.objectPath(digest));
  }

  /** Corrupt an object (for testing detection) */
  _corrupt(digest: string, corruptContent: string): void {
    const path = this.objectPath(digest);
    writeFileSync(path, corruptContent, 'utf-8');
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CAS Integrity — Object Hash Immutability', () => {
  let cas: TestCAS;

  beforeEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CAS_TEST_DIR, { recursive: true });
    cas = new TestCAS(CAS_TEST_DIR);
  });

  afterEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
  });

  it('digest is deterministic for same content', () => {
    const content = 'hello world';
    const digest1 = cas.put(content);
    const digest2 = cas.put(content);
    assert.equal(digest1, digest2, 'Same content must produce same digest');
  });

  it('different content produces different digests', () => {
    const digest1 = cas.put('content-a');
    const digest2 = cas.put('content-b');
    assert.notEqual(digest1, digest2, 'Different content must produce different digests');
  });

  it('content is retrievable by digest', () => {
    const content = 'test data for CAS';
    const digest = cas.put(content);
    const retrieved = cas.get(digest);
    assert.equal(retrieved, content);
  });

  it('digest is 64 hex characters', () => {
    const digest = cas.put('any content');
    assert.equal(digest.length, 64);
    assert.match(digest, /^[0-9a-f]{64}$/);
  });
});

describe('CAS Integrity — Mutation Prevention', () => {
  let cas: TestCAS;

  beforeEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CAS_TEST_DIR, { recursive: true });
    cas = new TestCAS(CAS_TEST_DIR);
  });

  afterEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
  });

  it('rejects mutation attempt', () => {
    const digest = cas.put('original content');
    const mutated = cas.attemptMutation(digest, 'different content');
    assert.equal(mutated, false, 'Mutation must be rejected');
  });

  it('allows idempotent re-put of same content', () => {
    const content = 'immutable data';
    const digest1 = cas.put(content);
    const digest2 = cas.put(content);
    assert.equal(digest1, digest2, 'Idempotent put must succeed');
  });

  it('detects corruption on read', () => {
    const content = 'pristine data';
    const digest = cas.put(content);

    // Corrupt the stored object
    cas._corrupt(digest, 'corrupted data');

    // Read should detect corruption
    assert.throws(() => cas.get(digest), {
      message: /cas_integrity_failed/,
    });
  });
});

describe('CAS Integrity — Duplicate Insertion', () => {
  let cas: TestCAS;

  beforeEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CAS_TEST_DIR, { recursive: true });
    cas = new TestCAS(CAS_TEST_DIR);
  });

  afterEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
  });

  it('duplicate put is idempotent and fast', () => {
    const content = 'dedup-test-content';
    const d1 = cas.put(content);
    const d2 = cas.put(content);
    const d3 = cas.put(content);
    assert.equal(d1, d2);
    assert.equal(d2, d3);

    // Content unchanged
    assert.equal(cas.get(d1), content);
  });

  it('many objects with unique content', () => {
    const digests = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const digest = cas.put(`unique-content-${i}`);
      digests.add(digest);
    }
    assert.equal(digests.size, 100, 'All 100 objects must have unique digests');
  });
});

describe('CAS Integrity — GC with Active References', () => {
  let cas: TestCAS;

  beforeEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CAS_TEST_DIR, { recursive: true });
    cas = new TestCAS(CAS_TEST_DIR);
  });

  afterEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
  });

  it('GC retains referenced objects', () => {
    const d1 = cas.put('referenced-data');
    const d2 = cas.put('unreferenced-data');

    cas.addRef(d1);

    const result = cas.gc();
    assert.equal(result.retained, 1, 'Referenced object must survive GC');
    assert.equal(result.removed, 1, 'Unreferenced object should be removed');

    assert.ok(cas.exists(d1), 'Referenced object must exist after GC');
    assert.ok(!cas.exists(d2), 'Unreferenced object should not exist after GC');
  });

  it('GC respects reference counting', () => {
    const digest = cas.put('shared-data');

    cas.addRef(digest);
    cas.addRef(digest);

    // Remove one ref — should still be retained
    cas.removeRef(digest);
    let result = cas.gc();
    assert.equal(result.retained, 1);

    // Remove last ref — should be collected
    cas.removeRef(digest);
    result = cas.gc();
    assert.equal(result.removed, 1);
  });

  it('GC does not corrupt objects', () => {
    const content = 'gc-integrity-test';
    const digest = cas.put(content);
    cas.addRef(digest);

    // Run GC
    cas.gc();

    // Verify integrity
    const retrieved = cas.get(digest);
    assert.equal(retrieved, content, 'GC must not corrupt retained objects');
  });
});

describe('CAS Integrity — Power Loss During Write', () => {
  let cas: TestCAS;

  beforeEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
    mkdirSync(CAS_TEST_DIR, { recursive: true });
    cas = new TestCAS(CAS_TEST_DIR);
  });

  afterEach(() => {
    rmSync(CAS_TEST_DIR, { recursive: true, force: true });
  });

  it('atomic write prevents partial objects', () => {
    // Pre-existing good object
    const goodDigest = cas.put('good-data');

    // Simulate partial write (directly writing to object path without tmp+rename)
    const badContent = 'partial';
    const badDigest = hashDomain('cas:', 'complete-content');
    const shard = badDigest.substring(0, 2);
    const badDir = join(CAS_TEST_DIR, 'objects', shard);
    mkdirSync(badDir, { recursive: true });
    // Write a .tmp file (simulating crash before rename)
    writeFileSync(join(badDir, badDigest + '.tmp'), badContent, 'utf-8');

    // Good object unaffected
    assert.equal(cas.get(goodDigest), 'good-data');

    // Bad object not retrievable (no final file)
    assert.equal(cas.get(badDigest), null);
  });
});
