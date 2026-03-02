/**
 * Divergence Sentinel
 * 
 * Automatic detection and tracking of execution divergence.
 * 
 * Features:
 * - Records divergence events
 * - Marks runs as divergent
 * - Surfaces warnings in CLI and UI
 * - Cannot be bypassed or silenced
 */

import { getDB } from '../db/connection.js';
import { logger } from '../core/index.js';

export interface DivergenceEvent {
  id: string;
  runId: string;
  detectedAt: string;
  divergenceType: 'fingerprint_mismatch' | 'replay_mismatch' | 'policy_drift' | 'output_drift';
  canonicalRunId?: string;
  expectedFingerprint: string;
  actualFingerprint: string;
  stepNumber?: number;
  severity: 'warning' | 'critical';
  acknowledged: boolean;
}

/**
 * Record a divergence event
 */
export function recordDivergence(event: Omit<DivergenceEvent, 'id' | 'detectedAt' | 'acknowledged'>): DivergenceEvent {
  const db = getDB();
  const id = `div_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  
  const fullEvent: DivergenceEvent = {
    ...event,
    id,
    detectedAt: new Date().toISOString(),
    acknowledged: false,
  };

  // Store divergence event
  try {
    db.prepare(`
      INSERT INTO divergence_events (
        id, run_id, detected_at, divergence_type, canonical_run_id,
        expected_fingerprint, actual_fingerprint, step_number, severity, acknowledged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullEvent.id,
      fullEvent.runId,
      fullEvent.detectedAt,
      fullEvent.divergenceType,
      fullEvent.canonicalRunId || null,
      fullEvent.expectedFingerprint,
      fullEvent.actualFingerprint,
      fullEvent.stepNumber || null,
      fullEvent.severity,
      fullEvent.acknowledged ? 1 : 0
    );
  } catch {
    // Table might not exist, log but don't fail
    logger.warn('divergence.sentinel_db_error', 'Could not store divergence event', {
      runId: event.runId,
      type: event.divergenceType,
    });
  }

  // Mark run as divergent
  markRunDivergent(event.runId, event.severity);

  // Log the divergence (cannot be silenced)
  logger.error('divergence.detected', `DIVERGENCE DETECTED: ${event.divergenceType}`, {
    runId: event.runId,
    type: event.divergenceType,
    severity: event.severity,
    expected: event.expectedFingerprint.substring(0, 16) + '...',
    actual: event.actualFingerprint.substring(0, 16) + '...',
  });

  // Console warning (always shown)
  console.warn('\n⚠️  DIVERGENCE DETECTED ⚠️');
  console.warn(`Run: ${event.runId}`);
  console.warn(`Type: ${event.divergenceType}`);
  console.warn(`Severity: ${event.severity.toUpperCase()}`);
  console.warn(`Expected: ${event.expectedFingerprint.substring(0, 16)}...`);
  console.warn(`Actual:   ${event.actualFingerprint.substring(0, 16)}...`);
  if (event.stepNumber !== undefined) {
    console.warn(`Step:     ${event.stepNumber}`);
  }
  console.warn('\nThis run has been marked as DIVERGENT.');
  console.warn('Use `reach explain <run-id>` for details.\n');

  return fullEvent;
}

/**
 * Mark a run as divergent
 */
function markRunDivergent(runId: string, severity: 'warning' | 'critical'): void {
  const db = getDB();
  
  try {
    // Update runs table
    db.prepare(`
      UPDATE runs SET 
        divergence_status = ?,
        divergence_detected_at = ?
      WHERE run_id = ?
    `).run(severity, new Date().toISOString(), runId);
  } catch {
    // Table or columns might not exist
    logger.debug('divergence.mark_run_failed', 'Could not mark run as divergent', { runId });
  }
}

/**
 * Check if a run has divergence
 */
export function hasDivergence(runId: string): boolean {
  const db = getDB();
  
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM divergence_events WHERE run_id = ?
    `).get(runId) as { count: number } | undefined;
    
    return (result?.count || 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Get divergence status for a run
 */
export function getDivergenceStatus(runId: string): {
  isDivergent: boolean;
  severity?: 'warning' | 'critical';
  events: DivergenceEvent[];
} {
  const db = getDB();
  
  try {
    const events = db.prepare(`
      SELECT * FROM divergence_events WHERE run_id = ? ORDER BY detected_at DESC
    `).all(runId) as Array<{
      id: string;
      run_id: string;
      detected_at: string;
      divergence_type: string;
      canonical_run_id: string | null;
      expected_fingerprint: string;
      actual_fingerprint: string;
      step_number: number | null;
      severity: string;
      acknowledged: number;
    }>;

    if (events.length === 0) {
      return { isDivergent: false, events: [] };
    }

    const severity = events.some(e => e.severity === 'critical') ? 'critical' : 'warning';

    return {
      isDivergent: true,
      severity,
      events: events.map(e => ({
        id: e.id,
        runId: e.run_id,
        detectedAt: e.detected_at,
        divergenceType: e.divergence_type as DivergenceEvent['divergenceType'],
        canonicalRunId: e.canonical_run_id || undefined,
        expectedFingerprint: e.expected_fingerprint,
        actualFingerprint: e.actual_fingerprint,
        stepNumber: e.step_number || undefined,
        severity: e.severity as 'warning' | 'critical',
        acknowledged: e.acknowledged === 1,
      })),
    };
  } catch {
    return { isDivergent: false, events: [] };
  }
}

/**
 * Get divergent runs
 */
export function getDivergentRuns(): Array<{
  runId: string;
  detectedAt: string;
  severity: 'warning' | 'critical';
  eventCount: number;
}> {
  const db = getDB();
  
  try {
    const results = db.prepare(`
      SELECT 
        run_id,
        MAX(detected_at) as detected_at,
        MAX(CASE WHEN severity = 'critical' THEN 2 ELSE 1 END) as severity_val,
        COUNT(*) as event_count
      FROM divergence_events
      WHERE acknowledged = 0
      GROUP BY run_id
      ORDER BY detected_at DESC
    `).all() as Array<{
      run_id: string;
      detected_at: string;
      severity_val: number;
      event_count: number;
    }>;

    return results.map(r => ({
      runId: r.run_id,
      detectedAt: r.detected_at,
      severity: r.severity_val === 2 ? 'critical' : 'warning',
      eventCount: r.event_count,
    }));
  } catch {
    return [];
  }
}

/**
 * Initialize divergence sentinel tables
 */
export function initDivergenceTables(): void {
  const db = getDB();
  
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS divergence_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        divergence_type TEXT NOT NULL,
        canonical_run_id TEXT,
        expected_fingerprint TEXT NOT NULL,
        actual_fingerprint TEXT NOT NULL,
        step_number INTEGER,
        severity TEXT NOT NULL,
        acknowledged INTEGER DEFAULT 0
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divergence_run_id ON divergence_events(run_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divergence_detected ON divergence_events(detected_at)
    `);
  } catch (error) {
    logger.warn('divergence.init_failed', 'Could not initialize divergence tables', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Format divergence status for display
 */
export function formatDivergenceBadge(status: { isDivergent: boolean; severity?: string }): string {
  if (!status.isDivergent) {
    return '✓ canonical';
  }
  
  if (status.severity === 'critical') {
    return '🔴 DIVERGENT';
  }
  
  return '🟡 divergent';
}
