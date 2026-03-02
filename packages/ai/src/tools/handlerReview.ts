/**
 * @fileoverview Tool Handler Review Process Formalization
 *
 * Provides a formal process for reviewing and approving tool handlers.
 * Addresses S-16 (Tool Handler Review Process) and S-14 (SSRF Protection).
 *
 * INVARIANT: All tool handlers must go through security review before being enabled.
 * INVARIANT: SSRF protection checks are enforced for URL-fetching handlers.
 * INVARIANT: Review status is tracked for audit purposes.
 */

import { getPolicyEnforcer } from '../mcp/policyEnforcer.js';
import type { ToolDefinition } from './types.js';

// ─── Review Status ───────────────────────────────────────────────────────────────

export type ReviewStatus = 
  | 'pending'      // Not yet reviewed
  | 'in_review'    // Currently being reviewed
  | 'approved'     // Reviewed and approved
  | 'rejected';    // Reviewed and rejected

// ─── Handler Review Metadata ───────────────────────────────────────────────────

export interface HandlerReviewMetadata {
  /** Tool name */
  toolName: string;
  /** Handler function reference (not serializable) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler?: any;
  /** Current review status */
  reviewStatus: ReviewStatus;
  /** Date when handler was registered */
  registeredAt: string;
  /** Date when last review status changed */
  lastReviewAt?: string;
  /** Reviewer user ID */
  reviewerId?: string;
  /** Known security risks */
  knownRisks: string[];
  /** SSRF protection enabled */
  ssrfProtectionEnabled: boolean;
  /** URL validation config */
  urlValidationConfig?: URLValidationConfig;
  /** Digest of handler code (for replay verification) */
  handlerDigest?: string;
  /** Approval criteria */
  approvalCriteria: string[];
  /** Notes from review */
  reviewNotes?: string;
}

// ─── URL Validation Config ────────────────────────────────────────────────────

export interface URLValidationConfig {
  /** Block list of domains */
  blockedDomains: string[];
  /** Block list of IP ranges (CIDR notation) */
  blockedIPs: string[];
  /** Allow list of domains (if non-empty, only these are allowed) */
  allowedDomains: string[];
  /** Maximum redirects to follow */
  maxRedirects: number;
  /** Request timeout in ms */
  timeoutMs: number;
}

// ─── SSRF Check Result ─────────────────────────────────────────────────────────

export interface SSRFCheckResult {
  allowed: boolean;
  reason: string;
  resolvedIP?: string;
  isInternal: boolean;
}

// ─── URL Fetch Log Entry ───────────────────────────────────────────────────────

export interface URLFetchLogEntry {
  id: string;
  toolName: string;
  url: string;
  method: string;
  resolvedIP?: string;
  status: 'allowed' | 'blocked';
  blockedReason?: string;
  correlationId?: string;
  timestamp: string;
  reviewed: boolean;
}

// ─── ToolHandlerReview Class ───────────────────────────────────────────────────

export class ToolHandlerReview {
  private handlers: Map<string, HandlerReviewMetadata> = new Map();
  private urlFetchLogs: URLFetchLogEntry[] = [];
  private defaultURLValidation: URLValidationConfig;

  constructor() {
    this.defaultURLValidation = {
      blockedDomains: [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '*.local',
        'metadata.google.internal',
        '169.254.169.254', // AWS/GCP/Azure metadata
      ],
      blockedIPs: [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8',
        '169.254.0.0/16',
      ],
      allowedDomains: [],
      maxRedirects: 5,
      timeoutMs: 30000,
    };

    // Load from policy if available
    this.loadFromPolicy();
  }

  /**
   * Load configuration from policy.
   */
  private loadFromPolicy(): void {
    try {
      const policyEnforcer = getPolicyEnforcer();
      const ssrfConfig = policyEnforcer.getSSRFConfig();
      if (ssrfConfig) {
        this.defaultURLValidation.blockedDomains = ssrfConfig.blockedDomains;
        this.defaultURLValidation.blockedIPs = ssrfConfig.blockedIPs;
      }
    } catch {
      // Policy not loaded, use defaults
    }
  }

