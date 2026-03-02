/**
 * @fileoverview LLM Output Filtering for Prompt Injection Detection
 *
 * Detects and filters common prompt injection patterns in LLM outputs.
 * Addresses T6 (Prompt Injection) from the threat model.
 *
 * INVARIANT: All LLM outputs MUST be filtered before returning to client.
 * INVARIANT: Suspicious outputs are logged for audit and optionally quarantined.
 * INVARIANT: Filter is configurable via policy rules.
 */

import { getPolicyEnforcer } from '../mcp/policyEnforcer.js';

// ─── Detection Result ───────────────────────────────────────────────────────────

export interface InjectionDetectionResult {
  /** Whether an injection pattern was detected */
  detected: boolean;
  /** The matched pattern (if detected) */
  matchedPattern?: string;
  /** Matched pattern index */
  matchedIndex?: number;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
  /** Description of the detection */
  reason: string;
}

// ─── Quarantine Record ─────────────────────────────────────────────────────────

export interface QuarantineRecord {
  /** Unique identifier for the quarantined output */
  id: string;
  /** Original output content */
  originalContent: string;
  /** Filtered/replaced content */
  filteredContent: string;
  /** Matched injection patterns */
  matchedPatterns: string[];
  /** Timestamp of detection */
  detectedAt: string;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** Whether the output has been reviewed */
  reviewed: boolean;
  /** Review decision */
  reviewDecision?: 'approved' | 'rejected';
  /** Reviewer ID */
  reviewerId?: string;
  /** Review timestamp */
  reviewedAt?: string;
}

// ─── PromptInjectionFilter Class ─────────────────────────────────────────────

export class PromptInjectionFilter {
  private blocklist: string[] = [];
  private quarantineThreshold: number = 3;
  private quarantineStore: Map<string, QuarantineRecord> = new Map();
  private detectionLog: Array<{
    timestamp: string;
    pattern: string;
    correlationId?: string;
  }> = [];

  /**
   * Create a new PromptInjectionFilter.
   * Loads configuration from policy if available.
   */
  constructor() {
    this.loadFromPolicy();
  }

  /**
   * Load configuration from policy.
   */
  private loadFromPolicy(): void {
    try {
      const policyEnforcer = getPolicyEnforcer();
      const config = policyEnforcer.getPromptInjectionConfig();
      if (config) {
        this.blocklist = config.blocklist;
        this.quarantineThreshold = config.quarantineThreshold;
      }
    } catch {
      // Policy not loaded yet, use defaults
      this.setDefaultBlocklist();
    }
  }

  /**
   * Set default blocklist of injection patterns.
   */
  private setDefaultBlocklist(): void {
    this.blocklist = [
      'ignore previous instructions',
      'ignore all previous instructions',
      'you are now',
      'from now on',
      'ANSWER:',
      '<|user|>',
      '<|system|>',
      '### Instruction',
      '### User',
      'deviate from',
      'disregard your',
      'new system prompt',
      'override your',
      'ignore previous',
      'forget your instructions',
      'act as if',
      'pretend that',
      'if you understand',
      'respond with',
      'output the following',
      'print:',
      'say:',
      'now say',
      'disregard',
      'negligence',
      'jailbreak',
      'bypass',
      'roleplay',
      'new personality',
    ];
  }

  /**
   * Get the current blocklist.
   */
  getBlocklist(): string[] {
    return [...this.blocklist];
  }

  /**
   * Add a pattern to the blocklist.
   */
  addPattern(pattern: string): void {
    const normalized = pattern.toLowerCase().trim();
    if (!this.blocklist.includes(normalized)) {
      this.blocklist.push(normalized);
    }
  }

  /**
   * Remove a pattern from the blocklist.
   */
  removePattern(pattern: string): void {
    const normalized = pattern.toLowerCase().trim();
    this.blocklist = this.blocklist.filter(p => p !== normalized);
  }

  /**
   * Filter output for prompt injection patterns.
   *
   * @param content - LLM output content to filter
   * @param correlationId - Optional correlation ID for tracing
   * @returns Filtered content with detected patterns replaced
   */
  filter(content: string, correlationId?: string): string {
    const detection = this.detect(content);

    if (!detection.detected) {
      return content;
    }

    // Log the detection
    this.logDetection(detection, correlationId);

    // Replace detected patterns with [FILTERED] placeholder
    let filtered = content;
    for (const pattern of this.blocklist) {
      const regex = new RegExp(this.escapeRegex(pattern), 'gi');
      filtered = filtered.replace(regex, '[FILTERED]');
    }

    // Optionally quarantine if multiple patterns detected
    const detectionCount = this.countDetections(content);
    if (detectionCount >= this.quarantineThreshold) {
      this.quarantine(content, filtered, detection, correlationId);
    }

    return filtered;
  }

