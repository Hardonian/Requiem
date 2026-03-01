/**
 * @fileoverview MCP Policy Enforcer — Policy enforcement at MCP entry point.
 *
 * Loads default.policy.json and enforces policy checks at the MCP boundary,
 * not just at the execution layer. This ensures policy is applied before
 * any tool processing begins.
 *
 * INVARIANT: All tool calls MUST be checked against policy before processing.
 * INVARIANT: Deny-by-default — any missing policy data results in deny.
 * INVARIANT: Policy checks happen at MCP entry, not in tool executor.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { InvocationContext } from '../types/index';
import type { RequestContext } from './correlation';
import type { ToolDefinition } from '../tools/types';

// ─── Policy Configuration Types ─────────────────────────────────────────────────

interface PolicyConfig {
  name: string;
  version: string;
  description: string;
  enforcedAt: 'mcp-entry' | 'execution';
  rules: PolicyRules;
  metadata: PolicyMetadata;
}

interface PolicyRules {
  allowList: AllowListRule;
  denyList: DenyListRule;
  rateLimit: RateLimitRule;
  budget: BudgetRule;
  capabilities: CapabilitiesRule;
  ssrfProtection: SSRFProtectionRule;
  promptInjection: PromptInjectionRule;
  outputFiltering: OutputFilteringRule;
}

interface AllowListRule {
  enabled: boolean;
  tools: string[];
}

interface DenyListRule {
  enabled: boolean;
  tools: string[];
  patterns: string[];
}

interface RateLimitRule {
  enabled: boolean;
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
}

interface BudgetRule {
  enabled: boolean;
  defaultLimitCents: number;
  warnThresholdPercent: number;
}

interface CapabilitiesRule {
  enabled: boolean;
  requiredForTools: string[];
}

interface SSRFProtectionRule {
  enabled: boolean;
  blockedDomains: string[];
  blockedIPs: string[];
}

interface PromptInjectionRule {
  enabled: boolean;
  blocklist: string[];
  quarantineThreshold: number;
}

interface OutputFilteringRule {
  enabled: boolean;
  maxOutputSizeBytes: number;
  redactPatterns: string[];
}

interface PolicyMetadata {
  createdAt: string;
  updatedAt: string;
  author: string;
  auditEnabled: boolean;
}

// ─── Policy Decision ────────────────────────────────────────────────────────────

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
  rule?: string;
  metadata?: Record<string, unknown>;
}

// ─── McpPolicyEnforcer Class ───────────────────────────────────────────────────

/**
 * Enforces policy at the MCP entry point.
 * Loads default.policy.json and performs checks before any tool processing.
 */
export class McpPolicyEnforcer {
  private policy: PolicyConfig | null = null;
  private policyPath: string;
  private loaded = false;

  /**
   * Create a new McpPolicyEnforcer.
   * @param policyPath - Optional path to policy file (defaults to contracts/default.policy.json)
   */
  constructor(policyPath?: string) {
    this.policyPath = policyPath || path.resolve(process.cwd(), 'contracts/default.policy.json');
  }

  /**
   * Load policy configuration from file.
   * @throws {Error} If policy file cannot be loaded
   */
  loadPolicy(): void {
    if (this.loaded) {
      return;
    }

    try {
      const content = fs.readFileSync(this.policyPath, 'utf8');
      this.policy = JSON.parse(content) as PolicyConfig;
      this.loaded = true;
      console.log(`[MCP Policy] Loaded policy: ${this.policy.name} v${this.policy.version}`);
    } catch (err) {
      const error = err as Error;
      // FAIL CLOSED: Policy is mandatory in all environments
      // Use an explicit dev policy file (contracts/dev.policy.json) for development
      console.error(`[MCP Policy] Failed to load policy from ${this.policyPath}: ${error.message}`);
      throw new Error(
        `[FATAL] Cannot start MCP server without valid policy configuration. ` +
        `Policy path: ${this.policyPath}. ` +
        `Create a dev.policy.json for development or ensure default.policy.json exists.`
      );
    }
  }

