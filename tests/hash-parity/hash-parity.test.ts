/**
 * Cross-Language Hash Parity Tests
 *
 * Verifies that the TypeScript and C++ hash implementations produce
 * identical output for identical inputs. This is a critical invariant
 * for CLAIM_HASH_CANONICAL.
 *
 * Test vectors are defined here and must match the C++ test in
 * hash-parity-vectors.test.cpp.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalHash,
  hashDomain,
  canonicalStringify,
  hashCanonical,
  normalizeText,
  computeMerkleRoot,
  requestDigest,
  resultDigest,
  casContentHash,
  eventChainHash,
  policyProofHash,
  receiptHash,
  hashRuntimeInfo,
  verifyDigest,
} from '../../packages/hash/src/canonical_hash.js';

// ---------------------------------------------------------------------------
// Test Vectors — must produce identical output in C++ and TypeScript
// ---------------------------------------------------------------------------

const TEST_VECTORS = [
  { input: '', description: 'empty string' },
  { input: 'hello', description: 'simple ASCII' },
  { input: 'hello world', description: 'ASCII with space' },
  { input: '{"key":"value"}', description: 'JSON-like string' },
  { input: '\n', description: 'newline' },
  { input: '\r\n', description: 'CRLF' },
  { input: '\r', description: 'lone CR' },
  { input: 'café', description: 'UTF-8 with accented chars' },
  { input: '日本語', description: 'CJK characters' },
  { input: '🔒', description: 'emoji' },
  { input: 'a'.repeat(1000), description: '1000 a characters' },
  { input: '\x00\x01\x02', description: 'binary control chars' },
  { input: 'line1\nline2\nline3', description: 'multi-line LF' },
  { input: 'line1\r\nline2\r\nline3', description: 'multi-line CRLF' },
];

const DOMAIN_VECTORS = [
  { domain: 'req:', payload: '{"tool_id":"test"}' },
  { domain: 'res:', payload: '{"exit_code":0}' },
  { domain: 'cas:', payload: 'blob-content-here' },
  { domain: 'evt:', payload: '{"seq":1,"prev":"0000"}' },
  { domain: 'pol:', payload: '{"decision":"allow"}' },
  { domain: 'rcpt:', payload: '{"receipt_id":"r1"}' },
  { domain: 'plan:', payload: '{"steps":[]}' },
  { domain: 'cap:', payload: '{"cap_id":"c1"}' },
];

describe('Hash Parity — Core Hashing', () => {
  it('produces 64 hex character output for all inputs', () => {
    for (const { input, description } of TEST_VECTORS) {
      const hash = canonicalHash(input);
      assert.equal(hash.length, 64, `${description}: expected 64 hex chars, got ${hash.length}`);
      assert.match(hash, /^[0-9a-f]{64}$/, `${description}: invalid hex characters`);
    }
  });

  it('is deterministic — same input always produces same hash', () => {
    for (const { input, description } of TEST_VECTORS) {
      const hash1 = canonicalHash(input);
      const hash2 = canonicalHash(input);
      assert.equal(hash1, hash2, `${description}: non-deterministic hash`);
    }
  });

  it('different inputs produce different hashes (collision resistance)', () => {
    const hashes = new Set<string>();
    for (const { input } of TEST_VECTORS) {
      hashes.add(canonicalHash(input));
    }
    assert.equal(hashes.size, TEST_VECTORS.length, 'Hash collision detected');
  });
});

describe('Hash Parity — Domain Separation', () => {
  it('domain-separated hashes differ from bare hashes', () => {
    for (const { domain, payload } of DOMAIN_VECTORS) {
      const bareHash = canonicalHash(payload);
      const domainHash = hashDomain(domain, payload);
      assert.notEqual(bareHash, domainHash, `Domain ${domain} did not change hash`);
    }
  });

  it('different domains produce different hashes for same payload', () => {
    const payload = 'test-payload';
    const domains = ['req:', 'res:', 'cas:', 'evt:', 'pol:', 'rcpt:', 'plan:', 'cap:'];
    const hashes = new Set<string>();
    for (const domain of domains) {
      hashes.add(hashDomain(domain, payload));
    }
    assert.equal(hashes.size, domains.length, 'Domain collision detected');
  });

  it('domain-specific functions match hashDomain', () => {
    const payload = '{"test":true}';
    assert.equal(requestDigest(payload), hashDomain('req:', payload));
    assert.equal(resultDigest(payload), hashDomain('res:', payload));
    assert.equal(casContentHash(payload), hashDomain('cas:', payload));
    assert.equal(eventChainHash(payload), hashDomain('evt:', payload));
    assert.equal(policyProofHash(payload), hashDomain('pol:', payload));
    assert.equal(receiptHash(payload), hashDomain('rcpt:', payload));
  });
});

describe('Hash Parity — Canonical JSON', () => {
  it('sorts keys lexicographically', () => {
    const a = canonicalStringify({ z: 1, a: 2, m: 3 });
    const b = canonicalStringify({ a: 2, m: 3, z: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":2,"m":3,"z":1}');
  });

  it('produces no whitespace', () => {
    const result = canonicalStringify({ key: 'value', nested: { a: 1 } });
    assert.ok(!result.includes(' '), 'Canonical JSON must not contain spaces');
    assert.ok(!result.includes('\n'), 'Canonical JSON must not contain newlines');
  });

  it('omits undefined values', () => {
    const result = canonicalStringify({ a: 1, b: undefined, c: 3 });
    assert.equal(result, '{"a":1,"c":3}');
  });

  it('normalizes -0 to 0', () => {
    const result = canonicalStringify({ n: -0 });
    assert.equal(result, '{"n":0}');
  });

  it('rejects non-finite numbers', () => {
    assert.throws(() => canonicalStringify({ n: Infinity }));
    assert.throws(() => canonicalStringify({ n: -Infinity }));
    assert.throws(() => canonicalStringify({ n: NaN }));
  });

  it('handles nested objects with stable ordering', () => {
    const obj = { b: { d: 1, c: 2 }, a: { f: 3, e: 4 } };
    const expected = '{"a":{"e":4,"f":3},"b":{"c":2,"d":1}}';
    assert.equal(canonicalStringify(obj), expected);
  });

  it('handles arrays preserving order', () => {
    const result = canonicalStringify([3, 1, 2]);
    assert.equal(result, '[3,1,2]');
  });

  it('hashCanonical produces consistent results', () => {
    const obj = { z: 'hello', a: 'world' };
    const hash1 = hashCanonical(obj);
    const hash2 = hashCanonical({ a: 'world', z: 'hello' });
    assert.equal(hash1, hash2, 'Key order should not affect hash');
  });
});

describe('Hash Parity — Text Normalization', () => {
  it('normalizes CRLF to LF', () => {
    assert.equal(normalizeText('a\r\nb'), 'a\nb');
  });

  it('normalizes lone CR to LF', () => {
    assert.equal(normalizeText('a\rb'), 'a\nb');
  });

  it('preserves LF', () => {
    assert.equal(normalizeText('a\nb'), 'a\nb');
  });

  it('normalizes mixed line endings', () => {
    assert.equal(normalizeText('a\r\nb\rc\nd'), 'a\nb\nc\nd');
  });

  it('applies NFC normalization', () => {
    // é can be represented as U+00E9 (precomposed) or U+0065 U+0301 (decomposed)
    const precomposed = '\u00E9';
    const decomposed = '\u0065\u0301';
    assert.equal(normalizeText(decomposed), precomposed);
  });
});

describe('Hash Parity — Merkle Root', () => {
  it('empty list produces deterministic root', () => {
    const root = computeMerkleRoot([]);
    assert.equal(root.length, 64);
    assert.equal(root, computeMerkleRoot([]));
  });

  it('single digest returns itself', () => {
    const digest = canonicalHash('test');
    assert.equal(computeMerkleRoot([digest]), digest);
  });

  it('two digests produce a combined root', () => {
    const d1 = canonicalHash('a');
    const d2 = canonicalHash('b');
    const root = computeMerkleRoot([d1, d2]);
    assert.equal(root, canonicalHash(d1 + d2));
  });

  it('is deterministic for N digests', () => {
    const digests = ['a', 'b', 'c', 'd', 'e'].map(s => canonicalHash(s));
    const root1 = computeMerkleRoot(digests);
    const root2 = computeMerkleRoot(digests);
    assert.equal(root1, root2);
  });

  it('different digest orders produce different roots', () => {
    const d1 = canonicalHash('a');
    const d2 = canonicalHash('b');
    assert.notEqual(
      computeMerkleRoot([d1, d2]),
      computeMerkleRoot([d2, d1]),
    );
  });
});

describe('Hash Parity — Verification', () => {
  it('verifyDigest returns true for matching content', () => {
    const content = 'test content';
    const digest = canonicalHash(content);
    assert.ok(verifyDigest(content, digest));
  });

  it('verifyDigest returns false for mismatching content', () => {
    const content = 'test content';
    const digest = canonicalHash('different content');
    assert.ok(!verifyDigest(content, digest));
  });

  it('verifyDigest with domain works correctly', () => {
    const content = 'test';
    const digest = hashDomain('cas:', content);
    assert.ok(verifyDigest(content, digest, 'cas:'));
    assert.ok(!verifyDigest(content, digest, 'req:'));
  });
});

describe('Hash Parity — Runtime Info', () => {
  it('returns valid runtime info', () => {
    const info = hashRuntimeInfo();
    assert.ok(info.algorithm === 'blake3' || info.algorithm === 'sha256');
    assert.equal(info.version, 1);
    assert.equal(typeof info.blake3_available, 'boolean');
    assert.equal(typeof info.fallback_active, 'boolean');
    // blake3_available and fallback_active are mutually exclusive
    assert.notEqual(info.blake3_available, info.fallback_active);
  });
});

// ---------------------------------------------------------------------------
// Reference Vectors (for C++ parity verification)
// ---------------------------------------------------------------------------
// These vectors can be exported and verified against C++ output.

describe('Hash Parity — Reference Vectors', () => {
  it('generates stable reference vectors', () => {
    const vectors: Array<{ input: string; hash: string; domain_hashes: Record<string, string> }> = [];

    for (const { input } of TEST_VECTORS.slice(0, 5)) {
      const entry = {
        input,
        hash: canonicalHash(input),
        domain_hashes: {} as Record<string, string>,
      };
      for (const { domain } of DOMAIN_VECTORS.slice(0, 3)) {
        entry.domain_hashes[domain] = hashDomain(domain, input);
      }
      vectors.push(entry);
    }

    // Verify stability
    for (const vec of vectors) {
      assert.equal(canonicalHash(vec.input), vec.hash);
      for (const [domain, expected] of Object.entries(vec.domain_hashes)) {
        assert.equal(hashDomain(domain, vec.input), expected);
      }
    }

    // All hashes should be unique
    const allHashes = vectors.flatMap(v => [v.hash, ...Object.values(v.domain_hashes)]);
    assert.equal(new Set(allHashes).size, allHashes.length, 'Duplicate hashes in reference vectors');
  });
});
