/**
 * Database Connection
 * In-memory SQLite-like interface for CLI operations
 */

export interface DB {
  prepare: (sql: string) => Statement;
  exec: (sql: string) => void;
}

export interface Statement {
  run: (...params: unknown[]) => { lastInsertRowid: number; changes: number };
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
}

// In-memory storage
const tables: Map<string, Array<Record<string, unknown>>> = new Map();

class InMemoryStatement implements Statement {
  private sql: string;
  private tableName: string = '';
  private operation: 'insert' | 'select' | 'update' | 'delete' = 'select';
  private conditions: Array<{ column: string; operator: string; value: unknown }> = [];
  private limitValue?: number;

  constructor(sql: string) {
    this.sql = sql.trim();
    this.parseSQL();
  }

  private parseSQL() {
    const upper = this.sql.toUpperCase();

    if (upper.startsWith('INSERT INTO')) {
      this.operation = 'insert';
      const match = this.sql.match(/INSERT INTO\s+(\w+)/i);
      this.tableName = match?.[1] || 'unknown';
    } else if (upper.startsWith('SELECT')) {
      this.operation = 'select';
      const match = this.sql.match(/FROM\s+(\w+)/i);
      this.tableName = match?.[1] || 'unknown';
      this.parseConditions();
      this.parseLimit();
    } else if (upper.startsWith('UPDATE')) {
      this.operation = 'update';
      const match = this.sql.match(/UPDATE\s+(\w+)/i);
      this.tableName = match?.[1] || 'unknown';
      this.parseConditions();
    } else if (upper.startsWith('DELETE')) {
      this.operation = 'delete';
      const match = this.sql.match(/FROM\s+(\w+)/i);
      this.tableName = match?.[1] || 'unknown';
      this.parseConditions();
    }
  }

  private parseConditions() {
    const whereMatch = this.sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
    if (whereMatch) {
      const conditionStr = whereMatch[1];
      // Simple condition parsing
      const conditionMatches = conditionStr.matchAll(/(\w+)\s*(=|>|<|>=|<=|!=)\s*(\?)/gi);
      for (const match of conditionMatches) {
        this.conditions.push({
          column: match[1],
          operator: match[2],
          value: undefined, // Will be set from params
        });
      }
    }
  }

  private parseLimit() {
    const limitMatch = this.sql.match(/LIMIT\s+(\?|\d+)/i);
    if (limitMatch) {
      void this.limitValue; // Property is parsed but not directly used
      this.limitValue = limitMatch[1] === '?' ? undefined : parseInt(limitMatch[1]);
    }
  }

  run(...params: unknown[]): { lastInsertRowid: number; changes: number } {
    const table = this.getTable();

    if (this.operation === 'insert') {
      // Parse values from SQL
      const valuesMatch = this.sql.match(/VALUES\s*\(([^)]+)\)/i);
      if (valuesMatch) {
        const columns = this.sql.match(/\(([^)]+)\)\s*VALUES/)?.[1].split(',').map(c => c.trim()) || [];
        const row: Record<string, unknown> = { id: params.find(p => typeof p === 'string' && p.includes('_')) || `row_${Date.now()}` };

        // Handle named parameters (object) or positional parameters
        if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
          const paramObj = params[0] as Record<string, unknown>;
          columns.forEach((col) => {
            if (paramObj[col] !== undefined) {
              row[col] = paramObj[col];
            }
          });
        } else {
          let paramIndex = 0;
          columns.forEach((col) => {
            if (paramIndex < params.length) {
              row[col] = params[paramIndex++];
            }
          });
        }

        table.push(row);
        return { lastInsertRowid: table.length, changes: 1 };
      }
    } else if (this.operation === 'update') {
      const rows = this.filterRows(params);
      rows.forEach(row => {
        // Apply updates
        const setMatch = this.sql.match(/SET\s+(.+?)\s+WHERE/i);
        if (setMatch) {
          const assignments = setMatch[1].split(',');
          let paramIdx = 0;
          assignments.forEach(assign => {
            const colMatch = assign.match(/(\w+)\s*=\s*(\?)/i);
            if (colMatch) {
              row[colMatch[1]] = params[paramIdx++];
            }
          });
        }
      });
      return { lastInsertRowid: 0, changes: rows.length };
    } else if (this.operation === 'delete') {
      const beforeCount = table.length;
      const rowsToKeep = table.filter(row => !this.matchesConditions(row, params));
      tables.set(this.tableName, rowsToKeep);
      return { lastInsertRowid: 0, changes: beforeCount - rowsToKeep.length };
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const table = this.getTable();
    return table.find(row => this.matchesConditions(row, params));
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const table = this.getTable();
    let results = table.filter(row => this.matchesConditions(row, params));

    // Handle ORDER BY
    const orderMatch = this.sql.match(/ORDER BY\s+(\w+)\s*(DESC|ASC)?/i);
    if (orderMatch) {
      const col = orderMatch[1];
      const desc = orderMatch[2]?.toUpperCase() === 'DESC';
      results.sort((a, b) => {
        const aVal = a[col] ?? 0;
        const bVal = b[col] ?? 0;
        return desc ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
      });
    }

    // Handle LIMIT
    const limitMatch = this.sql.match(/LIMIT\s+(\?|\d+)/i);
    if (limitMatch) {
      const limit = limitMatch[1] === '?' ? (params[params.length - 1] as number) : parseInt(limitMatch[1]);
      results = results.slice(0, limit);
    }

    return results;
  }

  private getTable(): Array<Record<string, unknown>> {
    const table = tables.get(this.tableName);
    if (!table) {
      const newTable: Array<Record<string, unknown>> = [];
      tables.set(this.tableName, newTable);
      return newTable;
    }
    return table;
  }

  private filterRows(params: unknown[]): Array<Record<string, unknown>> {
    const table = this.getTable();
    return table.filter(row => this.matchesConditions(row, params));
  }

  private matchesConditions(row: Record<string, unknown>, params: unknown[]): boolean {
    if (this.conditions.length === 0) return true;

    let paramIndex = 0;
    return this.conditions.every(cond => {
      const value = params[paramIndex++];
      const rowValue = row[cond.column];

      // Safe comparisons for mock DB implementation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = value as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rVal = rowValue as any;

      switch (cond.operator) {
        case '=': return rVal == val;
        case '!=': return rVal != val;
        case '>': return rVal > val;
        case '<': return rVal < val;
        case '>=': return rVal >= val;
        case '<=': return rVal <= val;
        default: return true;
      }
    });
  }
}

