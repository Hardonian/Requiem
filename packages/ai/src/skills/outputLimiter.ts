/**
 * @fileoverview Tool output size limiter for preventing OOM from unbounded tool output.
 *
 * S-10: Unbounded tool output can OOM the orchestrator
 * C-14: Unbounded trigger_data parsing — no size limits
 *
 * INVARIANT: All tool outputs MUST be checked against size limits before returning.
 * INVARIANT: trigger_data parsing MUST enforce size limits.
 */

import { AiError } from '../errors/AiError.js';
import { AiErrorCode } from '../errors/codes.js';
import { logger } from '../telemetry/logger.js';

/**
 * Default maximum output size in bytes (1MB)
 */
export const DEFAULT_OUTPUT_MAX_BYTES = 1024 * 1024;

/**
 * Default maximum trigger_data size in bytes (256KB)
 */
export const DEFAULT_TRIGGER_DATA_MAX_BYTES = 256 * 1024;

/**
 * Environment variable names for configuration
 */
export const OUTPUT_LIMIT_ENV_VARS = {
  TOOL_OUTPUT_MAX_BYTES: 'REQUIEM_TOOL_OUTPUT_MAX_BYTES',
  TRIGGER_DATA_MAX_BYTES: 'REQUIEM_TRIGGER_DATA_MAX_BYTES',
} as const;

/**
 * Result of output size check
 */
export interface OutputSizeCheckResult {
  /** Whether the output is within limits */
  withinLimits: boolean;
  /** Size of the output in bytes */
  sizeBytes: number;
  /** Maximum allowed size in bytes */
  maxBytes: number;
  /** Whether the output was truncated */
  truncated: boolean;
  /** Original output (may be truncated) */
  output: unknown;
}

/**
 * Configuration for OutputSizeLimiter
 */
export interface OutputLimiterConfig {
  /** Maximum allowed output size in bytes */
  maxBytes: number;
  /** Whether to truncate output that exceeds limits instead of throwing */
  truncateOnExceed: boolean;
  /** Logger for warnings */
  onWarning?: (message: string, details: Record<string, unknown>) => void;
}

/**
 * Tool output size limiter.
 * Prevents OOM from unbounded tool output (S-10) and trigger_data parsing (C-14).
 */
export class OutputSizeLimiter {
  private readonly maxBytes: number;
  private readonly truncateOnExceed: boolean;
  private readonly onWarning: (message: string, details: Record<string, unknown>) => void;

  constructor(config: Partial<OutputLimiterConfig> = {}) {
    // Allow override from environment variable
    const envMaxBytes = process.env[OUTPUT_LIMIT_ENV_VARS.TOOL_OUTPUT_MAX_BYTES];
    this.maxBytes = config.maxBytes ??
      (envMaxBytes ? parseInt(envMaxBytes, 10) : DEFAULT_OUTPUT_MAX_BYTES);
    this.truncateOnExceed = config.truncateOnExceed ?? false;
    this.onWarning = config.onWarning ?? ((msg, details) => logger.warn(msg, details));
  }

  /**
   * Get the configured max bytes limit
   */
  getMaxBytes(): number {
    return this.maxBytes;
  }