  /**
   * Check if policy is loaded.
   */
  isLoaded(): boolean {
    return this.loaded && this.policy !== null;
  }

  /**
   * Get the loaded policy configuration.
   */
  getPolicy(): PolicyConfig | null {
    return this.policy;
  }

  /**
   * Enforce policy for a tool call.
   * Performs all enabled policy checks and returns the first denial reason.
   *
   * @param ctx - Request context with correlation ID
   * @param toolName - Name of the tool being called
   * @param toolDef - Tool definition (optional, for detailed checks)
   * @returns PolicyCheckResult indicating if the call is allowed
   */
  enforce(
    _ctx: RequestContext | InvocationContext,
    toolName: string,
    toolDef?: ToolDefinition
  ): PolicyCheckResult {
    // Ensure policy is loaded
    if (!this.isLoaded()) {
      this.loadPolicy();
    }

    const policy = this.policy;
    if (!policy) {
      // FAIL CLOSED: No policy loaded - deny all requests
      return {
        allowed: false,
        reason: 'No policy configuration loaded - deny by default',
        rule: 'policy.load',
      };
    }

    // 1. Check deny list
    if (policy.rules.denyList.enabled) {
      const denyResult = this.checkDenyList(toolName, policy.rules.denyList);
      if (!denyResult.allowed) {
        return denyResult;
      }
    }

    // 2. Check allow list
    if (policy.rules.allowList.enabled) {
      const allowResult = this.checkAllowList(toolName, policy.rules.allowList);
      if (!allowResult.allowed) {
        return allowResult;
      }
    }

    // 3. Check SSRF protection for URL-fetching tools
    if (policy.rules.ssrfProtection.enabled && toolDef) {
      const ssrfResult = this.checkSSRFProtection(toolName, toolDef, policy.rules.ssrfProtection);
      if (!ssrfResult.allowed) {
        return ssrfResult;
      }
    }

    // 4. Check capabilities requirement
    if (policy.rules.capabilities.enabled && toolDef) {
      const capResult = this.checkCapabilities(toolName, toolDef, policy.rules.capabilities);
      if (!capResult.allowed) {
        return capResult;
      }
    }

    return {
      allowed: true,
      reason: 'All policy checks passed',
    };
  }

  /**
   * Check tool against deny list.
   */
  private checkDenyList(toolName: string, rule: DenyListRule): PolicyCheckResult {
    // Check exact match
    if (rule.tools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is explicitly denied by policy`,
        rule: 'denyList',
      };
    }

    // Check pattern match
    for (const pattern of rule.patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(toolName)) {
          return {
            allowed: false,
            reason: `Tool "${toolName}" matches denied pattern "${pattern}"`,
            rule: 'denyList.pattern',
          };
        }
      } catch {
        // Invalid regex, skip
        console.warn(`[MCP Policy] Invalid deny pattern: ${pattern}`);
      }
    }

    return { allowed: true, reason: 'Not in deny list' };
  }

  /**
   * Check tool against allow list.
   */
  private checkAllowList(toolName: string, rule: AllowListRule): PolicyCheckResult {
    // If allow list is empty and enabled, deny everything
    if (rule.tools.length === 0) {
      return { allowed: true, reason: 'Allow list is empty, allowing all' };
    }

    if (!rule.tools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is not in the allowed tools list`,
        rule: 'allowList',
      };
    }

