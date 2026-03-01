/**
 * Microfracture Suite — Deterministic analysis and verification engines
 *
 * This module provides pure, deterministic algorithms for:
 * - Diff computation between runs
 * - Lineage graph resolution
 * - Policy simulation
 * - Drift detection
 * - Run explanation
 * - Usage aggregation
 * - Tenant isolation verification
 * - Chaos testing
 * - Share token management
 */

// Diff Engine
export {
  computeDiff,
  formatDiffAsTable,
  getTopDeltas,
  type RunDiffResult,
  type RunRecord,
  type DiffInput,
  type DiffOutput,
  type PolicyDelta,
  type GraphDelta,
} from './diff-engine';

// Lineage Engine
export {
  resolveLineage,
  formatLineageAsTree,
  formatLineageAsJson,
  getAncestryPath,
  type LineageNode,
  type LineageEdge,
  type LineageGraph,
  type LineageOptions,
} from './lineage-engine';

// Policy Simulation Engine
export {
  simulatePolicy,
  formatPolicyResultAsTable,
  listPolicyProfiles,
  POLICY_PROFILES,
  type PolicyRule,
  type PolicyContext,
  type PolicyViolation,
  type PolicySimulationResult,
} from './policy-sim-engine';

// Drift Engine
export {
  analyzeDrift,
  formatDriftAsTable,
  formatDriftAsJson,
  type DriftEvent,
  type DriftComparison,
  type DriftResult,
} from './drift-engine';

// Explain Engine
export {
  explainRun,
  formatExplainAsMarkdown,
  formatExplainAsTable,
  type ExplainInput,
  type ExplainInfluence,
  type ExplainSection,
  type ExplainResult,
} from './explain-engine';

// Usage Engine
export {
  aggregateUsage,
  generateUsageSummary,
  formatUsageAsTable,
  formatUsageAsJson,
  type UsageRecord,
  type UsageRollup,
  type UsageSummary,
} from './usage-engine';

// Tenant Check Engine
export {
  checkTenantIsolation,
  formatTenantCheckAsTable,
  formatTenantCheckAsJson,
  type TenantCheckRecord,
  type TenantCheckResult,
} from './tenant-check-engine';

// Chaos Engine
export {
  runChaosQuick,
  formatChaosAsTable,
  formatChaosAsJson,
  type ChaosCheckResult,
  type ChaosReport,
  type ChaosContext,
} from './chaos-engine';

// Share Engine
export {
  generateShareToken,
  validateShareToken,
  createDiffProofCard,
  formatShareUrl,
  formatCardUrl,
  redactData,
  type ShareToken,
  type ShareValidationResult,
  type DiffProofCardData,
} from './share-engine';
