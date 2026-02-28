/**
 * @fileoverview Canonical memory store for the AI control-plane.
 *
 * Content is normalized + SHA-256 hashed for deduplication.
 * Tenant-scoped: all reads/writes require tenantId.
 * Dev mode: file-backed store in .data/ai-memory/
 *
 * INVARIANT: Same content always produces same hash.
 * INVARIANT: All memory items are tenant-scoped.
 * INVARIANT: Vectors are INDEX ONLY — canonical source is this store.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { newId, now } from '../types/index';
import { hashContent } from './hashing';
import { redactObject } from './redaction';
import { AiError } from '../errors/AiError';
import { AiErrorCode } from '../errors/codes';
import { logger } from '../telemetry/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryItemMetadata {
  source?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface MemoryItem {
  readonly id: string;
  readonly tenantId: string;
  readonly contentHash: string;
  readonly content: unknown;
  readonly metadata: MemoryItemMetadata;
  readonly createdAt: string;
  /** Optional pointer to vector index */
  readonly vectorPointer?: string;
}

// ─── Memory Store Interface ───────────────────────────────────────────────────

export interface MemoryStore {
  store(tenantId: string, content: unknown, metadata?: MemoryItemMetadata): Promise<MemoryItem>;
  getByHash(tenantId: string, contentHash: string): Promise<MemoryItem | undefined>;
  getById(tenantId: string, id: string): Promise<MemoryItem | undefined>;
  list(tenantId: string, limit?: number): Promise<MemoryItem[]>;
  delete(tenantId: string, id: string): Promise<void>;
}

// ─── File-Backed Dev Store ───────────────────────────────────────────────────

class FileMemoryStore implements MemoryStore {
  private dir: string;

  constructor() {
    this.dir = join(process.cwd(), '.data', 'ai-memory');
  }

  private tenantFile(tenantId: string): string {
    const safeId = tenantId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return join(this.dir, `${safeId}.ndjson`);
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) mkdirSync(this.dir, { recursive: true });
  }

  private loadItems(tenantId: string): MemoryItem[] {
    const file = this.tenantFile(tenantId);
    if (!existsSync(file)) return [];
    try {
      return readFileSync(file, 'utf8')
        .split('\n')
        .filter(l => l.trim())
        .map(l => JSON.parse(l) as MemoryItem);
    } catch {
      return [];
    }
  }

  private appendItem(tenantId: string, item: MemoryItem): void {
    this.ensureDir();
    const file = this.tenantFile(tenantId);
    writeFileSync(file, JSON.stringify(item) + '\n', { flag: 'a' });
  }

  async store(
    tenantId: string,
    content: unknown,
    metadata: MemoryItemMetadata = {}
  ): Promise<MemoryItem> {
    // Redact before hashing/storing
    const redacted = redactObject(content);
    const contentHash = hashContent(redacted);

    // Check for duplicates
    const existing = await this.getByHash(tenantId, contentHash);
    if (existing) {
      logger.debug('[memory] Dedup: content already stored', { hash: contentHash, tenant: tenantId });
      return existing;
    }

    const item: MemoryItem = {
      id: newId('mem'),
      tenantId,
      contentHash,
      content: redacted,
      metadata,
      createdAt: now(),
    };

    this.appendItem(tenantId, item);
    return item;
  }

  async getByHash(tenantId: string, contentHash: string): Promise<MemoryItem | undefined> {
    return this.loadItems(tenantId).find(i => i.contentHash === contentHash);
  }

  async getById(tenantId: string, id: string): Promise<MemoryItem | undefined> {
    return this.loadItems(tenantId).find(i => i.id === id);
  }

  async list(tenantId: string, limit = 100): Promise<MemoryItem[]> {
    return this.loadItems(tenantId).slice(-limit);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const items = this.loadItems(tenantId).filter(i => i.id !== id);
    this.ensureDir();
    const file = this.tenantFile(tenantId);
    writeFileSync(file, items.map(i => JSON.stringify(i)).join('\n') + (items.length ? '\n' : ''), 'utf8');
  }
}

// ─── Global Store ─────────────────────────────────────────────────────────────

let _store: MemoryStore = new FileMemoryStore();

export function setMemoryStore(store: MemoryStore): void {
  _store = store;
}

export function getMemoryStore(): MemoryStore {
  return _store;
}

/**
 * Store a memory item, enforcing tenant isolation.
 */
export async function storeMemoryItem(
  tenantId: string,
  content: unknown,
  metadata?: MemoryItemMetadata
): Promise<MemoryItem> {
  if (!tenantId) {
    throw new AiError({
      code: AiErrorCode.TENANT_REQUIRED,
      message: 'Memory store requires a tenant ID',
      phase: 'memory',
    });
  }
  return _store.store(tenantId, content, metadata);
}

export async function getMemoryItem(tenantId: string, id: string): Promise<MemoryItem | undefined> {
  return _store.getById(tenantId, id);
}

export async function listMemoryItems(tenantId: string, limit?: number): Promise<MemoryItem[]> {
  return _store.list(tenantId, limit);
}
