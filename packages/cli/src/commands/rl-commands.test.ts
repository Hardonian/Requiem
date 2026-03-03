/**
 * Tests for ReadyLayer CLI commands
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetDB, getDB } from '../db/connection.js';
import {
  initializeOperatorConsoleTables,
  PromptRepository,
  RunLogRepository,
  ModeSettingsRepository,
  ProviderConfigRepository,
  Prompt,
} from '../db/operator-console.js';
import {
  hashContent,
  shortHash,
  deterministicJson,
  stableSort,
  createSeededRandom,
  normalizeTimestamp,
} from '../lib/deterministic.js';

describe('ReadyLayer CLI', () => {
  beforeEach(() => {
    resetDB();
    initializeOperatorConsoleTables();
  });

  describe('Database Layer', () => {
    describe('PromptRepository', () => {
      it('should create and retrieve a prompt', () => {
        const repo = new PromptRepository();
        const prompt: Omit<Prompt, 'usage_count'> = {
          id: hashContent('test:1.0.0:content'),
          name: 'test',
          version: '1.0.0',
          content: 'Hello {{name}}!',
          description: 'Test prompt',
          tags: ['test', 'example'],
          variables: ['name'],
          created_at: normalizeTimestamp(new Date()),
          updated_at: normalizeTimestamp(new Date()),
        };

        const created = repo.create(prompt);
        expect(created.name).toBe('test');

        const retrieved = repo.findById(prompt.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.content).toBe('Hello {{name}}!');
      });

      it('should find prompts by name', () => {
        const repo = new PromptRepository();
        const prompt: Omit<Prompt, 'usage_count'> = {
          id: hashContent('my-prompt:1.0.0:content'),
          name: 'my-prompt',
          version: '1.0.0',
          content: 'Test content',
          tags: [],
          variables: [],
          created_at: normalizeTimestamp(new Date()),
          updated_at: normalizeTimestamp(new Date()),
        };

        repo.create(prompt);
        const found = repo.findByName('my-prompt');
        expect(found).toBeDefined();
        expect(found?.name).toBe('my-prompt');
      });

      it('should list prompts with filters', () => {
        const repo = new PromptRepository();
        
        repo.create({
          id: hashContent('p1:1.0.0:c1'),
          name: 'p1',
          version: '1.0.0',
          content: 'content 1',
          tags: ['tag1'],
          variables: [],
          created_at: normalizeTimestamp(new Date()),
          updated_at: normalizeTimestamp(new Date()),
        });

        repo.create({
          id: hashContent('p2:1.0.0:c2'),
          name: 'p2',
          version: '1.0.0',
          content: 'content 2',
          tags: ['tag2'],
          variables: [],
          created_at: normalizeTimestamp(new Date()),
          updated_at: normalizeTimestamp(new Date()),
        });

        const all = repo.list();
        expect(all.length).toBe(2);

        const filtered = repo.list({ tag: 'tag1' });
        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('p1');
      });

      it('should track usage count', () => {
        const repo = new PromptRepository();
        const prompt: Omit<Prompt, 'usage_count'> = {
          id: hashContent('usage-test:1.0.0:content'),
          name: 'usage-test',
          version: '1.0.0',
          content: 'Content',
          tags: [],
          variables: [],
          created_at: normalizeTimestamp(new Date()),
          updated_at: normalizeTimestamp(new Date()),
        };

        repo.create(prompt);
        repo.incrementUsage(prompt.id);
        repo.incrementUsage(prompt.id);

        const retrieved = repo.findById(prompt.id);
        expect(retrieved?.usage_count).toBe(2);
      });
    });

    describe('RunLogRepository', () => {
      it('should create and retrieve a run log', () => {
        const repo = new RunLogRepository();
        const runId = 'run_test_123';
        const traceId = 'trace_abc';

        repo.create({
          run_id: runId,
          trace_id: traceId,
          status: 'pending',
          start_time: normalizeTimestamp(new Date()),
          metadata_json: '{}',
        });

        const retrieved = repo.findByRunId(runId);
        expect(retrieved).toBeDefined();
        expect(retrieved?.trace_id).toBe(traceId);
        expect(retrieved?.status).toBe('pending');
      });

      it('should update run status', () => {
        const repo = new RunLogRepository();
        const runId = 'run_test_456';

        repo.create({
          run_id: runId,
          trace_id: 'trace',
          status: 'running',
          start_time: normalizeTimestamp(new Date()),
          metadata_json: '{}',
        });

        repo.updateStatus(runId, 'completed', {
          end_time: normalizeTimestamp(new Date()),
          duration_ms: 1000,
          exit_code: 0,
        });

        const retrieved = repo.findByRunId(runId);
        expect(retrieved?.status).toBe('completed');
        expect(retrieved?.duration_ms).toBe(1000);
        expect(retrieved?.exit_code).toBe(0);
      });

      it('should find runs by trace ID', () => {
        const repo = new RunLogRepository();
        const traceId = 'trace_multi';

        repo.create({
          run_id: 'run_1',
          trace_id: traceId,
          status: 'completed',
          start_time: normalizeTimestamp(new Date()),
          metadata_json: '{}',
        });

        repo.create({
          run_id: 'run_2',
          trace_id: traceId,
          status: 'completed',
          start_time: normalizeTimestamp(new Date()),
          metadata_json: '{}',
        });

        const runs = repo.findByTraceId(traceId);
        expect(runs.length).toBe(2);
      });
    });

    describe('ModeSettingsRepository', () => {
      it('should retrieve default global settings', () => {
        const repo = new ModeSettingsRepository();
        const settings = repo.get('global');

        expect(settings).toBeDefined();
        expect(settings?.id).toBe('global');
        expect(settings?.intensity).toBeDefined();
        expect(settings?.thinking_mode).toBeDefined();
        expect(settings?.tool_policy).toBeDefined();
      });

      it('should update mode settings', () => {
        const repo = new ModeSettingsRepository();
        
        const updated = repo.update('global', {
          intensity: 'aggressive',
          thinking_mode: 'deep',
        });

        expect(updated).toBeDefined();
        expect(updated?.intensity).toBe('aggressive');
        expect(updated?.thinking_mode).toBe('deep');
      });
    });

    describe('ProviderConfigRepository', () => {
      it('should list default providers', () => {
        const repo = new ProviderConfigRepository();
        const providers = repo.list();

        expect(providers.length).toBeGreaterThan(0);
        expect(providers.some(p => p.id === 'anthropic')).toBe(true);
      });

      it('should filter enabled providers', () => {
        const repo = new ProviderConfigRepository();
        const enabled = repo.list(true);

        expect(enabled.every(p => p.enabled)).toBe(true);
      });

      it('should update provider settings', () => {
        const repo = new ProviderConfigRepository();
        
        const updated = repo.update('anthropic', {
          enabled: false,
          throttle_rpm: 30,
        });

        expect(updated).toBeDefined();
        expect(updated?.enabled).toBe(false);
        expect(updated?.throttle_rpm).toBe(30);
      });
    });
  });

  describe('Deterministic Utilities', () => {
    describe('hashContent', () => {
      it('should generate consistent hashes', () => {
        const hash1 = hashContent('test content');
        const hash2 = hashContent('test content');
        expect(hash1).toBe(hash2);
      });

      it('should generate different hashes for different content', () => {
        const hash1 = hashContent('content A');
        const hash2 = hashContent('content B');
        expect(hash1).not.toBe(hash2);
      });

      it('should provide short hash', () => {
        const hash = hashContent('test');
        const short = shortHash('test');
        expect(short).toBe(hash.substring(0, 16));
      });
    });

    describe('deterministicJson', () => {
      it('should produce consistent output regardless of key order', () => {
        const obj1 = { b: 2, a: 1 };
        const obj2 = { a: 1, b: 2 };
        
        expect(deterministicJson(obj1)).toBe(deterministicJson(obj2));
      });

      it('should sort nested objects', () => {
        const obj = { z: { b: 2, a: 1 }, y: 3 };
        const json = deterministicJson(obj);
        expect(json).toContain('"a":1');
        expect(json.indexOf('"a"')).toBeLessThan(json.indexOf('"b"'));
      });
    });

    describe('stableSort', () => {
      it('should sort arrays consistently', () => {
        const arr = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
        const sorted = stableSort(arr, 'name');
        
        expect(sorted[0].name).toBe('Alice');
        expect(sorted[1].name).toBe('Bob');
        expect(sorted[2].name).toBe('Charlie');
      });

      it('should handle empty arrays', () => {
        const sorted = stableSort([], 'name');
        expect(sorted).toEqual([]);
      });
    });

    describe('createSeededRandom', () => {
      it('should produce consistent sequences with same seed', () => {
        const rng1 = createSeededRandom('seed123');
        const rng2 = createSeededRandom('seed123');

        const seq1 = [rng1(), rng1(), rng1()];
        const seq2 = [rng2(), rng2(), rng2()];

        expect(seq1).toEqual(seq2);
      });

      it('should produce different sequences with different seeds', () => {
        const rng1 = createSeededRandom('seed1');
        const rng2 = createSeededRandom('seed2');

        expect(rng1()).not.toBe(rng2());
      });

      it('should generate numbers between 0 and 1', () => {
        const rng = createSeededRandom('test');
        
        for (let i = 0; i < 10; i++) {
          const num = rng();
          expect(num).toBeGreaterThanOrEqual(0);
          expect(num).toBeLessThan(1);
        }
      });
    });

    describe('normalizeTimestamp', () => {
      it('should normalize dates to ISO format', () => {
        const date = new Date('2024-01-15T10:30:00.000Z');
        const normalized = normalizeTimestamp(date);
        
        expect(normalized).toBe('2024-01-15T10:30:00.000Z');
      });

      it('should handle string inputs', () => {
        const normalized = normalizeTimestamp('2024-01-15');
        expect(normalized).toBeDefined();
      });

      it('should handle number inputs', () => {
        const ts = Date.now();
        const normalized = normalizeTimestamp(ts);
        expect(normalized).toBe(new Date(ts).toISOString());
      });
    });
  });
});
