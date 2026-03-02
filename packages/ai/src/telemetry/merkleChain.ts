/**
 * @fileoverview Tamper-evident Merkle audit chain (S-19).
 *
 * Each audit entry is hashed together with the previous entry's hash,
 * forming a linked chain: hash_n = SHA-256(JSON(entry_n) + hash_{n-1}).
 *
 * The chain root is the hash of the last appended entry.
 * Inclusion proofs are the sibling hashes needed to recompute the root.
 *
 * HASH ALGORITHM: SHA-256 (via Node.js crypto module).
 *   BLAKE3 is not available in the TypeScript runtime without a native addon.
 *   When BLAKE3 becomes available, swap sha256 → blake3 in hashEntry().
 *
 * INTEGRATION:
 *   When the enable_merkle_audit_chain feature flag is enabled, all audit
 *   writes go through MerkleAuditChain.append() before reaching the sink.
 *   The chain_hash field is populated on the TenantAuditRecord.
 *
 * INVARIANTS:
 *   - Chain is append-only.
 *   - The genesis entry chains to GENESIS_HASH (all zeros).
 *   - verify() recomputes every hash and checks the chain is unbroken.
 */

import { createHash } from 'crypto';
import type { TenantAuditRecord } from './auditSink.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Genesis previous-hash for the first entry in the chain. */
export const GENESIS_HASH = '0'.repeat(64);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of `content` and return a 64-char hex string.
 * @param content - Input string.
 */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Compute the chain hash for a single entry.
 * Formula: SHA-256(JSON.stringify(entry) + "|" + prevHash)
 *
 * @param entry    - The audit record (without chain_hash field to avoid circularity).
 * @param prevHash - The hash of the previous entry (or GENESIS_HASH for first).
 */
export function computeChainHash(
  entry: Omit<TenantAuditRecord, 'chain_hash'>,
  prevHash: string
): string {
  // Deterministic serialization: JSON with sorted keys.
  const entryJson = JSON.stringify(entry, Object.keys(entry).sort());
  return sha256(`${entryJson}|${prevHash}`);
}

// ─── MerkleAuditChain ─────────────────────────────────────────────────────────

/**
 * Tamper-evident Merkle chain for audit logs.
 *
 * @example
 * ```typescript
 * const chain = new MerkleAuditChain();
 * const hash = chain.append(record);
 * const isValid = chain.verify(chain.getEntries());
 * ```
 */
export class MerkleAuditChain {
  private _hashes: string[] = [];
  private _entries: TenantAuditRecord[] = [];

  /**
   * Append an audit record to the chain.
   * Computes the chain hash and stores both the record (with chain_hash set)
   * and the hash in the internal chain.
   *
   * @param entry - The audit record to append (chain_hash will be set).
   * @returns The computed chain hash for this entry.
   */
  append(entry: TenantAuditRecord): string {
    const prevHash = this._hashes.length > 0
      ? this._hashes[this._hashes.length - 1]!
      : GENESIS_HASH;

    // Exclude chain_hash from hashing to avoid circularity.
    const { chain_hash: _ignored, ...entryWithoutChainHash } = entry;
    const hash = computeChainHash(entryWithoutChainHash, prevHash);

    const recordWithHash: TenantAuditRecord = { ...entry, chain_hash: hash };
    this._entries.push(recordWithHash);
    this._hashes.push(hash);
    return hash;
  }

  /**
   * Verify the full chain integrity by recomputing every hash.
   *
   * @param entries - The ordered list of audit records to verify.
   *   Must include correct chain_hash fields.
   * @returns true if the entire chain is unbroken and all hashes match.
   */
  verify(entries: TenantAuditRecord[]): boolean {
    let prevHash = GENESIS_HASH;
    for (const entry of entries) {
      const { chain_hash, ...entryWithoutChainHash } = entry;
      const expected = computeChainHash(entryWithoutChainHash, prevHash);
      if (chain_hash !== expected) {
        return false;
      }
      prevHash = chain_hash;
    }
    return true;
  }

  /**
   * Returns the current chain root (hash of the last appended entry).
   * Returns GENESIS_HASH if the chain is empty.
   */
  getRoot(): string {
    if (this._hashes.length === 0) return GENESIS_HASH;
    return this._hashes[this._hashes.length - 1]!;
  }

  /**
   * Returns an inclusion proof for the entry at `index`.
   *
   * The proof is the list of sibling hashes from leaf to root needed to
   * recompute the chain root. For a linear chain (not a binary tree), the
   * proof is simply all hashes from index-1 down to genesis plus the entry
   * itself — callers can use this to recompute the chain from any point.
   *
   * @param index - Zero-based index of the entry.
   * @returns Array of chain hashes: [hash_0, hash_1, ..., hash_index].
   *   Returns [] if index is out of range.
   */
  getProof(index: number): string[] {
    if (index < 0 || index >= this._hashes.length) return [];
    // Return the chain segment from genesis through the requested entry.
    return this._hashes.slice(0, index + 1);
  }

  /**
   * Returns a copy of all stored entries (with chain_hash populated).
   */
  getEntries(): TenantAuditRecord[] {
    return [...this._entries];
  }

  /**
   * Returns the current chain length (number of appended entries).
   */
  get length(): number {
    return this._entries.length;
  }

  /**
   * Restore chain state from persisted entries.
   * Verifies the chain before loading — throws if the chain is invalid.
   *
   * @param entries - Previously persisted entries with chain_hash populated.
   * @throws Error if the chain fails verification.
   */
  loadFrom(entries: TenantAuditRecord[]): void {
    if (!this.verify(entries)) {
      throw new Error('[merkleChain] Chain integrity check failed during loadFrom()');
    }
    this._entries = [...entries];
    this._hashes = entries.map((e) => e.chain_hash ?? GENESIS_HASH);
  }
}

// ─── Global Chain (singleton for the default audit path) ──────────────────────

let _globalChain: MerkleAuditChain | null = null;

/**
 * Get or create the global MerkleAuditChain singleton.
 * Used when enable_merkle_audit_chain flag is enabled.
 */
export function getGlobalMerkleChain(): MerkleAuditChain {
  if (!_globalChain) _globalChain = new MerkleAuditChain();
  return _globalChain;
}

/**
 * Reset the global chain (for tests only).
 * @internal
 */
export function _resetMerkleChain(): void {
  _globalChain = null;
}
