/**
 * Operator Console Database Layer
 *
 * Tables for:
 * - prompts: versioned prompt packs with deterministic hash IDs
 * - runs_log: structured run logging with trace_id and artifact export
 * - mode_settings: operator mode configuration (intensity, thinking, tool policy)
 * - provider_configs: provider/model configuration with throttles
 */

import { getDB, DB } from './connection.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Prompt {
  id: string; // deterministic hash of content
  name: string;
  version: string;
  content: string;
  description?: string;
  tags: string[];
  variables: string[];
  created_at: string;
  updated_at: string;
  usage_count: number;
}

export interface RunLog {
  run_id: string;
  trace_id: string;
  parent_run_id?: string;
  prompt_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'diverged';
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  input_hash?: string;
  output_hash?: string;
  artifact_path?: string;
  manifest_path?: string;
  metadata_json: string;
  exit_code?: number;
  error_message?: string;
}

export interface ModeSettings {
  id: string; // 'global' or tenant-specific
  intensity: 'minimal' | 'normal' | 'aggressive';
  thinking_mode: 'fast' | 'balanced' | 'deep';
  tool_policy: 'deny_all' | 'ask' | 'allow_registered' | 'allow_all';
  max_iterations: number;
  timeout_seconds: number;
  updated_at: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  provider_type: 'anthropic' | 'openai' | 'local' | 'custom';
  base_url?: string;
  api_key_env_var?: string;
  default_model: string;
  available_models: string[];
  throttle_rpm: number; // requests per minute
  throttle_tpm: number; // tokens per minute
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  enabled: boolean;
  priority: number; // lower = higher priority
  created_at: string;
  updated_at: string;
}

// ─── Repository: Prompts ───────────────────────────────────────────────────────

export class PromptRepository {
  private db: DB;

  constructor(db?: DB) {
    this.db = db ?? getDB();
  }