class InMemoryDB implements DB {
  prepare(sql: string): Statement {
    return new InMemoryStatement(sql);
  }

  exec(sql: string): void {
    // Handle CREATE TABLE statements
    const createMatch = sql.match(/CREATE TABLE\s+(\w+)/i);
    if (createMatch) {
      const tableName = createMatch[1];
      if (!tables.has(tableName)) {
        tables.set(tableName, []);
      }
    }
  }
}

// Singleton instance
let dbInstance: DB | null = null;

export function getDB(): DB {
  if (!dbInstance) {
    dbInstance = new InMemoryDB();

    // Initialize tables
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS junctions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        junction_type TEXT,
        severity_score REAL,
        fingerprint TEXT,
        source_type TEXT,
        source_ref TEXT,
        trigger_data TEXT,
        trigger_trace TEXT,
        cooldown_until TEXT,
        deduplication_key TEXT,
        decision_report_id TEXT,
        status TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        created_at TEXT,
        updated_at TEXT,
        source_type TEXT,
        source_ref TEXT,
        input_fingerprint TEXT,
        decision_input TEXT,
        decision_output TEXT,
        decision_trace TEXT,
        usage TEXT,
        recommended_action_id TEXT,
        status TEXT,
        outcome_status TEXT,
        outcome_notes TEXT,
        calibration_delta REAL,
        execution_latency REAL,
        policy_snapshot_hash TEXT
      )
    `);

    // Critical indexes for decision queries (SECTION 2)
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id)');
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at)');
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_decisions_policy ON decisions(policy_snapshot_hash)');

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        tenant_id TEXT,
        created_at TEXT,
        policy_snapshot_hash TEXT,
        status TEXT,
        metadata_json TEXT
      )
    `);

    // Critical indexes for hot queries (SECTION 2)
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_runs_run_id ON runs(run_id)');
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_runs_tenant ON runs(tenant_id)');
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_runs_policy ON runs(policy_snapshot_hash)');

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        hash TEXT PRIMARY KEY,
        tenant_id TEXT,
        size_bytes INTEGER,
        mime_type TEXT,
        created_at TEXT
      )
    `);

    // Critical index for artifact lookups (SECTION 2)
    dbInstance.exec('CREATE INDEX IF NOT EXISTS idx_artifacts_hash ON artifacts(hash)');

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        timestamp TEXT,
        event_type TEXT,
        description TEXT,
        metadata_json TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS action_intents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        created_at TEXT,
        decision_report_id TEXT,
        action_type TEXT,
        action_payload TEXT,
        status TEXT,
        executed_at TEXT,
        execution_result TEXT
      )
    `);

    // Learning and Economic Tables
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS learning_signals (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        run_id TEXT,
        category TEXT,
        metadata_json TEXT,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS learning_diagnoses (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        signal_ids TEXT,
        root_cause TEXT,
        confidence_score INTEGER,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS learning_patches (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        diagnosis_id TEXT,
        patch_type TEXT,
        target_files TEXT,
        patch_diff_json TEXT,
        rollback_plan_json TEXT,
        status TEXT,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS symmetry_metrics (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        metric_name TEXT,
        metric_value REAL,
        period_start TEXT,
        period_end TEXT,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS economic_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        run_id TEXT,
        event_type TEXT,
        resource_units INTEGER,
        cost_units INTEGER,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS economic_rollups (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        period_start TEXT,
        period_end TEXT,
        total_runs INTEGER,
        total_cost_units INTEGER,
        total_storage_units INTEGER,
        total_policy_units INTEGER,
        burn_rate REAL,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS economic_alerts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        alert_type TEXT,
        severity TEXT,
        metadata_json TEXT,
        created_at TEXT
      )
    `);

    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        scope TEXT,
        triggers TEXT,
        required_inputs TEXT,
        expected_outputs TEXT,
        verification_steps TEXT,
        rollback_instructions TEXT,
        version TEXT,
        created_at TEXT
      )
    `);
  }
  return dbInstance;
}

export function resetDB(): void {
  tables.clear();
  dbInstance = null;
}

interface DatabaseStatus {
  connected: boolean;
  error?: string;
  tables?: string[];
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  try {
    getDB();
    // Verify database is functional by querying tables
    const tableNames = Array.from(tables.keys());
    return {
      connected: true,
      tables: tableNames,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

