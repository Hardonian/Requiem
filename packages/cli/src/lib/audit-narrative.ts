/**
 * Audit Narrative Generator (Differentiator D)
 *
 * Generates deterministic, policy-grade audit narratives from SSM signals.
 * No LLM involvement—pure structured template rendering from verifiable data.
 *
 * INVARIANT: Same inputs always produce same output (deterministic).
 * INVARIANT: Output suitable for compliance tickets without human editing.
 * INVARIANT: No external network calls.
 */

import {
  type SemanticState,
  type SemanticTransition,
  type DriftCategory,
  type ChangeVector,
  type DriftClassification,
  DriftCategory,
  computeIntegrityScore,
} from './semantic-state-machine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AuditFormat = 'markdown' | 'json';

export interface AuditNarrative {
  /** Narrative version for format stability */
  version: '1.0.0';
  /** Subject of the audit (state or transition) */
  subject: {
    type: 'state' | 'transition';
    id: string;
  };
  /** When the narrative was generated */
  generatedAt: string;
  /** Executive summary (1-2 sentences) */
  summary: string;
  /** Detailed sections */
  sections: AuditSection[];
  /** Compliance metadata */
  compliance: {
    driftCategories: DriftCategory[];
    integrityScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  };
}

export interface AuditSection {
  title: string;
  content: string;
}