  static initializeTable(db: DB): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS prompts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        content TEXT NOT NULL,
        description TEXT,
        tags TEXT, -- JSON array
        variables TEXT, -- JSON array
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        usage_count INTEGER DEFAULT 0
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_prompts_name ON prompts(name)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts(tags)');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_name_version ON prompts(name, version)');
  }

  create(prompt: Omit<Prompt, 'usage_count'>): Prompt {
    const stmt = this.db.prepare(`
      INSERT INTO prompts (id, name, version, content, description, tags, variables, created_at, updated_at, usage_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    stmt.run(
      prompt.id,
      prompt.name,
      prompt.version,
      prompt.content,
      prompt.description ?? null,
      JSON.stringify(prompt.tags),
      JSON.stringify(prompt.variables),
      prompt.created_at,
      prompt.updated_at
    );
    return { ...prompt, usage_count: 0 };
  }

  findById(id: string): Prompt | undefined {
    const stmt = this.db.prepare('SELECT * FROM prompts WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToPrompt(row) : undefined;
  }

  findByName(name: string, version?: string): Prompt | undefined {
    if (version) {
      const stmt = this.db.prepare('SELECT * FROM prompts WHERE name = ? AND version = ?');
      const row = stmt.get(name, version) as Record<string, unknown> | undefined;
      return row ? this.rowToPrompt(row) : undefined;
    }
    const stmt = this.db.prepare('SELECT * FROM prompts WHERE name = ? ORDER BY version DESC LIMIT 1');
    const row = stmt.get(name) as Record<string, unknown> | undefined;
    return row ? this.rowToPrompt(row) : undefined;
  }

  list(options?: { tag?: string; limit?: number; offset?: number }): Prompt[] {
    let sql = 'SELECT * FROM prompts';
    const params: unknown[] = [];

    if (options?.tag) {
      sql += ' WHERE tags LIKE ?';
      params.push(`%${options.tag}%`);
    }

    sql += ' ORDER BY updated_at DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToPrompt(r));
  }

  incrementUsage(id: string): void {
    const stmt = this.db.prepare('UPDATE prompts SET usage_count = usage_count + 1 WHERE id = ?');
    stmt.run(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM prompts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private rowToPrompt(row: Record<string, unknown>): Prompt {
    return {
      id: String(row.id),
      name: String(row.name),
      version: String(row.version),
      content: String(row.content),
      description: row.description ? String(row.description) : undefined,
      tags: JSON.parse(String(row.tags ?? '[]')),
      variables: JSON.parse(String(row.variables ?? '[]')),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      usage_count: Number(row.usage_count ?? 0),
    };
  }
}

// ─── Repository: Run Logs ──────────────────────────────────────────────────────

export class RunLogRepository {
  private db: DB;

  constructor(db?: DB) {
    this.db = db ?? getDB();
  }

  static initializeTable(db: DB): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs_log (
        run_id TEXT PRIMARY KEY,
        trace_id TEXT NOT NULL,
        parent_run_id TEXT,
        prompt_id TEXT,
        status TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_ms INTEGER,
        input_hash TEXT,
        output_hash TEXT,
        artifact_path TEXT,
        manifest_path TEXT,
        metadata_json TEXT DEFAULT '{}',
        exit_code INTEGER,
        error_message TEXT,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id)
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_runs_trace ON runs_log(trace_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_runs_status ON runs_log(status)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs_log(start_time)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_runs_prompt ON runs_log(prompt_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_runs_parent ON runs_log(parent_run_id)');
  }

  create(run: Omit<RunLog, 'end_time' | 'duration_ms'>): RunLog {
    const stmt = this.db.prepare(`
      INSERT INTO runs_log (
        run_id, trace_id, parent_run_id, prompt_id, status, start_time,
        input_hash, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      run.run_id,
      run.trace_id,
      run.parent_run_id ?? null,
      run.prompt_id ?? null,
      run.status,
      run.start_time,
      run.input_hash ?? null,
      run.metadata_json
    );
    return { ...run, metadata_json: run.metadata_json };
  }

  findByRunId(runId: string): RunLog | undefined {
    const stmt = this.db.prepare('SELECT * FROM runs_log WHERE run_id = ?');
    const row = stmt.get(runId) as Record<string, unknown> | undefined;
    return row ? this.rowToRunLog(row) : undefined;
  }

  findByTraceId(traceId: string): RunLog[] {
    const stmt = this.db.prepare('SELECT * FROM runs_log WHERE trace_id = ? ORDER BY start_time');
    const rows = stmt.all(traceId) as Record<string, unknown>[];
    return rows.map(r => this.rowToRunLog(r));
  }

  updateStatus(
    runId: string,
    status: RunLog['status'],
    updates?: Partial<Pick<RunLog, 'end_time' | 'duration_ms' | 'output_hash' | 'exit_code' | 'error_message'>>
  ): void {
    const fields: string[] = ['status = ?'];
    const params: unknown[] = [status];

    if (updates?.end_time) {
      fields.push('end_time = ?');
      params.push(updates.end_time);
    }
    if (updates?.duration_ms !== undefined) {
      fields.push('duration_ms = ?');
      params.push(updates.duration_ms);
    }
    if (updates?.output_hash) {
      fields.push('output_hash = ?');
      params.push(updates.output_hash);
    }
    if (updates?.exit_code !== undefined) {
      fields.push('exit_code = ?');
      params.push(updates.exit_code);
    }
    if (updates?.error_message) {
      fields.push('error_message = ?');
      params.push(updates.error_message);
    }

    params.push(runId);

    const stmt = this.db.prepare(`UPDATE runs_log SET ${fields.join(', ')} WHERE run_id = ?`);
    stmt.run(...params);
  }

  updateArtifactPath(runId: string, artifactPath: string, manifestPath: string): void {
    const stmt = this.db.prepare('UPDATE runs_log SET artifact_path = ?, manifest_path = ? WHERE run_id = ?');
    stmt.run(artifactPath, manifestPath, runId);
  }

  list(options?: {
    status?: RunLog['status'];
    promptId?: string;
    since?: string;
    limit?: number;
    offset?: number;
  }): RunLog[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options?.promptId) {
      conditions.push('prompt_id = ?');
      params.push(options.promptId);
    }
    if (options?.since) {
      conditions.push('start_time > ?');
      params.push(options.since);
    }

    let sql = 'SELECT * FROM runs_log';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY start_time DESC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(r => this.rowToRunLog(r));
  }

  getRecentRuns(limit: number = 10): RunLog[] {
    return this.list({ limit });
  }

  private rowToRunLog(row: Record<string, unknown>): RunLog {
    return {
      run_id: String(row.run_id),
      trace_id: String(row.trace_id),
      parent_run_id: row.parent_run_id ? String(row.parent_run_id) : undefined,
      prompt_id: row.prompt_id ? String(row.prompt_id) : undefined,
      status: String(row.status) as RunLog['status'],
      start_time: String(row.start_time),
      end_time: row.end_time ? String(row.end_time) : undefined,
      duration_ms: row.duration_ms ? Number(row.duration_ms) : undefined,
      input_hash: row.input_hash ? String(row.input_hash) : undefined,
      output_hash: row.output_hash ? String(row.output_hash) : undefined,
      artifact_path: row.artifact_path ? String(row.artifact_path) : undefined,
      manifest_path: row.manifest_path ? String(row.manifest_path) : undefined,
      metadata_json: String(row.metadata_json ?? '{}'),
      exit_code: row.exit_code !== null && row.exit_code !== undefined ? Number(row.exit_code) : undefined,
      error_message: row.error_message ? String(row.error_message) : undefined,
    };
  }
}