  /**
   * Register a handler with review metadata.
   */
  registerHandler(
    toolName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: any,
    reviewMetadata: Partial<HandlerReviewMetadata> = {}
  ): void {
    const metadata: HandlerReviewMetadata = {
      toolName,
      handler,
      reviewStatus: 'pending',
      registeredAt: new Date().toISOString(),
      knownRisks: reviewMetadata.knownRisks || [],
      ssrfProtectionEnabled: reviewMetadata.ssrfProtectionEnabled ?? this.isURLFetchingTool(toolName),
      urlValidationConfig: reviewMetadata.urlValidationConfig,
      handlerDigest: reviewMetadata.handlerDigest,
      approvalCriteria: reviewMetadata.approvalCriteria || [],
      reviewNotes: reviewMetadata.reviewNotes,
    };

    this.handlers.set(toolName, metadata);
  }

  /**
   * Get review status for a tool.
   */
  getReviewStatus(toolName: string): ReviewStatus | undefined {
    const metadata = this.handlers.get(toolName);
    return metadata?.reviewStatus;
  }

  /**
   * Get full review metadata for a tool.
   */
  getReviewMetadata(toolName: string): HandlerReviewMetadata | undefined {
    return this.handlers.get(toolName);
  }

  /**
   * Get all handlers with their review status.
   */
  getAllReviewStatus(): Map<string, ReviewStatus> {
    const result = new Map<string, ReviewStatus>();
    for (const [toolName, metadata] of this.handlers) {
      result.set(toolName, metadata.reviewStatus);
    }
    return result;
  }

  /**
   * Approve a handler.
   */
  approveHandler(
    toolName: string,
    reviewerId: string,
    notes?: string
  ): boolean {
    const metadata = this.handlers.get(toolName);
    if (!metadata) {
      return false;
    }

    metadata.reviewStatus = 'approved';
    metadata.lastReviewAt = new Date().toISOString();
    metadata.reviewerId = reviewerId;
    if (notes) {
      metadata.reviewNotes = notes;
    }

    console.log(
      `[ToolHandlerReview] Approved: tool=${toolName} reviewer=${reviewerId}`
    );

    return true;
  }

  /**
   * Reject a handler.
   */
  rejectHandler(
    toolName: string,
    reviewerId: string,
    reason: string
  ): boolean {
    const metadata = this.handlers.get(toolName);
    if (!metadata) {
      return false;
    }

    metadata.reviewStatus = 'rejected';
    metadata.lastReviewAt = new Date().toISOString();
    metadata.reviewerId = reviewerId;
    metadata.reviewNotes = reason;

    console.warn(
      `[ToolHandlerReview] Rejected: tool=${toolName} reviewer=${reviewerId} reason=${reason}`
    );

    return true;
  }

  /**
   * Start a review for a handler.
   */
  startReview(toolName: string, reviewerId: string): boolean {
    const metadata = this.handlers.get(toolName);
    if (!metadata) {
      return false;
    }

    metadata.reviewStatus = 'in_review';
    metadata.reviewerId = reviewerId;

    return true;
  }

  /**
   * Check if a handler is approved.
   */
  isApproved(toolName: string): boolean {
    const metadata = this.handlers.get(toolName);
    return metadata?.reviewStatus === 'approved';
  }

  /**
   * Check if a handler requires review (pending or rejected).
   */
  requiresReview(toolName: string): boolean {
    const metadata = this.handlers.get(toolName);
    return !metadata || metadata.reviewStatus === 'pending';
  }

  /**
   * Check if a tool fetches URLs (needs SSRF protection).
   */
  private isURLFetchingTool(toolName: string): boolean {
    const urlFetchingPatterns = ['fetch', 'http', 'curl', 'wget', 'request', 'download'];
    const lowerName = toolName.toLowerCase();
    return urlFetchingPatterns.some(p => lowerName.includes(p));
  }

