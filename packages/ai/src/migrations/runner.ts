/**
 * @fileoverview Database migration infrastructure for Requiem AI.
 *
 * Provides MigrationRunner for tracking and executing database migrations,
 * including RLS policies and state machine CHECK constraints.
 *
 * INVARIANT: Migrations are tracked in __migrations table.
 * INVARIANT: Migrations are applied exactly once (idempotent).
 * INVARIANT: Rollback is supported for critical migrations.
 */

import { logger } from '../telemetry/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result of running migrations.
 */
export interface MigrationResult {
  /** Number of migrations applied. */
  applied: number;
  /** Number of migrations skipped (already applied). */
  skipped: number;
  /** Number of failed migrations. */
  failed: number;
  /** Details of each migration. */
  details: MigrationDetail[];
}

/**
 * Detail of a single migration execution.
 */
export interface MigrationDetail {
  name: string;
  status: 'applied' | 'skipped' | 'failed';
  durationMs: number;
  error?: string;
}

/**
 * Migration definition.
 */
export interface Migration {
  /** Unique migration name (e.g., "001_create_audit_table"). */
  name: string;
  /** Migration to apply. */
  up: (runner: MigrationRunner) => Promise<void>;
  /** Migration to rollback (optional). */
  down?: (runner: MigrationRunner) => Promise<void>;
  /** Whether this migration is critical (requires rollback support). */
  critical?: boolean;
  /** Pre-computed checksum of migration content for integrity verification. */
  checksum?: string;
}

/**
 * Record of applied migration in the database.
 */
export interface AppliedMigration {
  name: string;
  appliedAt: string;
  checksum: string;
  durationMs: number;
}

/**
 * Configuration for MigrationRunner.
 */
export interface MigrationRunnerConfig {
  /** Function to execute SQL queries. */
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  /** Function to begin a transaction. */
  beginTransaction: () => Promise<Transaction>;
  /** Optional table name for migrations tracking. Default: __migrations. */
  migrationsTable?: string;
}

/**
 * Database transaction interface.
 */
export interface Transaction {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * RLS Policy definition.
 */
export interface RlsPolicy {
  name: string;
  table: string;
  action: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  using?: string;
  withCheck?: string;
  roles?: string[];
}

/**
 * CHECK constraint for state machines.
 */
export interface StateConstraint {
  name: string;
  table: string;
  column: string;
  allowedValues: string[];
}

// ─── Migration Runner ─────────────────────────────────────────────────────────

/**
 * Database migration runner with support for RLS policies,
 * CHECK constraints, and rollback.
 *
 * Usage:
 *   const runner = new MigrationRunner({ query, beginTransaction });
 *   await runner.initialize();
 *   await runner.runMigrations(migrations);
 */
export class MigrationRunner {
  public readonly query: (sql: string, params?: unknown[]) => Promise<unknown>;
  public readonly beginTransaction: () => Promise<Transaction>;
  private readonly migrationsTable: string;
  private initialized = false;

  constructor(config: MigrationRunnerConfig) {
    this.query = config.query;
    this.beginTransaction = config.beginTransaction;
    this.migrationsTable = config.migrationsTable ?? '__migrations';
  }

  /**
   * Initialize the migrations table if it doesn't exist.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        duration_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${this.migrationsTable}_applied_at
        ON ${this.migrationsTable}(applied_at);
    `;

    await this.query(sql);
    this.initialized = true;
    logger.info('[migrations] Initialized migrations table');
  }

  /**
   * Run pending migrations.
   * @param migrations - Array of migrations to apply
   * @returns Result of the migration run
   */
  async runMigrations(migrations: Migration[]): Promise<MigrationResult> {
    await this.initialize();

    const result: MigrationResult = {
      applied: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    const appliedMigrations = await this.getAppliedMigrations();
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        result.skipped++;
        result.details.push({
          name: migration.name,
          status: 'skipped',
          durationMs: 0,
        });
        continue;
      }

      const start = Date.now();
      let detail: MigrationDetail;

      try {
        await this.#runMigration(migration);
        detail = {
          name: migration.name,
          status: 'applied',
          durationMs: Date.now() - start,
        };
        result.applied++;
        logger.info(`[migrations] Applied: ${migration.name}`);
      } catch (err) {
        detail = {
          name: migration.name,
          status: 'failed',
          durationMs: Date.now() - start,
          error: String(err),
        };
        result.failed++;
        logger.error(`[migrations] Failed: ${migration.name}`, { error: String(err) });
      }

      result.details.push(detail);
    }

    return result;
  }

  /**
   * Get list of already applied migrations.
   */
  async getAppliedMigrations(): Promise<AppliedMigration[]> {
    await this.initialize();

    const result = await this.query(
      `SELECT name, applied_at as "appliedAt", checksum, duration_ms as "durationMs"
       FROM ${this.migrationsTable}
       ORDER BY applied_at`
    );

    return (result as AppliedMigration[]) || [];
  }

