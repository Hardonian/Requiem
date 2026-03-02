/**
 * @fileoverview Tests for OutputSizeLimiter and related functionality.
 *
 * S-10: Unbounded tool output can OOM the orchestrator
 * C-14: Unbounded trigger_data parsing — no size limits
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OutputSizeLimiter, getOutputLimiter, setOutputLimiter, parseTriggerDataWithLimit, DEFAULT_OUTPUT_MAX_BYTES, DEFAULT_TRIGGER_DATA_MAX_BYTES } from '../outputLimiter.js';
import { AiErrorCode } from '../../errors/codes.js';

describe('OutputSizeLimiter', () => {
  describe('calculateBytes', () => {
    it('should calculate bytes for string', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000 });
      expect(limiter.calculateBytes('hello')).toBe(5);
      expect(limiter.calculateBytes('hello world')).toBe(11);
    });

    it('should calculate bytes for object', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000 });
      const bytes = limiter.calculateBytes({ foo: 'bar' });
      expect(bytes).toBeGreaterThan(0);
    });

    it('should calculate bytes for array', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000 });
      const bytes = limiter.calculateBytes([1, 2, 3, 4, 5]);
      expect(bytes).toBeGreaterThan(0);
    });

    it('should return 0 for null/undefined', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000 });
      expect(limiter.calculateBytes(null)).toBe(0);
      expect(limiter.calculateBytes(undefined)).toBe(0);
    });
  });

  describe('check', () => {
    it('should pass when under limit', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000, truncateOnExceed: false });
      const result = limiter.check('hello world');
      
      expect(result.withinLimits).toBe(true);
      expect(result.truncated).toBe(false);
      expect(result.output).toBe('hello world');
    });

    it('should throw when over limit and not truncating', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 5, truncateOnExceed: false });
      
      expect(() => limiter.check('hello world')).toThrow();
    });

    it('should truncate when enabled', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 10, truncateOnExceed: true });
      const result = limiter.check('hello world very long string');
      
      expect(result.withinLimits).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.sizeBytes).toBeLessThanOrEqual(10);
    });

    it('should handle object output', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000 });
      const obj = { key: 'value', nested: { data: 'test' } };
      const result = limiter.check(obj);
      
      expect(result.withinLimits).toBe(true);
      expect(result.output).toEqual(obj);
    });

    it('should handle array output', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 1000 });
      const arr = [1, 2, 3, 4, 5];
      const result = limiter.check(arr);
      
      expect(result.withinLimits).toBe(true);
      expect(result.output).toEqual(arr);
    });
  });

  describe('getMaxBytes', () => {
    it('should return configured max', () => {
      const limiter = new OutputSizeLimiter({ maxBytes: 500 });
      expect(limiter.getMaxBytes()).toBe(500);
    });

    it('should return default when not configured', () => {
      const limiter = new OutputSizeLimiter();
      expect(limiter.getMaxBytes()).toBe(DEFAULT_OUTPUT_MAX_BYTES);
    });
  });

  describe('singleton', () => {
    it('should return singleton instance', () => {
      const limiter1 = getOutputLimiter();
      const limiter2 = getOutputLimiter();
      expect(limiter1).toBe(limiter2);
    });

    it('should allow setting custom instance', () => {
      const customLimiter = new OutputSizeLimiter({ maxBytes: 100 });
      setOutputLimiter(customLimiter);
      
      const limiter = getOutputLimiter();
      expect(limiter.getMaxBytes()).toBe(100);
      
      // Reset to default
      setOutputLimiter(new OutputSizeLimiter());
    });
  });
});

describe('parseTriggerDataWithLimit', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('should parse valid JSON within limit', () => {
    const data = JSON.stringify({ key: 'value' });
    const result = parseTriggerDataWithLimit(data);
    expect(result).toEqual({ key: 'value' });
  });

  it('should throw when data exceeds default limit', () => {
    const largeData = 'x'.repeat(DEFAULT_TRIGGER_DATA_MAX_BYTES + 1);
    
    expect(() => parseTriggerDataWithLimit(largeData)).toThrow(AiErrorCode.TRIGGER_DATA_TOO_LARGE);
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseTriggerDataWithLimit('not valid json')).toThrow();
  });

  it('should respect custom limit from env', () => {
    process.env.REQUIEM_TRIGGER_DATA_MAX_BYTES = '100';
    const data = 'x'.repeat(101);
    
    expect(() => parseTriggerDataWithLimit(data)).toThrow(AiErrorCode.TRIGGER_DATA_TOO_LARGE);
  });
});