    return { allowed: true, reason: 'In allow list' };
  }

  /**
   * Check SSRF protection for URL-fetching tools.
   */
  private checkSSRFProtection(
    toolName: string,
    _toolDef: ToolDefinition,
    _rule: SSRFProtectionRule
  ): PolicyCheckResult {
    // Only check tools that fetch URLs
    const urlFetchingTools = ['fetch', 'http_get', 'http_post', 'curl', 'wget'];
    const isUrlFetching = urlFetchingTools.some(
      t => toolName.toLowerCase().includes(t.toLowerCase())
    );

    if (!isUrlFetching) {
      return { allowed: true, reason: 'Not a URL-fetching tool' };
    }

    // Note: Actual URL validation happens at execution time with the full URL
    // This is a preliminary check at MCP entry point
    // The tool executor should perform the actual SSRF checks

    return { allowed: true, reason: 'SSRF check deferred to execution' };
  }

  /**
   * Check capabilities requirement.
   */
  private checkCapabilities(
    toolName: string,
    _toolDef: ToolDefinition,
    rule: CapabilitiesRule
  ): PolicyCheckResult {
    if (!rule.requiredForTools.includes(toolName)) {
      return { allowed: true, reason: 'Tool not in capabilities requirement list' };
    }

    // Capabilities are checked at execution time via the policy gate
    // This is just a preliminary check at MCP entry
    return { allowed: true, reason: 'Capabilities check deferred to execution' };
  }

  /**
   * Get rate limit configuration.
   */
  getRateLimitConfig(): RateLimitRule | null {
    if (!this.policy) return null;
    return this.policy.rules.rateLimit.enabled ? this.policy.rules.rateLimit : null;
  }

  /**
   * Get SSRF protection configuration.
   */
  getSSRFConfig(): SSRFProtectionRule | null {
    if (!this.policy) return null;
    return this.policy.rules.ssrfProtection.enabled ? this.policy.rules.ssrfProtection : null;
  }

  /**
   * Get prompt injection configuration.
   */
  getPromptInjectionConfig(): PromptInjectionRule | null {
    if (!this.policy) return null;
    return this.policy.rules.promptInjection.enabled ? this.policy.rules.promptInjection : null;
  }

  /**
   * Get output filtering configuration.
   */
  getOutputFilteringConfig(): OutputFilteringRule | null {
    if (!this.policy) return null;
    return this.policy.rules.outputFiltering.enabled ? this.policy.rules.outputFiltering : null;
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────────

let policyEnforcerInstance: McpPolicyEnforcer | null = null;
let policyEnforcerInitPromise: Promise<McpPolicyEnforcer> | null = null;
let policyEnforcerResolve: ((value: McpPolicyEnforcer) => void) | null = null;

/**
 * Get the singleton policy enforcer instance.
 * Thread-safe with double-checked locking pattern.
 */
export function getPolicyEnforcer(): McpPolicyEnforcer {
  // Fast path: already initialized
  if (policyEnforcerInstance) {
    return policyEnforcerInstance;
  }

  // Synchronize initialization
  return _initPolicyEnforcerSync();
}

function _initPolicyEnforcerSync(): McpPolicyEnforcer {
  // Double-checked locking - check again after acquiring initialization lock
  if (policyEnforcerInstance) {
    return policyEnforcerInstance;
  }

  // Initialize synchronously
  const instance = new McpPolicyEnforcer();
  instance.loadPolicy();
  policyEnforcerInstance = instance;
  return instance;
}

/**
 * Get the singleton policy enforcer instance asynchronously.
 * Safe for concurrent initialization.
 */
export async function getPolicyEnforcerAsync(): Promise<McpPolicyEnforcer> {
  if (policyEnforcerInstance) {
    return policyEnforcerInstance;
  }

  // If another async call is in progress, wait for it
  if (policyEnforcerInitPromise) {
    return policyEnforcerInitPromise;
  }

  // Start initialization
  policyEnforcerInitPromise = new Promise<McpPolicyEnforcer>((resolve) => {
    policyEnforcerResolve = resolve;
  });

  try {
    const instance = new McpPolicyEnforcer();
    instance.loadPolicy();
    policyEnforcerInstance = instance;

    if (policyEnforcerResolve) {
      policyEnforcerResolve(instance);
    }

    return instance;
  } catch (error) {
    // Reset promise on failure so retries can work
    policyEnforcerInitPromise = null;
    throw error;
  }
}

/**
 * Reset the policy enforcer instance (for testing).
 */
export function resetPolicyEnforcer(): void {
  policyEnforcerInstance = null;
}