  /**
   * Detect prompt injection patterns in content.
   *
   * @param content - Content to check
   * @returns Detection result
   */
  detect(content: string): InjectionDetectionResult {
    const lowerContent = content.toLowerCase();
    let matchedIndex = -1;
    let matchedPattern: string | undefined;

    for (let i = 0; i < this.blocklist.length; i++) {
      const pattern = this.blocklist[i];
      if (lowerContent.includes(pattern)) {
        matchedIndex = i;
        matchedPattern = pattern;
        break;
      }
    }

    if (matchedIndex === -1) {
      return {
        detected: false,
        confidence: 'low',
        reason: 'No injection patterns detected',
      };
    }

    // Determine confidence based on pattern type
    let confidence: 'low' | 'medium' | 'high' = 'medium';
    const highConfidencePatterns = [
      'ignore previous instructions',
      'ignore all previous instructions',
      'you are now',
      'from now on',
      'new system prompt',
      'override your',
    ];

    if (matchedPattern && highConfidencePatterns.some(p => matchedPattern!.toLowerCase().includes(p))) {
      confidence = 'high';
    }

    return {
      detected: true,
      matchedPattern,
      matchedIndex,
      confidence,
      reason: `Detected prompt injection pattern: "${matchedPattern}"`,
    };
  }

  /**
   * Count how many patterns were detected in content.
   */
  private countDetections(content: string): number {
    const lowerContent = content.toLowerCase();
    let count = 0;
    for (const pattern of this.blocklist) {
      if (lowerContent.includes(pattern)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Quarantine a suspicious output for review.
   */
  private quarantine(
    original: string,
    filtered: string,
    detection: InjectionDetectionResult,
    correlationId?: string
  ): void {
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const record: QuarantineRecord = {
      id,
      originalContent: original,
      filteredContent: filtered,
      matchedPatterns: detection.matchedPattern ? [detection.matchedPattern] : [],
      detectedAt: new Date().toISOString(),
      correlationId,
      reviewed: false,
    };

    this.quarantineStore.set(id, record);

    // Keep only last 1000 quarantine records
    if (this.quarantineStore.size > 1000) {
      const firstKey = this.quarantineStore.keys().next().value;
      if (firstKey) {
        this.quarantineStore.delete(firstKey);
      }
    }

    console.warn(
      `[PromptInjectionFilter] Quarantined output: id=${id} patterns=${record.matchedPatterns.join(', ')} correlationId=${correlationId || 'n/a'}`
    );
  }

  /**
   * Log a detection event.
   */
  private logDetection(
    detection: InjectionDetectionResult,
    correlationId?: string
  ): void {
    this.detectionLog.push({
      timestamp: new Date().toISOString(),
      pattern: detection.matchedPattern || 'unknown',
      correlationId,
    });

    // Keep only last 10000 log entries
    if (this.detectionLog.length > 10000) {
      this.detectionLog.shift();
    }

    // Log high-confidence detections
    if (detection.confidence === 'high') {
      console.warn(
        `[PromptInjectionFilter] HIGH CONFIDENCE: ${detection.reason} correlationId=${correlationId || 'n/a'}`
      );
    }
  }

  /**
   * Get detection log (for audit).
   */
  getDetectionLog(limit = 100): Array<{
    timestamp: string;
    pattern: string;
    correlationId?: string;
  }> {
    return this.detectionLog.slice(-limit);
  }

  /**
   * Get a quarantined record by ID.
   */
  getQuarantineRecord(id: string): QuarantineRecord | undefined {
    return this.quarantineStore.get(id);
  }

  /**
   * Review a quarantined record.
   */
  reviewQuarantineRecord(
    id: string,
    decision: 'approved' | 'rejected',
    reviewerId: string
  ): boolean {
    const record = this.quarantineStore.get(id);
    if (!record) {
      return false;
    }

    record.reviewed = true;
    record.reviewDecision = decision;
    record.reviewerId = reviewerId;
    record.reviewedAt = new Date().toISOString();

    return true;
  }

  /**
   * Get all pending quarantine records.
   */
  getPendingQuarantine(): QuarantineRecord[] {
    return Array.from(this.quarantineStore.values()).filter(r => !r.reviewed);
  }

  /**
   * Escape special regex characters in a string.
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────────

let filterInstance: PromptInjectionFilter | null = null;

/**
 * Get the singleton filter instance.
 */
export function getPromptInjectionFilter(): PromptInjectionFilter {
  if (!filterInstance) {
    filterInstance = new PromptInjectionFilter();
  }
  return filterInstance;
}

/**
 * Filter LLM output for prompt injection (convenience function).
 */
export function filterLLMOutput(content: string, correlationId?: string): string {
  return getPromptInjectionFilter().filter(content, correlationId);
}

/**
 * Detect prompt injection in LLM output (convenience function).
 */
export function detectPromptInjection(content: string): InjectionDetectionResult {
  return getPromptInjectionFilter().detect(content);
}