// ─── Repository: Mode Settings ─────────────────────────────────────────────────

export class ModeSettingsRepository {
  private db: DB;

  constructor(db?: DB) {
    this.db = db ?? getDB();
  }

  static initializeTable(db: DB): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mode_settings (
        id TEXT PRIMARY KEY,
        intensity TEXT NOT NULL DEFAULT 'normal',
        thinking_mode TEXT NOT NULL DEFAULT 'balanced',
        tool_policy TEXT NOT NULL DEFAULT 'ask',
        max_iterations INTEGER NOT NULL DEFAULT 10,
        timeout_seconds INTEGER NOT NULL DEFAULT 300,
        updated_at TEXT NOT NULL
      )
    `);

    // Insert default global settings if not exists
    const defaultSettings: ModeSettings = {
      id: 'global',
      intensity: 'normal',
      thinking_mode: 'balanced',
      tool_policy: 'ask',
      max_iterations: 10,
      timeout_seconds: 300,
      updated_at: new Date().toISOString(),
    };

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO mode_settings (id, intensity, thinking_mode, tool_policy, max_iterations, timeout_seconds, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      defaultSettings.id,
      defaultSettings.intensity,
      defaultSettings.thinking_mode,
      defaultSettings.tool_policy,
      defaultSettings.max_iterations,
      defaultSettings.timeout_seconds,
      defaultSettings.updated_at
    );
  }

  get(id: string = 'global'): ModeSettings | undefined {
    const stmt = this.db.prepare('SELECT * FROM mode_settings WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToModeSettings(row) : undefined;
  }

  update(id: string, updates: Partial<Omit<ModeSettings, 'id' | 'updated_at'>>): ModeSettings | undefined {
    const current = this.get(id);
    if (!current) return undefined;

    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [new Date().toISOString()];

    if (updates.intensity) {
      fields.push('intensity = ?');
      params.push(updates.intensity);
    }
    if (updates.thinking_mode) {
      fields.push('thinking_mode = ?');
      params.push(updates.thinking_mode);
    }
    if (updates.tool_policy) {
      fields.push('tool_policy = ?');
      params.push(updates.tool_policy);
    }
    if (updates.max_iterations !== undefined) {
      fields.push('max_iterations = ?');
      params.push(updates.max_iterations);
    }
    if (updates.timeout_seconds !== undefined) {
      fields.push('timeout_seconds = ?');
      params.push(updates.timeout_seconds);
    }

    params.push(id);

    const stmt = this.db.prepare(`UPDATE mode_settings SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.get(id);
  }

  private rowToModeSettings(row: Record<string, unknown>): ModeSettings {
    return {
      id: String(row.id),
      intensity: String(row.intensity) as ModeSettings['intensity'],
      thinking_mode: String(row.thinking_mode) as ModeSettings['thinking_mode'],
      tool_policy: String(row.tool_policy) as ModeSettings['tool_policy'],
      max_iterations: Number(row.max_iterations),
      timeout_seconds: Number(row.timeout_seconds),
      updated_at: String(row.updated_at),
    };
  }
}

// ─── Repository: Provider Configs ───────────────────────────────────────────────

export class ProviderConfigRepository {
  private db: DB;

  constructor(db?: DB) {
    this.db = db ?? getDB();
  }

  static initializeTable(db: DB): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS provider_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        provider_type TEXT NOT NULL,
        base_url TEXT,
        api_key_env_var TEXT,
        default_model TEXT NOT NULL,
        available_models TEXT NOT NULL, -- JSON array
        throttle_rpm INTEGER NOT NULL DEFAULT 60,
        throttle_tpm INTEGER NOT NULL DEFAULT 100000,
        cost_per_1k_input REAL NOT NULL DEFAULT 0,
        cost_per_1k_output REAL NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 100,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_providers_enabled ON provider_configs(enabled)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_providers_priority ON provider_configs(priority)');

