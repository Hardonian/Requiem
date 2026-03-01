/**
 * @fileoverview Tests for ReplayCache.
 *
 * C-13: Replay duplication — retried tool calls generate duplicate decision records
 * I-MCP-6: Add version and digest to ToolDefinition for replayer consistency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReplayCache, getReplayCache, setReplayCache, isCacheable, createReplayKey } from '../replayCache';

describe('ReplayCache', () => {
  let cache: ReplayCache;

  beforeEach(() => {
    cache = new ReplayCache({ maxEntries: 100, maxAgeMs: 60000, enabled: true });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same input', () => {
      const key1 = cache.generateKey('testTool', { foo: 'bar' });
      const key2 = cache.generateKey('testTool', { foo: 'bar' });
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.generateKey('testTool', { foo: 'bar' });
      const key2 = cache.generateKey('testTool', { foo: 'baz' });
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different tools', () => {
      const key1 = cache.generateKey('toolA', { foo: 'bar' });
      const key2 = cache.generateKey('toolB', { foo: 'bar' });
      expect(key1).not.toBe(key2);
    });
  });

  describe('isCacheable', () => {
    it('should return true when deterministic is true', () => {
      expect(isCacheable(true)).toBe(true);
    });

    it('should return false when deterministic is false', () => {
      expect(isCacheable(false)).toBe(false);
    });

    it('should return false when deterministic is undefined', () => {
      expect(isCacheable(undefined)).toBe(false);
    });
  });

  describe('set and get', () => {
    it('should store and retrieve cached results', () => {
      const toolName = 'readFile';
      const input = { path: '/test.txt' };
      const output = { content: 'file content' };
      const digest = 'abc123';
      const latencyMs = 100;

      cache.set(toolName, input, output, digest, latencyMs);

      const lookup = cache.get(toolName, input);
      expect(lookup.found).toBe(true);
      expect(lookup.result?.output).toEqual(output);
      expect(lookup.result?.digest).toBe(digest);
      expect(lookup.result?.latencyMs).toBe(latencyMs);
    });

    it('should return not found for non-existent entry', () => {
      const lookup = cache.get('nonexistent', {});
      expect(lookup.found).toBe(false);
    });

    it('should return stale when digest changed', () => {
      const toolName = 'readFile';
      const input = { path: '/test.txt' };

      cache.set(toolName, input, { content: 'old' }, 'old-digest', 100);

      // Verify with different digest should return stale
      const key = cache.generateKey(toolName, input);
      const isValid = cache.verify(key, 'new-digest');
      expect(isValid).toBe(false);
    });
  });

  describe('verify', () => {
    it('should verify matching digest', () => {
      const toolName = 'readFile';
      const input = { path: '/test.txt' };
      const digest = 'abc123';

      cache.set(toolName, input, { content: 'test' }, digest, 100);

      const key = cache.generateKey(toolName, input);
      expect(cache.verify(key, digest)).toBe(true);
    });

    it('should reject mismatched digest', () => {
      const toolName = 'readFile';
      const input = { path: '/test.txt' };

      cache.set(toolName, input, { content: 'test' }, 'original-digest', 100);

      const key = cache.generateKey(toolName, input);
      expect(cache.verify(key, 'different-digest')).toBe(false);
    });

    it('should return true for entries without digest (backwards compat)', () => {
      const toolName = 'readFile';
      const input = { path: '/test.txt' };

      // Manually set entry without digest
      cache.setWithKey(
        cache.generateKey(toolName, input),
        { content: 'test' },
        '', // Empty digest
        100
      );

      const key = cache.generateKey(toolName, input);
      expect(cache.verify(key, 'any-digest')).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should invalidate specific entry', () => {
      const toolName = 'readFile';
      const input = { path: '/test.txt' };

      cache.set(toolName, input, { content: 'test' }, 'digest', 100);
      cache.invalidate(toolName, input);

      const lookup = cache.get(toolName, input);
      expect(lookup.found).toBe(false);
    });

    it('should invalidate all entries for a tool', () => {
      cache.set('toolA', { a: 1 }, { out: 1 }, 'd1', 100);
      cache.set('toolA', { b: 2 }, { out: 2 }, 'd2', 100);
      cache.set('toolB', { c: 3 }, { out: 3 }, 'd3', 100);

      cache.invalidateTool('toolA');

      expect(cache.get('toolA', { a: 1 }).found).toBe(false);
      expect(cache.get('toolA', { b: 2 }).found).toBe(false);
      expect(cache.get('toolB', { c: 3 }).found).toBe(true);
    });

    it('should clear all entries', () => {
      cache.set('toolA', { a: 1 }, { out: 1 }, 'd1', 100);
      cache.set('toolB', { b: 2 }, { out: 2 }, 'd2', 100);

      cache.clear();

      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('createReplayKey', () => {
    it('should create replay key with traceId', () => {
      const key = createReplayKey('readFile', { path: '/test.txt' }, 'trace-123');
      expect(key).toContain('trace-123');
      expect(key).toContain('readFile');
    });
  });

  describe('disabled cache', () => {
    it('should not store when disabled', () => {
      const disabledCache = new ReplayCache({ enabled: false });
      disabledCache.set('tool', { x: 1 }, { out: 1 }, 'd', 100);

      const lookup = disabledCache.get('tool', { x: 1 });
      expect(lookup.found).toBe(false);
    });

    it('should not retrieve when disabled', () => {
      const disabledCache = new ReplayCache({ enabled: false });
      const lookup = disabledCache.get('tool', { x: 1 });
      expect(lookup.found).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().enabled).toBe(true);
      expect(cache.getStats().maxEntries).toBe(100);

      cache.set('tool', { x: 1 }, { out: 1 }, 'd', 100);
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('singleton', () => {
    it('should return singleton instance', () => {
      const cache1 = getReplayCache();
      const cache2 = getReplayCache();
      expect(cache1).toBe(cache2);
    });

    it('should allow setting custom instance', () => {
      const customCache = new ReplayCache({ maxEntries: 50 });
      setReplayCache(customCache);

      const cache = getReplayCache();
      expect(cache.getStats().maxEntries).toBe(50);

      // Reset to default
      setReplayCache(new ReplayCache());
    });
  });
});