export interface AuditNarrativeOptions {
  format: AuditFormat;
  includeRecommendations?: boolean;
  detailLevel?: 'brief' | 'standard' | 'detailed';
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETERMINISTIC NARRATIVE GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a complete audit narrative for a semantic state.
 *
 * INVARIANT: Deterministic output for same inputs.
 * INVARIANT: No network calls.
 * INVARIANT: Fail-closed on missing data.
 */
export function generateStateAuditNarrative(
  state: SemanticState,
  options: AuditNarrativeOptions = { format: 'markdown' }
): AuditNarrative {
  const sections: AuditSection[] = [];

  // State Identity Section
  sections.push({
    title: 'State Identity',
    content: generateStateIdentityContent(state),
  });

  // Integrity Assessment Section
  sections.push({
    title: 'Integrity Assessment',
    content: generateIntegrityContent(state),
  });

  // Configuration Binding Section
  sections.push({
    title: 'Configuration Binding',
    content: generateConfigurationContent(state),
  });

  // Risk Assessment
  const riskLevel = assessRiskLevel(state);
  const recommendations = generateRecommendations(state, riskLevel);

  if (options.includeRecommendations !== false) {
    sections.push({
      title: 'Recommendations',
      content: recommendations.map(r => `• ${r}`).join('\n'),
    });
  }

  // Executive Summary
  const summary = generateExecutiveSummary(state, riskLevel, recommendations);

  return {
    version: '1.0.0',
    subject: {
      type: 'state',
      id: state.id,
    },
    generatedAt: new Date().toISOString(),
    summary,
    sections,
    compliance: {
      driftCategories: [],
      integrityScore: state.integrityScore,
      riskLevel,
      recommendations,
    },
  };
}

/**
 * Generate audit narrative for a transition between states.
 */
export function generateTransitionAuditNarrative(
  fromState: SemanticState | null,
  toState: SemanticState,
  transition: SemanticTransition,
  options: AuditNarrativeOptions = { format: 'markdown' }
): AuditNarrative {
  const sections: AuditSection[] = [];

  // Transition Identity
  sections.push({
    title: 'Transition Identity',
    content: generateTransitionIdentityContent(fromState, toState, transition),
  });

  // Change Analysis
  sections.push({
    title: 'Change Analysis',
    content: generateChangeAnalysisContent(transition),
  });

  // Drift Classification
  sections.push({
    title: 'Drift Classification',
    content: generateDriftContent(transition),
  });

  // Integrity Delta
  sections.push({
    title: 'Integrity Delta',
    content: generateIntegrityDeltaContent(fromState, toState, transition),
  });

  // Risk Assessment
  const riskLevel = assessTransitionRiskLevel(transition);
  const recommendations = generateTransitionRecommendations(transition, riskLevel);

  if (options.includeRecommendations !== false) {
    sections.push({
      title: 'Recommendations',
      content: recommendations.map(r => `• ${r}`).join('\n'),
    });
  }

  const summary = generateTransitionExecutiveSummary(fromState, toState, transition, riskLevel);

  return {
    version: '1.0.0',
    subject: {
      type: 'transition',
      id: `${transition.fromId || 'GENESIS'}->${transition.toId}`,
    },
    generatedAt: new Date().toISOString(),
    summary,
    sections,
    compliance: {
      driftCategories: transition.driftCategories as DriftCategory[],
      integrityScore: toState.integrityScore,
      riskLevel,
      recommendations,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION GENERATORS (DETERMINISTIC TEMPLATES)
// ═══════════════════════════════════════════════════════════════════════════════

function generateStateIdentityContent(state: SemanticState): string {
  const lines = [
    `State ID: ${state.id}`,
    `Created: ${state.createdAt}`,
    `Actor: ${state.actor}`,
    `Content-Derived: ${state.id.substring(0, 16)}... (BLAKE3)`,
  ];

  if (state.labels && Object.keys(state.labels).length > 0) {
    lines.push('', 'Labels:');
    for (const [key, value] of Object.entries(state.labels)) {
      lines.push(`  ${key}: ${value}`);
    }
  }

  if (state.evidenceRefs && state.evidenceRefs.length > 0) {
    lines.push('', 'Evidence References:');
    for (const ref of state.evidenceRefs) {
      lines.push(`  - ${ref}`);
    }
  }

  return lines.join('\n');
}

function generateIntegrityContent(state: SemanticState): string {
  const breakdown = computeIntegrityScore(state, {});

  const lines = [
    `Overall Score: ${breakdown.total}/100`,
    '',
    'Component Breakdown:',
    `  [${breakdown.parityVerified ? '✓' : '✗'}] Parity Verified`,
    `  [${breakdown.policyBound ? '✓' : '✗'}] Policy Bound`,
    `  [${breakdown.contextCaptured ? '✓' : '✗'}] Context Captured`,
    `  [${breakdown.evalAttached ? '✓' : '✗'}] Eval Attached`,
    `  [${breakdown.replayVerified ? '✓' : '✗'}] Replay Verified`,
    `  [${breakdown.artifactSigned ? '✓' : '✗'}] Artifact Signed`,
  ];

  return lines.join('\n');
}

function generateConfigurationContent(state: SemanticState): string {
  const d = state.descriptor;

  const lines = [
    `Model: ${d.modelId}@${d.modelVersion || 'latest'}`,
    `Prompt Template: ${d.promptTemplateId}@${d.promptTemplateVersion}`,
    `Policy Snapshot: ${d.policySnapshotId.substring(0, 24)}...`,
    `Context Snapshot: ${d.contextSnapshotId.substring(0, 24)}...`,
    `Runtime: ${d.runtimeId}`,
  ];

  if (d.evalSnapshotId) {
    lines.push(`Eval Snapshot: ${d.evalSnapshotId.substring(0, 24)}...`);
  }

  return lines.join('\n');
}

function generateTransitionIdentityContent(
  fromState: SemanticState | null,
  toState: SemanticState,
  transition: SemanticTransition
): string {
  const lines = [
    `From State: ${fromState?.id || 'GENESIS'}`,
    `To State: ${toState.id}`,
    `Transition Time: ${transition.timestamp}`,
    `Reason: ${transition.reason}`,
  ];

  return lines.join('\n');
}

function generateChangeAnalysisContent(transition: SemanticTransition): string {
  if (transition.changeVectors.length === 0) {
    return 'No semantic changes detected. This is a genesis or identical state transition.';
  }

  const lines = [
    `Total Changes: ${transition.changeVectors.length}`,
    '',
    'Change Vectors:',
  ];

  for (const cv of transition.changeVectors) {
    lines.push(`  [${cv.significance.toUpperCase()}] ${cv.path}`);
    lines.push(`    From: ${String(cv.from)}`);
    lines.push(`    To:   ${String(cv.to)}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function generateDriftContent(transition: SemanticTransition): string {
  if (transition.driftCategories.length === 0) {
    return 'No drift categories apply to this transition.';
  }

  const lines = [
    `Drift Categories Detected: ${transition.driftCategories.length}`,
    '',
  ];

  for (const category of transition.driftCategories) {
    const description = getDriftCategoryDescription(category as DriftCategory);
    lines.push(`  • ${category}`);
    lines.push(`    ${description}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function generateIntegrityDeltaContent(
  fromState: SemanticState | null,
  toState: SemanticState,
  transition: SemanticTransition
): string {
  const fromScore = fromState?.integrityScore ?? 0;
  const toScore = toState.integrityScore;
  const delta = transition.integrityDelta;

  const direction = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  const trend = delta > 0 ? 'improved' : delta < 0 ? 'degraded' : 'unchanged';

  const lines = [
    `Previous Score: ${fromScore}/100`,
    `Current Score: ${toScore}/100`,
    `Delta: ${direction} ${Math.abs(delta)} points (${trend})`,
  ];

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK ASSESSMENT
// ═══════════════════════════════════════════════════════════════════════════════

function assessRiskLevel(state: SemanticState): AuditNarrative['compliance']['riskLevel'] {
  const score = state.integrityScore;

  if (score >= 90) return 'low';
  if (score >= 70) return 'medium';
  if (score >= 50) return 'high';
  return 'critical';
}

function assessTransitionRiskLevel(
  transition: SemanticTransition
): AuditNarrative['compliance']['riskLevel'] {
  const hasCritical = transition.changeVectors.some(cv => cv.significance === 'critical');
  const hasMajor = transition.changeVectors.some(cv => cv.significance === 'major');

  if (hasCritical) return 'critical';
  if (hasMajor) return 'high';
  if (transition.driftCategories.length > 0) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateRecommendations(
  state: SemanticState,
  riskLevel: AuditNarrative['compliance']['riskLevel']
): string[] {
  const recommendations: string[] = [];
  const breakdown = computeIntegrityScore(state, {});

  if (!breakdown.parityVerified) {
    recommendations.push('Enable parity verification for cross-environment consistency');
  }

  if (!breakdown.replayVerified) {
    recommendations.push('Run replay verification to ensure deterministic behavior');
  }

  if (!breakdown.artifactSigned) {
    recommendations.push('Enable artifact signing for tamper-evident storage');
  }

  if (!breakdown.evalAttached) {
    recommendations.push('Attach evaluation snapshot for quality tracking');
  }

  if (riskLevel === 'critical') {
    recommendations.push('URGENT: Review state integrity before production use');
  } else if (riskLevel === 'high') {
    recommendations.push('HIGH: Address integrity gaps before next deployment');
  }

  return recommendations;
}

function generateTransitionRecommendations(
  transition: SemanticTransition,
  riskLevel: AuditNarrative['compliance']['riskLevel']
): string[] {
  const recommendations: string[] = [];

  if (transition.driftCategories.includes(DriftCategory.ModelDrift)) {
    recommendations.push('Model drift detected—run full evaluation suite before promotion');
  }

  if (transition.driftCategories.includes(DriftCategory.PolicyDrift)) {
    recommendations.push('Policy drift detected—review governance implications');
  }

  if (transition.integrityDelta < 0) {
    recommendations.push('Integrity score decreased—investigate root cause');
  }

  if (transition.replayStatus === 'failed') {
    recommendations.push('Replay verification failed—state may be non-deterministic');
  } else if (transition.replayStatus === 'pending') {
    recommendations.push('Replay verification pending—complete before production');
  }

  if (riskLevel === 'critical') {
    recommendations.push('URGENT: Critical changes require secondary approval');
  }

  return recommendations;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTIVE SUMMARIES
// ═══════════════════════════════════════════════════════════════════════════════

function generateExecutiveSummary(
  state: SemanticState,
  riskLevel: AuditNarrative['compliance']['riskLevel'],
  recommendations: string[]
): string {
  const urgency = riskLevel === 'critical' || riskLevel === 'high' ? 'requires attention' : 'is within normal parameters';

  return `Semantic state ${state.id.substring(0, 16)}... ${urgency}. ` +
    `Integrity score: ${state.integrityScore}/100. ` +
    `${recommendations.length > 0 ? `${recommendations.length} recommendation(s) provided.` : 'No action required.'}`;
}

function generateTransitionExecutiveSummary(
  fromState: SemanticState | null,
  toState: SemanticState,
  transition: SemanticTransition,
  riskLevel: AuditNarrative['compliance']['riskLevel']
): string {
  const changeCount = transition.changeVectors.length;
  const driftCount = transition.driftCategories.length;

  return `Transition from ${fromState?.id.substring(0, 8) || 'GENESIS'} to ${toState.id.substring(0, 8)} ` +
    `includes ${changeCount} change(s) across ${driftCount} drift categor${driftCount === 1 ? 'y' : 'ies'}. ` +
    `Risk level: ${riskLevel.toUpperCase()}. ` +
    `Integrity delta: ${transition.integrityDelta > 0 ? '+' : ''}${transition.integrityDelta}.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMAT RENDERERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render audit narrative as markdown.
 */
export function renderNarrativeAsMarkdown(narrative: AuditNarrative): string {
  const lines: string[] = [
    `# Audit Narrative: ${narrative.subject.type === 'state' ? 'Semantic State' : 'State Transition'}`,
    '',
    `> **Version:** ${narrative.version}  `,
    `> **Generated:** ${narrative.generatedAt}  `,
    `> **Subject:** \`${narrative.subject.id}\``,
    '',
    '## Executive Summary',
    '',
    narrative.summary,
    '',
  ];

  for (const section of narrative.sections) {
    lines.push(`## ${section.title}`, '', section.content, '');
  }

  lines.push(
    '---',
    '',
    '*This narrative was generated deterministically from verifiable SSM signals.*',
    '*No LLM was involved in its generation.*'
  );

  return lines.join('\n');
}

/**
 * Render audit narrative as JSON.
 */
export function renderNarrativeAsJSON(narrative: AuditNarrative): string {
  return JSON.stringify(narrative, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDriftCategoryDescription(category: DriftCategory): string {
  const descriptions: Record<DriftCategory, string> = {
    [DriftCategory.ModelDrift]: 'AI model or version changed—requires re-evaluation',
    [DriftCategory.PromptDrift]: 'Prompt template or version changed—may affect behavior',
    [DriftCategory.ContextDrift]: 'Knowledge base or context snapshot changed',
    [DriftCategory.PolicyDrift]: 'Policy snapshot changed—governance review needed',
    [DriftCategory.EvalDrift]: 'Evaluation criteria or snapshot changed',
    [DriftCategory.RuntimeDrift]: 'Runtime environment changed—parity check recommended',
    [DriftCategory.UnknownDrift]: 'Unclassified drift detected—manual review required',
  };

  return descriptions[category] || 'Unknown drift category';
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate and render audit narrative in specified format.
 */
export function generateAuditReport(
  state: SemanticState,
  options: Partial<AuditNarrativeOptions> = {}
): string {
  const opts: AuditNarrativeOptions = {
    format: 'markdown',
    includeRecommendations: true,
    detailLevel: 'standard',
    ...options,
  };

  const narrative = generateStateAuditNarrative(state, opts);

  if (opts.format === 'json') {
    return renderNarrativeAsJSON(narrative);
  }

  return renderNarrativeAsMarkdown(narrative);
}

/**
 * Generate and render transition audit report.
 */
export function generateTransitionAuditReport(
  fromState: SemanticState | null,
  toState: SemanticState,
  transition: SemanticTransition,
  options: Partial<AuditNarrativeOptions> = {}
): string {
  const opts: AuditNarrativeOptions = {
    format: 'markdown',
    includeRecommendations: true,
    detailLevel: 'standard',
    ...options,
  };

  const narrative = generateTransitionAuditNarrative(fromState, toState, transition, opts);

  if (opts.format === 'json') {
    return renderNarrativeAsJSON(narrative);
  }

  return renderNarrativeAsMarkdown(narrative);
}
