/**
 * Junction Types and Configuration
 */

import { hashShort } from '../lib/hash.js';

export type JunctionType = 'diff_critical' | 'drift_alert' | 'trust_drop' | 'policy_violation';
export type SourceType = 'diff' | 'drift' | 'policy' | 'trust';

export interface JunctionTrigger {
  type: JunctionType;
  sourceType: SourceType;
  sourceRef: string;
  severityScore: number;
  triggerData: Record<string, any>;
  triggerTrace: Record<string, any>;
  scopeKeys?: Record<string, string>;
}

export interface JunctionConfig {
  enabled: boolean;
  cooldownHours: number;
  dedupeWindow: number; // in seconds
  severityThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  rules: Record<JunctionType, JunctionRule>;
}

export interface JunctionRule {
  enabled: boolean;
  minSeverity: number;
  description: string;
  actionTemplate: string;
}

/**
 * Generates a deterministic fingerprint for a junction trigger
 */
export function generateJunctionFingerprint(trigger: JunctionTrigger): string {
  // Use canonical JSON for deterministic hashing
  const canonical = JSON.stringify({
    type: trigger.type,
    sourceType: trigger.sourceType,
    sourceRef: trigger.sourceRef,
    severityScore: trigger.severityScore,
    // Sort keys for deterministic output
    triggerData: sortObjectKeys(trigger.triggerData),
  });
  
  return hashShort(canonical);
}

/**
 * Generates a deduplication key for preventing duplicate junctions
 */
export function generateDeduplicationKey(trigger: JunctionTrigger): string {
  const keyData = `${trigger.type}:${trigger.sourceType}:${trigger.sourceRef}`;
  return hashShort(keyData);
}

/**
 * Sort object keys recursively for deterministic JSON serialization
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sortObjectKeys(item));
  }
  
  if (typeof obj === 'object') {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      sorted[key] = sortObjectKeys(obj[key]);
    }
    return sorted;
  }
  
  return obj;
}

/**
 * Maps severity score to severity level
 */
export function getSeverityLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 0.9) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

/**
 * Junction type metadata
 */
export const JUNCTION_TYPE_META: Record<JunctionType, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  diff_critical: {
    label: 'Critical Diff',
    description: 'A significant change detected in a run diff that requires review',
    icon: '⚡',
    color: '#dc2626',
  },
  drift_alert: {
    label: 'Drift Alert',
    description: 'Behavioral drift detected beyond acceptable thresholds',
    icon: '📉',
    color: '#f59e0b',
  },
  trust_drop: {
    label: 'Trust Drop',
    description: 'Trust score has dropped below acceptable levels',
    icon: '🛡️',
    color: '#ef4444',
  },
  policy_violation: {
    label: 'Policy Violation',
    description: 'Policy evaluation failed or threshold exceeded',
    icon: '📋',
    color: '#8b5cf6',
  },
};

/**
 * Default junction configuration
 */
export const DEFAULT_JUNCTION_CONFIG: JunctionConfig = {
  enabled: true,
  cooldownHours: 24,
  dedupeWindow: 3600,
  severityThresholds: {
    critical: 0.9,
    high: 0.7,
    medium: 0.4,
    low: 0.0,
  },
  rules: {
    diff_critical: {
      enabled: true,
      minSeverity: 0.8,
      description: 'Critical changes in diff requiring review',
      actionTemplate: 'review_diff',
    },
    drift_alert: {
      enabled: true,
      minSeverity: 0.6,
      description: 'Behavioral drift alert',
      actionTemplate: 'investigate_drift',
    },
    trust_drop: {
      enabled: true,
      minSeverity: 0.7,
      description: 'Trust score drop alert',
      actionTemplate: 'restore_trust',
    },
    policy_violation: {
      enabled: true,
      minSeverity: 0.5,
      description: 'Policy violation detected',
      actionTemplate: 'enforce_policy',
    },
  },
};