    // Insert default providers if table is empty
    const defaults: Array<Omit<ProviderConfig, 'created_at' | 'updated_at'>> = [
      {
        id: 'anthropic',
        name: 'Anthropic',
        provider_type: 'anthropic',
        api_key_env_var: 'ANTHROPIC_API_KEY',
        default_model: 'claude-sonnet-4-5-20251001',
        available_models: [
          'claude-opus-4-5-20251101',
          'claude-sonnet-4-5-20251001',
          'claude-haiku-4-5-20251001',
        ],
        throttle_rpm: 60,
        throttle_tpm: 100000,
        cost_per_1k_input: 0.003,
        cost_per_1k_output: 0.015,
        enabled: true,
        priority: 10,
      },
      {
        id: 'openai',
        name: 'OpenAI',
        provider_type: 'openai',
        api_key_env_var: 'OPENAI_API_KEY',
        default_model: 'gpt-5.2',
        available_models: ['gpt-5.2', 'gpt-5.2-mini', 'gpt-5.2-nano'],
        throttle_rpm: 60,
        throttle_tpm: 150000,
        cost_per_1k_input: 0.005,
        cost_per_1k_output: 0.015,
        enabled: true,
        priority: 20,
      },
      {
        id: 'local',
        name: 'Local/Ollama',
        provider_type: 'local',
        base_url: 'http://localhost:11434',
        default_model: 'llama3.2',
        available_models: ['llama3.2', 'codellama', 'mistral'],
        throttle_rpm: 1000,
        throttle_tpm: 1000000,
        cost_per_1k_input: 0,
        cost_per_1k_output: 0,
        enabled: false,
        priority: 100,
      },
    ];

    for (const provider of defaults) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO provider_configs (
          id, name, provider_type, base_url, api_key_env_var, default_model, available_models,
          throttle_rpm, throttle_tpm, cost_per_1k_input, cost_per_1k_output, enabled, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        provider.id,
        provider.name,
        provider.provider_type,
        provider.base_url ?? null,
        provider.api_key_env_var ?? null,
        provider.default_model,
        JSON.stringify(provider.available_models),
        provider.throttle_rpm,
        provider.throttle_tpm,
        provider.cost_per_1k_input,
        provider.cost_per_1k_output,
        provider.enabled ? 1 : 0,
        provider.priority,
        new Date().toISOString(),
        new Date().toISOString()
      );
    }
  }

  findById(id: string): ProviderConfig | undefined {
    const stmt = this.db.prepare('SELECT * FROM provider_configs WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToProviderConfig(row) : undefined;
  }

  list(enabledOnly: boolean = false): ProviderConfig[] {
    let sql = 'SELECT * FROM provider_configs';
    if (enabledOnly) {
      sql += ' WHERE enabled = 1';
    }
    sql += ' ORDER BY priority ASC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(r => this.rowToProviderConfig(r));
  }

  update(id: string, updates: Partial<Omit<ProviderConfig, 'id' | 'created_at' | 'updated_at'>>): ProviderConfig | undefined {
    const current = this.findById(id);
    if (!current) return undefined;

    const fields: string[] = ['updated_at = ?'];
    const params: unknown[] = [new Date().toISOString()];

    if (updates.name) {
      fields.push('name = ?');
      params.push(updates.name);
    }
    if (updates.default_model) {
      fields.push('default_model = ?');
      params.push(updates.default_model);
    }
    if (updates.available_models) {
      fields.push('available_models = ?');
      params.push(JSON.stringify(updates.available_models));
    }
    if (updates.throttle_rpm !== undefined) {
      fields.push('throttle_rpm = ?');
      params.push(updates.throttle_rpm);
    }
    if (updates.throttle_tpm !== undefined) {
      fields.push('throttle_tpm = ?');
      params.push(updates.throttle_tpm);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      params.push(updates.enabled ? 1 : 0);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      params.push(updates.priority);
    }

    params.push(id);

    const stmt = this.db.prepare(`UPDATE provider_configs SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    return this.findById(id);
  }

  private rowToProviderConfig(row: Record<string, unknown>): ProviderConfig {
    return {
      id: String(row.id),
      name: String(row.name),
      provider_type: String(row.provider_type) as ProviderConfig['provider_type'],
      base_url: row.base_url ? String(row.base_url) : undefined,
      api_key_env_var: row.api_key_env_var ? String(row.api_key_env_var) : undefined,
      default_model: String(row.default_model),
      available_models: JSON.parse(String(row.available_models)),
      throttle_rpm: Number(row.throttle_rpm),
      throttle_tpm: Number(row.throttle_tpm),
      cost_per_1k_input: Number(row.cost_per_1k_input),
      cost_per_1k_output: Number(row.cost_per_1k_output),
      enabled: Boolean(row.enabled),
      priority: Number(row.priority),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }
}

// ─── Initialize All Tables ─────────────────────────────────────────────────────

export function initializeOperatorConsoleTables(db?: DB): void {
  const database = db ?? getDB();
  PromptRepository.initializeTable(database);
  RunLogRepository.initializeTable(database);
  ModeSettingsRepository.initializeTable(database);
  ProviderConfigRepository.initializeTable(database);
}
