/**
 * @fileoverview SQLite Storage Provider
 * 
 * Provides normalized SQLite persistence with:
 * - WAL mode for concurrent access
 * - Synchronous=NORMAL for performance
 * - Foreign keys enabled
 * - Schema version tracking
 * - Migration framework
 * - In-memory mode support (--memory, --dry-run)
 * 
 * CONFIG → config.toml (human editable)
 * STATE → SQLite on-disk (WAL mode)
 * BLOBS → CAS directory (hash-addressed)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface StorageConfig {
  dataDir: string;
  memory: boolean;
  readonly: boolean;
}

export interface SchemaVersion {
  version: number;
  applied_at: string;
  description: string;
}

// Default data directory
const DEFAULT_DATA_DIR = path.join(os.homedir(), '.requiem', 'data');

// Schema version - bump this when schema changes
const CURRENT_SCHEMA_VERSION = 1;

export class SQLiteStorage {
  private db: Database.Database | null = null;
  private config: StorageConfig;
  private readonly: boolean = false;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      dataDir: config.dataDir || DEFAULT_DATA_DIR,
      memory: config.memory || false,
      readonly: config.readonly || false,
    };
    this.readonly = config.readonly || false;
  }

  /**
   * Initialize the database connection with proper pragmas
   */
  initialize(): void {
    if (this.db) return;

    const dbPath = this.config.memory 
      ? ':memory:' 
      : path.join(this.config.dataDir, 'requiem.db');

    // Ensure directory exists for non-memory databases
    if (!this.config.memory) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }

    // Open database
    this.db = new Database(dbPath, {
      readonly: this.readonly,
      fileMustExist: false,
    });

    // Enable WAL mode for concurrent access
    this.db.pragma('journal_mode = WAL');
    // Normal synchronous for performance (still safe with WAL)
    this.db.pragma('synchronous = NORMAL');
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
    // Enable WAL checkpointing
    this.db.pragma('wal_autocheckpoint = 1000');

    // Run migrations
    this.runMigrations();
  }

  /**
   * Get the database instance
   */
  getDB(): Database.Database {
    if (!this.db) {
      this.initialize();
    }
    return this.db!;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Run database migrations
   */
  private runMigrations(): void {
    if (!this.db) return;

    // Create schema_version table if not exists
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL,
        description TEXT NOT NULL
      )
    `);

    // Get current version
    const current = this.db.prepare(
      'SELECT MAX(version) as version FROM schema_version'
    ).get() as { version: number | null };

    const currentVersion = current?.version || 0;

    // Apply migrations
    if (currentVersion < 1) {
      this.migrationV1();
    }

    // Future migrations go here
  }

  /**
   * Migration V1: Initial schema
   */
  private migrationV1(): void {
    if (!this.db) return;

    // Junctions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS junctions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        junction_type TEXT NOT NULL,
        severity_score REAL,
        fingerprint TEXT,
        source_type TEXT,
        source_ref TEXT,
        trigger_data TEXT,
        trigger_trace TEXT,
        cooldown_until TEXT,
        deduplication_key TEXT,
        decision_report_id TEXT,
        status TEXT DEFAULT 'active',
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Decisions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        source_type TEXT,
        source_ref TEXT,
        input_fingerprint TEXT,
        decision_input TEXT,
        decision_output TEXT,
        decision_trace TEXT,
        usage TEXT,
        recommended_action_id TEXT,
        status TEXT DEFAULT 'pending',
        outcome_status TEXT,
        outcome_notes TEXT,
        calibration_delta REAL,
        execution_latency REAL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Action intents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS action_intents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        decision_report_id TEXT,
        action_type TEXT NOT NULL,
        action_payload TEXT,
        status TEXT DEFAULT 'pending',
        executed_at TEXT,
        execution_result TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (decision_report_id) REFERENCES decisions(id)
      )
    `);

    // Learning signals table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_signals (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        run_id TEXT,
        category TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Learning diagnoses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_diagnoses (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        signal_ids TEXT NOT NULL,
        root_cause TEXT NOT NULL,
        confidence_score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Learning patches table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_patches (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        diagnosis_id TEXT NOT NULL,
        patch_type TEXT NOT NULL,
        target_files TEXT NOT NULL,
        patch_diff_json TEXT,
        rollback_plan_json TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (diagnosis_id) REFERENCES learning_diagnoses(id)
      )
    `);

    // Symmetry metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS symmetry_metrics (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Economic events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS economic_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        run_id TEXT,
        event_type TEXT NOT NULL,
        resource_units INTEGER NOT NULL DEFAULT 0,
        cost_units INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Economic rollups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS economic_rollups (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        total_runs INTEGER NOT NULL DEFAULT 0,
        total_cost_units INTEGER NOT NULL DEFAULT 0,
        total_storage_units INTEGER NOT NULL DEFAULT 0,
        total_policy_units INTEGER NOT NULL DEFAULT 0,
        burn_rate REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Economic alerts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS economic_alerts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Skills table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        triggers TEXT NOT NULL,
        required_inputs TEXT NOT NULL,
        expected_outputs TEXT NOT NULL,
        verification_steps TEXT,
        rollback_instructions TEXT,
        version TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    // Tenants table (required for FK)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT DEFAULT 'active'
      )
    `);

    // Traces table for observability
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        trace_id TEXT PRIMARY KEY,
        run_id TEXT,
        tenant_id TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT DEFAULT 'running',
        metadata_json TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )
    `);

    // Trace events table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS trace_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        t_ns INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        data_json TEXT,
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at);
      CREATE INDEX IF NOT EXISTS idx_junctions_tenant ON junctions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_economic_events_tenant ON economic_events(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_trace_events_trace ON trace_events(trace_id);
    `);

    // Record migration
    this.db.prepare(`
      INSERT INTO schema_version (version, applied_at, description)
      VALUES (1, ?, 'Initial schema')
    `).run(new Date().toISOString());
  }

  /**
   * Get current schema version
   */
  getSchemaVersion(): number {
    if (!this.db) this.initialize();
    const result = this.db!.prepare(
      'SELECT MAX(version) as version FROM schema_version'
    ).get() as { version: number | null };
    return result?.version || 0;
  }

  /**
   * Run integrity check
   */
  integrityCheck(): { ok: boolean; errors: string[] } {
    if (!this.db) this.initialize();
    
    const result = this.db!.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
    const ok = result.every(r => r.integrity_check === 'ok');
    
    return {
      ok,
      errors: ok ? [] : result.filter(r => r.integrity_check !== 'ok').map(r => r.integrity_check),
    };
  }

  /**
   * Run VACUUM to optimize database
   */
  vacuum(): void {
    if (!this.db) this.initialize();
    this.db!.exec('VACUUM');
  }

  /**
   * Get database stats
   */
  getStats(): { pageCount: number; freelistCount: number; bytes: number } {
    if (!this.db) this.initialize();
    const result = this.db!.prepare('PRAGMA page_count').get() as { page_count: number };
    const freelist = this.db!.prepare('PRAGMA freelist_count').get() as { freelist_count: number };
    const bytes = this.db!.prepare('PRAGMA page_size').get() as { page_size: number };
    
    return {
      pageCount: result.page_count,
      freelistCount: freelist.freelist_count,
      bytes: result.page_count * (bytes.page_size || 4096),
    };
  }
}

// Singleton instance
let storageInstance: SQLiteStorage | null = null;

/**
 * Get the global storage instance
 */
export function getStorage(config?: Partial<StorageConfig>): SQLiteStorage {
  if (!storageInstance) {
    storageInstance = new SQLiteStorage(config);
  }
  return storageInstance;
}

/**
 * Reset storage instance (for testing)
 */
export function resetStorage(): void {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
}

/**
 * Create storage from environment/config
 */
export function createStorageFromConfig(): SQLiteStorage {
  const memory = process.env.REQUIEM_MEMORY === 'true';
  const dataDir = process.env.REQUIEM_DATA_DIR || DEFAULT_DATA_DIR;
  
  return new SQLiteStorage({ dataDir, memory });
}
