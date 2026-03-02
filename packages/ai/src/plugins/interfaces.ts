/**
 * @fileoverview Typed Plugin Interfaces
 * 
 * Defines the canonical plugin interfaces for the Requiem AI control plane:
 * - LLMProvider: Language model integration
 * - StorageProvider: Data persistence
 * - PolicyProvider: Policy enforcement
 * - TelemetryExporter: Observability export
 * - AuthProvider: Authentication/authorization
 * 
 * All plugins MUST implement these interfaces.
 * Plugins are loaded via config/env.
 */

import type { TraceEvent } from '../telemetry/trace.js';
import type { PolicyCheckResult } from '../mcp/policyEnforcer.js';

// ─── Common Types ───────────────────────────────────────────────────────────

export interface PluginMetadata {
  name: string;
  version: string;
  author?: string;
  description?: string;
}

export interface PluginConfig {
  enabled: boolean;
  priority?: number;
  [key: string]: unknown;
}

export interface PluginContext {
  tenantId?: string;
  traceId?: string;
  runId?: string;
  schemaVersion: number;
}

export type PluginInitResult = { ok: true } | { ok: false; error: string };
export type PluginHealthResult = { healthy: boolean; message?: string };

// ─── LLM Provider ─────────────────────────────────────────────────────────--

export interface LLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  stream?: boolean;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface LLMProvider {
  readonly metadata: PluginMetadata;
  
  initialize(config: PluginConfig): Promise<PluginInitResult>;
  health(): Promise<PluginHealthResult>;
  
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream?(request: LLMRequest): AsyncGenerator<LLMResponse, void, unknown>;
  
  listModels(): Promise<string[]>;
  
  shutdown(): Promise<void>;
}

export interface LLMProviderFactory {
  create(config: PluginConfig): Promise<LLMProvider>;
}

// ─── Storage Provider ───────────────────────────────────────────────────────

