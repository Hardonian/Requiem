/**
 * Junction Orchestrator
 * Manages junction detection, deduplication, and persistence
 */

import { JunctionTrigger, JunctionType, generateJunctionFingerprint, generateDeduplicationKey, DEFAULT_JUNCTION_CONFIG } from './types';
import { JunctionRepository, type Junction } from '../db/junctions';

// Default configuration
const DEFAULT_CONFIG = {
  cooldownHours: 24,
  dedupeWindowSeconds: 3600,
  severityThresholds: {
    critical: 0.9,
    high: 0.7,
    medium: 0.4,
    low: 0.0,
  },
};

export interface JunctionOrchestratorConfig {
  cooldownHours: number;
  dedupeWindowSeconds: number;
  severityThresholds: typeof DEFAULT_CONFIG.severityThresholds;
}

export class JunctionOrchestrator {
  private config: JunctionOrchestratorConfig;

  constructor(config?: Partial<JunctionOrchestratorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Process a junction trigger and create a junction if conditions are met
   */
  async processTrigger(trigger: JunctionTrigger): Promise<{
    created: boolean;
    junction?: Junction;
    reason?: string;
  }> {
    // Generate deterministic fingerprint
    const fingerprint = generateJunctionFingerprint(trigger);
    
    // Generate deduplication key
    const dedupeKey = generateDeduplicationKey(trigger);
    
    // Check for existing active junction with same fingerprint
    const existingByFingerprint = JunctionRepository.findByFingerprint(fingerprint);
    if (existingByFingerprint.length > 0) {
      return {
        created: false,
        reason: 'duplicate_fingerprint',
      };
    }
    
    // Check for cooldown
    if (JunctionRepository.isInCooldown(dedupeKey)) {
      return {
        created: false,
        reason: 'in_cooldown',
      };
    }
    
    // Check for existing active junction with same dedupe key
    const existingByDedupe = JunctionRepository.findByDeduplicationKey(dedupeKey);
    if (existingByDedupe) {
      return {
        created: false,
        reason: 'active_junction_exists',
      };
    }
    
    // Create the junction
    const junction = JunctionRepository.create({
      junction_type: trigger.type as JunctionType,
      severity_score: trigger.severityScore,
      fingerprint,
      source_type: trigger.sourceType,
      source_ref: trigger.sourceRef,
      trigger_data: trigger.triggerData,
      trigger_trace: trigger.triggerTrace,
      deduplication_key: dedupeKey,
      cooldown_hours: this.config.cooldownHours,
    });
    
    return {
      created: true,
      junction,
    };
  }

  /**
   * Scan for junctions within a time range
   */
  async scan(since: Date, options?: {
    junctionType?: string;
    minSeverity?: number;
    limit?: number;
  }): Promise<Junction[]> {
    const junctions = JunctionRepository.list({
      junctionType: options?.junctionType,
      minSeverity: options?.minSeverity,
      limit: options?.limit || 100,
    });
    
    // Filter by date
    return junctions.filter(j => new Date(j.created_at) >= since);
  }

  /**
   * Get a junction by ID
   */
  async getJunction(id: string): Promise<Junction | undefined> {
    return JunctionRepository.findById(id);
  }

  /**
   * Resolve a junction
   */
  async resolveJunction(id: string): Promise<Junction | undefined> {
    return JunctionRepository.resolve(id);
  }

  /**
   * Suppress a junction
   */
  async suppressJunction(id: string): Promise<Junction | undefined> {
    return JunctionRepository.suppress(id);
  }

  /**
   * List all junctions
   */
  async listJunctions(options?: {
    junctionType?: string;
    sourceType?: string;
    status?: string;
    minSeverity?: number;
    limit?: number;
    offset?: number;
  }): Promise<Junction[]> {
    return JunctionRepository.list(options);
  }
}

// Export singleton instance
export const junctionOrchestrator = new JunctionOrchestrator();

// Export helper functions
export { generateJunctionFingerprint, generateDeduplicationKey };