  /**
   * Rollback a specific migration.
   * @param migrationName - Name of migration to rollback
   * @param migrations - Array of migrations (to find the down function)
   */
  async rollback(migrationName: string, migrations: Migration[]): Promise<boolean> {
    await this.initialize();

    const migration = migrations.find(m => m.name === migrationName);
    if (!migration) {
      throw new Error(`Migration not found: ${migrationName}`);
    }

    if (!migration.down) {
      throw new Error(`Migration ${migrationName} does not support rollback`);
    }

    const tx = await this.beginTransaction();
    try {
      await migration.down(this);
      await tx.query(
        `DELETE FROM ${this.migrationsTable} WHERE name = $1`,
        [migrationName]
      );
      await tx.commit();
      logger.info(`[migrations] Rolled back: ${migrationName}`);
      return true;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  /**
   * Create an RLS policy.
   */
  createRlsPolicy(policy: RlsPolicy): string {
    const roles = policy.roles?.join(', ') ?? 'PUBLIC';
    let sql = `CREATE POLICY ${policy.name} ON ${policy.table}`;
    sql += `\n  FOR ${policy.action}`;
    sql += `\n  TO ${roles}`;

    if (policy.using) {
      sql += `\n  USING (${policy.using})`;
    }

    if (policy.withCheck) {
      sql += `\n  WITH CHECK (${policy.withCheck})`;
    }

    return sql + ';';
  }

  /**
   * Create a tenant isolation RLS policy.
   * Assumes tables have a tenant_id column.
   */
  createTenantIsolationPolicy(table: string, tenantColumn = 'tenant_id'): string {
    return this.createRlsPolicy({
      name: `${table}_tenant_isolation`,
      table,
      action: 'ALL',
      using: `${tenantColumn} = current_setting('app.current_tenant')::TEXT`,
      withCheck: `${tenantColumn} = current_setting('app.current_tenant')::TEXT`,
    });
  }

  /**
   * Add a CHECK constraint for state machine validation.
   */
  addCheckConstraint(table: string, constraint: string, expression: string): string {
    return `ALTER TABLE ${table} ADD CONSTRAINT ${constraint} CHECK (${expression});`;
  }

  /**
   * Add a state machine CHECK constraint.
   */
  addStateConstraint(constraint: StateConstraint): string {
    const values = constraint.allowedValues.map(v => `'${v}'`).join(', ');
    const expression = `${constraint.column} IN (${values})`;
    return this.addCheckConstraint(constraint.table, constraint.name, expression);
  }

  /**
   * Enable RLS on a table.
   */
  enableRls(table: string): string {
    return `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`;
  }

  /**
   * Force RLS for table owner.
   */
  forceRls(table: string): string {
    return `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`;
  }

  // ─── Private Methods ─────────────────────────────────────────────────────────

  async #runMigration(migration: Migration): Promise<void> {
    const tx = await this.beginTransaction();
    const start = Date.now();

    try {
      // Run the migration
      await migration.up(this);

      // Record the migration
      const checksum = await this.#computeChecksum(migration);
      const durationMs = Date.now() - start;

      await tx.query(
        `INSERT INTO ${this.migrationsTable} (name, checksum, duration_ms) VALUES ($1, $2, $3)`,
        [migration.name, checksum, durationMs]
      );

      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  }

  async #computeChecksum(migration: Migration): Promise<string> {
    // Use provided checksum if available
    if (migration.checksum) {
      return migration.checksum;
    }
    // Fallback: compute checksum from migration name (less secure)
    // This is a last-resort fallback - migrations should always provide a checksum
    const crypto = await import('crypto');
    logger.warn(
      `[migrations] Migration "${migration.name}" has no checksum defined. ` +
      `Provide a checksum in the Migration definition for production integrity.`
    );
    return crypto.createHash('sha256').update(migration.name).digest('hex').slice(0, 16);
  }
}

// ─── Migration Helpers ────────────────────────────────────────────────────────

/**
 * Create a standard set of migrations for Requiem AI.
 */
export function createStandardMigrations(): Migration[] {
  return [
    {
      name: '001_enable_rls_on_audit',
      up: async (runner) => {
        await runner.query(runner.enableRls('audit_log'));
        await runner.query(runner.forceRls('audit_log'));
        await runner.query(runner.createTenantIsolationPolicy('audit_log'));
      },
    },
    {
      name: '002_enable_rls_on_cost',
      up: async (runner) => {
        await runner.query(runner.enableRls('cost_records'));
        await runner.query(runner.forceRls('cost_records'));
        await runner.query(runner.createTenantIsolationPolicy('cost_records'));
      },
    },
    {
      name: '003_add_circuit_state_constraint',
      up: async (runner) => {
        await runner.query(runner.addStateConstraint({
          name: 'circuit_state_check',
          table: 'circuit_states',
          column: 'state',
          allowedValues: ['CLOSED', 'OPEN', 'HALF_OPEN'],
        }));
      },
    },
    {
      name: '004_add_budget_state_constraint',
      up: async (runner) => {
        await runner.query(runner.addStateConstraint({
          name: 'budget_state_check',
          table: 'budget_usage',
          column: 'status',
          allowedValues: ['active', 'exceeded', 'frozen'],
        }));
      },
    },
  ];
}