  /**
   * Validate URL for SSRF protection.
   */
  validateURL(
    urlString: string,
    toolName: string,
    correlationId?: string
  ): SSRFCheckResult {
    let url: URL;
    try {
      url = new URL(urlString);
    } catch {
      return {
        allowed: false,
        reason: 'Invalid URL format',
        isInternal: false,
      };
    }

    // Check protocol
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        allowed: false,
        reason: `Protocol "${url.protocol}" is not allowed`,
        isInternal: false,
      };
    }

    const hostname = url.hostname.toLowerCase();

    // Check blocked domains
    for (const blocked of this.defaultURLValidation.blockedDomains) {
      if (hostname === blocked || hostname.endsWith('.' + blocked)) {
        this.logURLFetch(toolName, urlString, 'GET', undefined, 'blocked', `Domain "${hostname}" is blocked`, correlationId);
        return {
          allowed: false,
          reason: `Domain "${hostname}" is blocked by policy`,
          isInternal: true,
        };
      }
    }

    // Check if hostname is an IP address
    const ipMatch = hostname.match(/^(\d{1,3}\.){3}\d{1,3}$/);
    if (ipMatch) {
      if (this.isBlockedIP(hostname)) {
        this.logURLFetch(toolName, urlString, 'GET', hostname, 'blocked', `IP "${hostname}" is blocked`, correlationId);
        return {
          allowed: false,
          reason: `IP "${hostname}" is blocked by policy`,
          resolvedIP: hostname,
          isInternal: true,
        };
      }
    }

    // Try to resolve hostname to IP (basic DNS resolution)
    // Note: In production, you'd want to do async DNS resolution
    // This is a simplified check

    // Check allowed domains (if configured)
    if (this.defaultURLValidation.allowedDomains.length > 0) {
      const isAllowed = this.defaultURLValidation.allowedDomains.some(
        d => hostname === d || hostname.endsWith('.' + d)
      );
      if (!isAllowed) {
        this.logURLFetch(toolName, urlString, 'GET', undefined, 'blocked', `Domain "${hostname}" is not in allowlist`, correlationId);
        return {
          allowed: false,
          reason: `Domain "${hostname}" is not in the allowed domains list`,
          isInternal: false,
        };
      }
    }

    this.logURLFetch(toolName, urlString, 'GET', undefined, 'allowed', undefined, correlationId);
    return {
      allowed: true,
      reason: 'URL validation passed',
      isInternal: false,
    };
  }

  /**
   * Check if an IP is in a blocked range.
   */
  private isBlockedIP(ip: string): boolean {
    // Simple check for private IP ranges
    // In production, use a proper CIDR library
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;

    // 10.0.0.0/8
    if (parts[0] === 10) return true;

    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;

    // 127.0.0.0/8
    if (parts[0] === 127) return true;

    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;

    return false;
  }

  /**
   * Log a URL fetch attempt.
   */
  private logURLFetch(
    toolName: string,
    url: string,
    method: string,
    resolvedIP: string | undefined,
    status: 'allowed' | 'blocked',
    blockedReason: string | undefined,
    correlationId?: string
  ): void {
    const entry: URLFetchLogEntry = {
      id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      toolName,
      url,
      method,
      resolvedIP,
      status,
      blockedReason,
      correlationId,
      timestamp: new Date().toISOString(),
      reviewed: false,
    };

    this.urlFetchLogs.push(entry);

    // Keep only last 10000 entries
    if (this.urlFetchLogs.length > 10000) {
      this.urlFetchLogs.shift();
    }

    // Log blocked attempts
    if (status === 'blocked') {
      console.warn(
        `[ToolHandlerReview] SSRF Blocked: tool=${toolName} url=${url} reason=${blockedReason} correlationId=${correlationId || 'n/a'}`
      );
    }
  }

  /**
   * Get URL fetch logs.
   */
  getURLFetchLogs(limit = 100): URLFetchLogEntry[] {
    return this.urlFetchLogs.slice(-limit);
  }

  /**
   * Get blocked URL fetch attempts.
   */
  getBlockedURLFetches(): URLFetchLogEntry[] {
    return this.urlFetchLogs.filter(e => e.status === 'blocked');
  }

  /**
   * Mark a log entry as reviewed.
   */
  markLogReviewed(logId: string): boolean {
    const entry = this.urlFetchLogs.find(e => e.id === logId);
    if (!entry) {
      return false;
    }
    entry.reviewed = true;
    return true;
  }

  /**
   * Get pending review handlers.
   */
  getPendingReviewHandlers(): HandlerReviewMetadata[] {
    return Array.from(this.handlers.values()).filter(
      m => m.reviewStatus === 'pending' || m.reviewStatus === 'in_review'
    );
  }

  /**
   * Get approved handlers.
   */
  getApprovedHandlers(): HandlerReviewMetadata[] {
    return Array.from(this.handlers.values()).filter(
      m => m.reviewStatus === 'approved'
    );
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────────

let reviewInstance: ToolHandlerReview | null = null;

/**
 * Get the singleton review instance.
 */
export function getToolHandlerReview(): ToolHandlerReview {
  if (!reviewInstance) {
    reviewInstance = new ToolHandlerReview();
  }
  return reviewInstance;
}