export interface StorageRecord {
  id: string;
  data: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface StorageQuery {
  table: string;
  filter?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface StorageProvider {
  readonly metadata: PluginMetadata;
  
  initialize(config: PluginConfig): Promise<PluginInitResult>;
  health(): Promise<PluginHealthResult>;
  
  // CRUD operations
  create(table: string, record: Omit<StorageRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageRecord>;
  read(table: string, id: string): Promise<StorageRecord | null>;
  update(table: string, id: string, data: Partial<StorageRecord>): Promise<StorageRecord>;
  delete(table: string, id: string): Promise<boolean>;
  
  // Query operations
  query(query: StorageQuery): Promise<StorageRecord[]>;
  count(table: string, filter?: Record<string, unknown>): Promise<number>;
  
  // Batch operations
  bulkCreate(table: string, records: Array<Omit<StorageRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<StorageRecord[]>;
  bulkUpdate(table: string, updates: Array<{ id: string; data: Partial<StorageRecord> }>): Promise<StorageRecord[]>;
  
  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  
  shutdown(): Promise<void>;
}

export interface StorageProviderFactory {
  create(config: PluginConfig): Promise<StorageProvider>;
}

// ─── Policy Provider ─────────────────────────────────────────────────────────

export interface PolicyEvaluationContext {
  toolName: string;
  toolDefinition?: unknown;
  input?: unknown;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
}

export interface PolicyProvider {
  readonly metadata: PluginMetadata;
  
  initialize(config: PluginConfig): Promise<PluginInitResult>;
  health(): Promise<PluginHealthResult>;
  
  // Policy evaluation
  evaluate(context: PolicyEvaluationContext): Promise<PolicyCheckResult>;
  
  // Policy management
  loadPolicy(policyId: string): Promise<unknown>;
  listPolicies(): Promise<Array<{ id: string; name: string; version: string }>>;
  
  shutdown(): Promise<void>;
}

export interface PolicyProviderFactory {
  create(config: PluginConfig): Promise<PolicyProvider>;
}

// ─── Telemetry Exporter ─────────────────────────────────────────────────────

export interface TelemetryBatch {
  traceId: string;
  runId?: string;
  tenantId?: string;
  events: TraceEvent[];
  schemaVersion: number;
}

export interface TelemetryExporter {
  readonly metadata: PluginMetadata;
  
  initialize(config: PluginConfig): Promise<PluginInitResult>;
  health(): Promise<PluginHealthResult>;
  
  // Export operations
  exportTrace(batch: TelemetryBatch): Promise<{ success: boolean; exportedCount: number }>;
  exportMetrics?(metrics: Record<string, unknown>): Promise<void>;
  
  // Flush pending exports
  flush(): Promise<void>;
  
  shutdown(): Promise<void>;
}

export interface TelemetryExporterFactory {
  create(config: PluginConfig): Promise<TelemetryExporter>;
}

// ─── Auth Provider ─────────────────────────────────────────────────────────

export interface AuthCredentials {
  type: 'api_key' | 'bearer' | 'basic' | 'oauth';
  credentials: Record<string, string>;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  tenantId?: string;
  permissions?: string[];
  expiresAt?: string;
}

export interface AuthProvider {
  readonly metadata: PluginMetadata;
  
  initialize(config: PluginConfig): Promise<PluginInitResult>;
  health(): Promise<PluginHealthResult>;
  
  // Authentication
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validate(token: string): Promise<AuthResult>;
  refresh?(token: string): Promise<AuthResult>;
  
  // Authorization
  checkPermission(userId: string, permission: string, resource?: unknown): Promise<boolean>;
  
  shutdown(): Promise<void>;
}

export interface AuthProviderFactory {
  create(config: PluginConfig): Promise<AuthProvider>;
}

// ─── Plugin Registry ───────────────────────────────────────────────────────

export interface PluginRegistry {
  registerLLMProvider(name: string, factory: LLMProviderFactory): void;
  registerStorageProvider(name: string, factory: StorageProviderFactory): void;
  registerPolicyProvider(name: string, factory: PolicyProviderFactory): void;
  registerTelemetryExporter(name: string, factory: TelemetryExporterFactory): void;
  registerAuthProvider(name: string, factory: AuthProviderFactory): void;
  
  getLLMProvider(name: string): LLMProviderFactory | undefined;
  getStorageProvider(name: string): StorageProviderFactory | undefined;
  getPolicyProvider(name: string): PolicyProviderFactory | undefined;
  getTelemetryExporter(name: string): TelemetryExporterFactory | undefined;
  getAuthProvider(name: string): AuthProviderFactory | undefined;
  
  listProviders(type: 'llm' | 'storage' | 'policy' | 'telemetry' | 'auth'): string[];
}

// ─── Plugin Manager ───────────────────────────────────────────────────────

export interface PluginManagerConfig {
  pluginDir?: string;
  enabledPlugins?: Record<string, PluginConfig>;
}

export class PluginManager implements PluginRegistry {
  private llmProviders = new Map<string, LLMProviderFactory>();
  private storageProviders = new Map<string, StorageProviderFactory>();
  private policyProviders = new Map<string, PolicyProviderFactory>();
  private telemetryExporters = new Map<string, TelemetryExporterFactory>();
  private authProviders = new Map<string, AuthProviderFactory>();
  
  registerLLMProvider(name: string, factory: LLMProviderFactory): void {
    this.llmProviders.set(name, factory);
  }
  
  registerStorageProvider(name: string, factory: StorageProviderFactory): void {
    this.storageProviders.set(name, factory);
  }
  
  registerPolicyProvider(name: string, factory: PolicyProviderFactory): void {
    this.policyProviders.set(name, factory);
  }
  
  registerTelemetryExporter(name: string, factory: TelemetryExporterFactory): void {
    this.telemetryExporters.set(name, factory);
  }
  
  registerAuthProvider(name: string, factory: AuthProviderFactory): void {
    this.authProviders.set(name, factory);
  }
  
  getLLMProvider(name: string): LLMProviderFactory | undefined {
    return this.llmProviders.get(name);
  }
  
  getStorageProvider(name: string): StorageProviderFactory | undefined {
    return this.storageProviders.get(name);
  }
  
  getPolicyProvider(name: string): PolicyProviderFactory | undefined {
    return this.policyProviders.get(name);
  }
  
  getTelemetryExporter(name: string): TelemetryExporterFactory | undefined {
    return this.telemetryExporters.get(name);
  }
  
  getAuthProvider(name: string): AuthProviderFactory | undefined {
    return this.authProviders.get(name);
  }
  
  listProviders(type: 'llm' | 'storage' | 'policy' | 'telemetry' | 'auth'): string[] {
    switch (type) {
      case 'llm': return Array.from(this.llmProviders.keys());
      case 'storage': return Array.from(this.storageProviders.keys());
      case 'policy': return Array.from(this.policyProviders.keys());
      case 'telemetry': return Array.from(this.telemetryExporters.keys());
      case 'auth': return Array.from(this.authProviders.keys());
    }
  }
}

// Singleton instance
let pluginManagerInstance: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new PluginManager();
  }
  return pluginManagerInstance;
}

export function resetPluginManager(): void {
  pluginManagerInstance = null;
}

export default {
  PluginManager,
  getPluginManager,
  resetPluginManager,
};