  /**
   * Calculate byte size of a value (handles strings, objects, buffers)
   */
  calculateBytes(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'string') {
      return new TextEncoder().encode(value).length;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).length;
    }

    if (Buffer.isBuffer(value)) {
      return value.length;
    }

    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.calculateBytes(item), 0);
    }

    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      return new TextEncoder().encode(str).length;
    }

    return 0;
  }

  /**
   * Check output size and optionally truncate
   * @throws AiError with TOOL_OUTPUT_TOO_LARGE if exceeds limit and not truncating
   */
  check(result: unknown): OutputSizeCheckResult {
    const sizeBytes = this.calculateBytes(result);

    if (sizeBytes <= this.maxBytes) {
      return {
        withinLimits: true,
        sizeBytes,
        maxBytes: this.maxBytes,
        truncated: false,
        output: result,
      };
    }

    // Output exceeds limit
    if (this.truncateOnExceed) {
      const truncatedOutput = this.truncate(result);
      const truncatedSize = this.calculateBytes(truncatedOutput);

      this.onWarning('[outputLimiter] Output truncated', {
        originalSize: sizeBytes,
        truncatedSize,
        maxBytes: this.maxBytes,
      });

      return {
        withinLimits: truncatedSize <= this.maxBytes,
        sizeBytes: truncatedSize,
        maxBytes: this.maxBytes,
        truncated: true,
        output: truncatedOutput,
      };
    }

    // Throw error when not truncating
    throw new AiError({
      code: AiErrorCode.TOOL_OUTPUT_TOO_LARGE,
      message: `Tool output exceeds maximum size of ${this.maxBytes} bytes (got ${sizeBytes} bytes)`,
      phase: 'outputLimiter',
      meta: {
        sizeBytes,
        maxBytes: this.maxBytes,
      },
    });
  }

  /**
   * Truncate output to fit within maxBytes
   * Adds a truncation notice to help users understand the output was cut
   */
  private truncate(value: unknown): unknown {
    if (typeof value === 'string') {
      // Reserve space for truncation notice
      const notice = '\n\n[... output truncated due to size limits ...]';
      const noticeBytes = new TextEncoder().encode(notice).length;
      const availableBytes = this.maxBytes - noticeBytes;

      if (availableBytes <= 0) {
        return notice;
      }

      // Binary search for the right truncation point
      const encoder = new TextEncoder();
      let low = 0;
      let high = value.length;

      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        const encoded = encoder.encode(value.slice(0, mid));
        if (encoded.length <= availableBytes) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }

      return value.slice(0, low) + notice;
    }

    if (typeof value === 'object' && value !== null) {
      // For objects, try to truncate arrays or reduce nested content
      if (Array.isArray(value)) {
        const notice = { __truncated: true, __notice: 'Array truncated due to size limits' };
        const availableBytes = this.maxBytes - this.calculateBytes(notice);
        let currentBytes = 0;
        const result: unknown[] = [];

        for (const item of value) {
          const itemBytes = this.calculateBytes(item);
          if (currentBytes + itemBytes <= availableBytes) {
            result.push(item);
            currentBytes += itemBytes;
          } else {
            result.push(notice);
            break;
          }
        }

        return result;
      }

      // For plain objects, truncate string values
      const truncated: Record<string, unknown> = {};
      const notice = { __truncated: true, __notice: 'Object truncated due to size limits' };
      const availableBytes = this.maxBytes - this.calculateBytes(notice);
      let currentBytes = 0;

      for (const [key, val] of Object.entries(value)) {
        const valBytes = this.calculateBytes(val);
        if (currentBytes + valBytes <= availableBytes) {
          truncated[key] = val;
          currentBytes += valBytes;
        } else {
          truncated[key] = '[... truncated ...]';
          break;
        }
      }

      return truncated;
    }

    // For other types, just return a notice
    return { __truncated: true, __notice: 'Output truncated due to size limits', __originalType: typeof value };
  }
}

/**
 * Singleton instance of OutputSizeLimiter
 */
let _outputLimiter: OutputSizeLimiter | null = null;

export function getOutputLimiter(): OutputSizeLimiter {
  if (!_outputLimiter) {
    _outputLimiter = new OutputSizeLimiter();
  }
  return _outputLimiter;
}

export function setOutputLimiter(limiter: OutputSizeLimiter): void {
  _outputLimiter = limiter;
}

/**
 * Parse trigger_data with size limits (C-14)
 * @throws AiError with TRIGGER_DATA_TOO_LARGE if exceeds limit
 */
export function parseTriggerDataWithLimit(triggerData: string): unknown {
  const envMaxBytes = process.env[OUTPUT_LIMIT_ENV_VARS.TRIGGER_DATA_MAX_BYTES];
  const maxBytes = envMaxBytes ? parseInt(envMaxBytes, 10) : DEFAULT_TRIGGER_DATA_MAX_BYTES;

  const sizeBytes = new TextEncoder().encode(triggerData).length;

  if (sizeBytes > maxBytes) {
    throw new AiError({
      code: AiErrorCode.TRIGGER_DATA_TOO_LARGE,
      message: `trigger_data exceeds maximum size of ${maxBytes} bytes (got ${sizeBytes} bytes)`,
      phase: 'triggerDataParser',
      meta: {
        sizeBytes,
        maxBytes,
      },
    });
  }

  try {
    return JSON.parse(triggerData);
  } catch (e) {
    throw new AiError({
      code: AiErrorCode.TOOL_SCHEMA_VIOLATION,
      message: `Failed to parse trigger_data as JSON: ${e instanceof Error ? e.message : 'Unknown error'}`,
      phase: 'triggerDataParser',
    });
  }
}
