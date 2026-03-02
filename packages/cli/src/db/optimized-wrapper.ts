/**
 * Optimized Database Wrapper
 * 
 * Features:
 * - Prepared statements for hot queries
 * - Statement caching
 * - Lazy field evaluation
 * - Verification result caching by manifest hash
 * - Provider catalog caching
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface PreparedStatements {
  // Run queries
  getRunById: Database.Statement;
  getRunByFingerprint: Database.Statement;
  insertRun: Database.Statement;
  updateRunStatus: Database.Statement;
  
  // Artifact queries
  getArtifactByHash: Database.Statement;
  insertArtifact: Database.Statement;
  
  // Ledger queries
  getLedgerByRunId: Database.Statement;
  insertLedgerEntry: Database.Statement;
  
  // Policy queries
  getPolicyByHash: Database.Statement;
  getActivePolicy: Database.Statement;
  
  // Verification cache
  getVerificationCache: Database.Statement;
  setVerificationCache: Database.Statement;
  
  // Provider catalog cache
  getProviderCatalog: Database.Statement;
  setProviderCatalog: Database.Statement;
}

export class OptimizedDatabase {
  private db: Database.Database;
  private stmts: PreparedStatements | null = null;
  private static instance: OptimizedDatabase | null = null;

  private constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  static getInstance(dbPath?: string): OptimizedDatabase {
    if (!OptimizedDatabase.instance) {
      OptimizedDatabase.instance = new OptimizedDatabase(dbPath || ':memory:');
    }
    return OptimizedDatabase.instance;
  }

  static resetInstance(): void {
    OptimizedDatabase.instance = null;
  }

  private initialize(): void {
    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB mmap
    
    // Run schema
    const schemaPath = join(__dirname, 'optimized-schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
    
    // Prepare statements
    this.prepareStatements();
  }

  private prepareStatements(): void {
    this.stmts = {
      // Run queries
      getRunById: this.db.prepare(
        'SELECT * FROM runs WHERE run_id = ? LIMIT 1'
      ),
      getRunByFingerprint: this.db.prepare(
        'SELECT * FROM runs WHERE fingerprint = ? LIMIT 1'
      ),
      insertRun: this.db.prepare(
        `INSERT INTO runs (run_id, manifest_hash, fingerprint, status, started_at, tenant_id, policy_snapshot_hash, inputs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      updateRunStatus: this.db.prepare(
        'UPDATE runs SET status = ?, completed_at = ?, duration_ms = ?, outputs = ? WHERE run_id = ?'
      ),
      
      // Artifact queries
      getArtifactByHash: this.db.prepare(
        'SELECT hash, size_bytes, content_type, created_at FROM artifacts WHERE hash = ? LIMIT 1'
      ),
      insertArtifact: this.db.prepare(
        'INSERT OR IGNORE INTO artifacts (hash, size_bytes, content_type, created_at) VALUES (?, ?, ?, ?)'
      ),
      
      // Ledger queries
      getLedgerByRunId: this.db.prepare(
        'SELECT * FROM ledger WHERE run_id = ? ORDER BY sequence_number ASC'
      ),
      insertLedgerEntry: this.db.prepare(
        `INSERT INTO ledger (entry_id, run_id, event_type, timestamp, sequence_number, previous_hash, entry_hash, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ),
      
      // Policy queries
      getPolicyByHash: this.db.prepare(
        'SELECT hash, version, created_at, content FROM policy_snapshots WHERE hash = ? LIMIT 1'
      ),
      getActivePolicy: this.db.prepare(
        'SELECT hash, version, content FROM policy_snapshots WHERE is_active = 1 LIMIT 1'
      ),
      
      // Verification cache
      getVerificationCache: this.db.prepare(
        'SELECT result FROM verification_cache WHERE manifest_hash = ? AND expires_at > ? LIMIT 1'
      ),
      setVerificationCache: this.db.prepare(
        `INSERT OR REPLACE INTO verification_cache (manifest_hash, result, verified_at, expires_at)
         VALUES (?, ?, ?, ?)`
      ),
      
      // Provider catalog cache
      getProviderCatalog: this.db.prepare(
        'SELECT catalog_data FROM provider_catalog_cache WHERE catalog_hash = ? AND expires_at > ? LIMIT 1'
      ),
      setProviderCatalog: this.db.prepare(
        `INSERT OR REPLACE INTO provider_catalog_cache (catalog_hash, fetched_at, expires_at, catalog_data)
         VALUES (?, ?, ?, ?)`
      ),
    };
  }

  // Run operations
  getRunById(runId: string): unknown | null {
    return this.stmts!.getRunById.get(runId) || null;
  }

  getRunByFingerprint(fingerprint: string): unknown | null {
    return this.stmts!.getRunByFingerprint.get(fingerprint) || null;
  }

  insertRun(params: {
    runId: string;
    manifestHash: string;
    fingerprint: string;
    status: string;
    startedAt: number;
    tenantId?: string;
    policySnapshotHash?: string;
    inputs?: string;
  }): void {
    this.stmts!.insertRun.run(
      params.runId,
      params.manifestHash,
      params.fingerprint,
      params.status,
      params.startedAt,
      params.tenantId || null,
      params.policySnapshotHash || null,
      params.inputs || null
    );
  }

  updateRunStatus(
    runId: string,
    status: string,
    completedAt: number,
    durationMs: number,
    outputs?: string
  ): void {
    this.stmts!.updateRunStatus.run(
      status,
      completedAt,
      durationMs,
      outputs || null,
      runId
    );
  }

  // Artifact operations
  getArtifactByHash(hash: string): { hash: string; size_bytes: number; content_type: string; created_at: number } | null {
    const row = this.stmts!.getArtifactByHash.get(hash) as { hash: string; size_bytes: number; content_type: string; created_at: number } | undefined;
    return row || null;
  }

  insertArtifact(hash: string, sizeBytes: number, contentType?: string): void {
    this.stmts!.insertArtifact.run(
      hash,
      sizeBytes,
      contentType || 'application/octet-stream',
      Date.now()
    );
  }

  // Ledger operations
  getLedgerByRunId(runId: string): unknown[] {
    return this.stmts!.getLedgerByRunId.all(runId);
  }

  insertLedgerEntry(params: {
    entryId: string;
    runId: string;
    eventType: string;
    timestamp: number;
    sequenceNumber: number;
    previousHash?: string;
    entryHash: string;
    details?: string;
  }): void {
    this.stmts!.insertLedgerEntry.run(
      params.entryId,
      params.runId,
      params.eventType,
      params.timestamp,
      params.sequenceNumber,
      params.previousHash || null,
      params.entryHash,
      params.details || null
    );
  }

  // Policy operations
  getPolicyByHash(hash: string): { hash: string; version: number; content: string } | null {
    const row = this.stmts!.getPolicyByHash.get(hash) as { hash: string; version: number; content: string } | undefined;
    return row || null;
  }

  getActivePolicy(): { hash: string; version: number; content: string } | null {
    const row = this.stmts!.getActivePolicy.get() as { hash: string; version: number; content: string } | undefined;
    return row || null;
  }

  // Verification cache - key for performance
  getCachedVerification(manifestHash: string): boolean | null {
    const row = this.stmts!.getVerificationCache.get(manifestHash, Date.now()) as { result: number } | undefined;
    if (row) {
      return Boolean(row.result);
    }
    return null;
  }

  setCachedVerification(manifestHash: string, result: boolean, ttlSeconds: number = 3600): void {
    const now = Math.floor(Date.now() / 1000);
    this.stmts!.setVerificationCache.run(
      manifestHash,
      result ? 1 : 0,
      now,
      now + ttlSeconds
    );
  }

  // Provider catalog cache
  getCachedProviderCatalog(catalogHash: string): string | null {
    const row = this.stmts!.getProviderCatalog.get(catalogHash, Date.now()) as { catalog_data: string } | undefined;
    return row?.catalog_data || null;
  }

  setCachedProviderCatalog(catalogHash: string, data: string, ttlSeconds: number = 300): void {
    const now = Math.floor(Date.now() / 1000);
    this.stmts!.setProviderCatalog.run(
      catalogHash,
      now,
      now + ttlSeconds,
      data
    );
  }

  // Cleanup old data
  cleanup(olderThanDays: number = 90): void {
    const cutoff = Math.floor(Date.now() / 1000) - (olderThanDays * 86400);
    
    this.db.prepare('DELETE FROM ledger WHERE timestamp < ?').run(cutoff);
    this.db.prepare('DELETE FROM verification_cache WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
    this.db.prepare('DELETE FROM provider_catalog_cache WHERE expires_at < ?').run(Math.floor(Date.now() / 1000));
    this.db.prepare('VACUUM').run();
  }

  close(): void {
    this.db.close();
    OptimizedDatabase.resetInstance();
  }
}

// Export singleton accessor
export function getDB(dbPath?: string): OptimizedDatabase {
  return OptimizedDatabase.getInstance(dbPath);
}

