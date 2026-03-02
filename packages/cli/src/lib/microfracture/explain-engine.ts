/**
 * Explain Engine — Deterministic explanation of run behavior
 *
 * INVARIANT: Explanations derived from recorded artifacts only
 * INVARIANT: No LLM or non-deterministic generation
 * INVARIANT: Stable ordering for consistent output
 */

export interface ExplainInput {
  runId: string;
  tenantId: string;
  toolName: string;
  inputFingerprint: string;
  outputFingerprint: string | null;
  executionFingerprint: string | null;
  replayVerified: boolean;
  replayMatchPercent: number;
  policyDecisions: Array<{ rule: string; action: string; reason?: string }>;
  trace?: Array<{
    step: number;
    tool: string;
    inputDigest: string;
    outputDigest: string | null;
    latencyMs?: number;
  }>;
  createdAt: string;
}

export interface ExplainInfluence {
  type: 'input' | 'policy' | 'execution' | 'external';
  description: string;
  weight: number; // 0-1, how much this influenced the outcome
}

export interface ExplainSection {
  title: string;
  content: string;
  evidence: string[];
}

export interface ExplainResult {
  runId: string;
  summary: string;
  determinismStatus: 'verified' | 'unverified' | 'failed';
  influences: ExplainInfluence[];
  causalChain: ExplainSection[];
  policySummary: string;
  recommendations: string[];
  resultHash: string;
  generatedAt: string; // Display only
}

/**
 * Generate deterministic explanation for a run
 */
export function explainRun(input: ExplainInput): ExplainResult {
  const influences = extractInfluences(input);
  const causalChain = buildCausalChain(input);
  const policySummary = summarizePolicies(input.policyDecisions);
  const recommendations = generateRecommendations(input);

  // Determine determinism status
  let determinismStatus: ExplainResult['determinismStatus'] = 'unverified';
  if (input.replayVerified) {
    determinismStatus = input.replayMatchPercent >= 100 ? 'verified' : 'failed';
  }

  // Generate summary
  const summary = generateSummary(input, determinismStatus);

  const result: ExplainResult = {
    runId: input.runId,
    summary,
    determinismStatus,
    influences,
    causalChain,
    policySummary,
    recommendations,
    resultHash: '', // Set below
    generatedAt: new Date().toISOString(),
  };

  result.resultHash = computeExplainHash(result);

  return result;
}

/**
 * Extract influences from run data
 */
function extractInfluences(input: ExplainInput): ExplainInfluence[] {
  const influences: ExplainInfluence[] = [];

  // Input influence (always present)
  influences.push({
    type: 'input',
    description: `Tool ${input.toolName} received input with fingerprint ${input.inputFingerprint.substring(0, 16)}...`,
    weight: 0.5,
  });

  // Policy influences
  for (const decision of input.policyDecisions) {
    influences.push({
      type: 'policy',
      description: `Policy "${decision.rule}" ${decision.action}${decision.reason ? `: ${decision.reason}` : ''}`,
      weight: decision.action === 'deny' ? 0.9 : 0.3,
    });
  }

  // Execution influence
  if (input.trace && input.trace.length > 0) {
    influences.push({
      type: 'execution',
      description: `Execution trace contains ${input.trace.length} steps`,
      weight: 0.4,
    });
  }

  // Sort by weight for stable ordering
  influences.sort((a, b) => b.weight - a.weight);

  return influences;
}

/**
 * Build causal chain sections
 */
function buildCausalChain(input: ExplainInput): ExplainSection[] {
  const sections: ExplainSection[] = [];

  // Input section
  sections.push({
    title: 'Input Processing',
    content: `The run was initiated with tool "${input.toolName}". Input fingerprint: ${input.inputFingerprint.substring(0, 24)}...`,
    evidence: [`input_fingerprint:${input.inputFingerprint}`],
  });

  // Policy section
  if (input.policyDecisions.length > 0) {
    const allowCount = input.policyDecisions.filter(d => d.action === 'allow').length;
    const denyCount = input.policyDecisions.filter(d => d.action === 'deny').length;

    sections.push({
      title: 'Policy Evaluation',
      content: `${input.policyDecisions.length} policy rules evaluated. ${allowCount} allowed, ${denyCount} denied.`,
      evidence: input.policyDecisions.map(d => `policy:${d.rule}:${d.action}`),
    });
  }

  // Execution section
  if (input.trace && input.trace.length > 0) {
    const totalLatency = input.trace.reduce((sum, t) => sum + (t.latencyMs || 0), 0);
    sections.push({
      title: 'Execution Trace',
      content: `Executed ${input.trace.length} steps with total latency ${totalLatency}ms.`,
      evidence: input.trace.map(t => `step:${t.step}:${t.tool}:${t.outputDigest?.substring(0, 8) || 'null'}`),
    });
  }

  // Output section
  sections.push({
    title: 'Output Generation',
    content: input.outputFingerprint
      ? `Output generated with fingerprint ${input.outputFingerprint.substring(0, 24)}...`
      : 'No output was generated (execution may have failed or been blocked).',
    evidence: input.outputFingerprint ? [`output_fingerprint:${input.outputFingerprint}`] : [],
  });

  // Verification section
  sections.push({
    title: 'Determinism Verification',
    content: input.replayVerified
      ? `Replay verification: ${input.replayMatchPercent}% match. ${input.replayMatchPercent >= 100 ? 'Determinism confirmed.' : 'Mismatch detected.'}`
      : 'Replay verification not performed.',
    evidence: [`replay_verified:${input.replayVerified}`, `replay_match:${input.replayMatchPercent}`],
  });

  return sections;
}

/**
 * Summarize policy decisions
 */
function summarizePolicies(decisions: Array<{ rule: string; action: string }>): string {
  if (decisions.length === 0) {
    return 'No policy rules were triggered for this run.';
  }

  const denyCount = decisions.filter(d => d.action === 'deny').length;
  const modifyCount = decisions.filter(d => d.action === 'modify').length;
  const allowCount = decisions.filter(d => d.action === 'allow').length;

  if (denyCount > 0) {
    return `${decisions.length} policies evaluated. ${denyCount} blocked the execution.`;
  }

  if (modifyCount > 0) {
    return `${decisions.length} policies evaluated. ${modifyCount} modified the execution.`;
  }

  return `${decisions.length} policies evaluated. All allowed the execution.`;
}

/**
 * Generate recommendations
 */
function generateRecommendations(input: ExplainInput): string[] {
  const recs: string[] = [];

  if (!input.replayVerified) {
    recs.push('Run replay verification to confirm determinism');
  }

  if (input.replayMatchPercent < 100) {
    recs.push('Investigate replay mismatch - may indicate nondeterministic behavior');
  }

  if (input.policyDecisions.some(d => d.action === 'deny')) {
    recs.push('Review denied policies to understand execution constraints');
  }

  if (!input.outputFingerprint) {
    recs.push('No output produced - check if execution completed successfully');
  }

  return recs;
}

/**
 * Generate run summary
 */
function generateSummary(
  input: ExplainInput,
  determinismStatus: ExplainResult['determinismStatus']
): string {
  const parts: string[] = [];

  parts.push(`Run ${input.runId.substring(0, 8)}... using ${input.toolName}`);

  if (determinismStatus === 'verified') {
    parts.push('demonstrates verified deterministic execution');
  } else if (determinismStatus === 'failed') {
    parts.push('shows replay mismatch - nondeterministic behavior detected');
  } else {
    parts.push('awaits replay verification');
  }

  if (input.policyDecisions.some(d => d.action === 'deny')) {
    parts.push('and was blocked by policy');
  } else if (input.outputFingerprint) {
    parts.push('and produced output');
  }

  return parts.join(' ') + '.';
}

/**
 * Compute deterministic explanation hash
 */
function computeExplainHash(result: Omit<ExplainResult, 'resultHash' | 'generatedAt'>): string {
  const stableObj = {
    runId: result.runId,
    determinismStatus: result.determinismStatus,
    influenceCount: result.influences.length,
    causalChainLength: result.causalChain.length,
    recommendationCount: result.recommendations.length,
  };

  const json = JSON.stringify(stableObj, Object.keys(stableObj).sort());

  // Simple hash
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

/**
 * Format explanation as markdown
 */
export function formatExplainAsMarkdown(result: ExplainResult): string {
  const lines: string[] = [
    `# Run Explanation: ${result.runId.substring(0, 16)}...`,
    '',
    `**Status:** ${result.determinismStatus === 'verified' ? '✅ Verified' : result.determinismStatus === 'failed' ? '❌ Failed' : '⚠️ Unverified'}`,
    '',
    '## Summary',
    '',
    result.summary,
    '',
    '## Causal Chain',
    '',
  ];

  for (const section of result.causalChain) {
    lines.push(`### ${section.title}`);
    lines.push('');
    lines.push(section.content);
    lines.push('');
    if (section.evidence.length > 0) {
      lines.push('**Evidence:**');
      for (const ev of section.evidence) {
        lines.push(`- \`${ev}\``);
      }
      lines.push('');
    }
  }

  lines.push('## Policy Summary');
  lines.push('');
  lines.push(result.policySummary);
  lines.push('');

  if (result.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    for (const rec of result.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Explanation Hash: \`${result.resultHash}\`*`);

  return lines.join('\n');
}

/**
 * Format explanation as table (for CLI)
 */
export function formatExplainAsTable(result: ExplainResult): string {
  const lines: string[] = [
    '┌────────────────────────────────────────────────────────────┐',
    '│ RUN EXPLANATION                                            │',
    '├────────────────────────────────────────────────────────────┤',
    `│  Run ID:  ${result.runId.substring(0, 46).padEnd(46)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  ${result.summary.substring(0, 58).padEnd(58)}│`,
    '├────────────────────────────────────────────────────────────┤',
    `│  Determinism: ${result.determinismStatus.padEnd(43)}│`,
    '├────────────────────────────────────────────────────────────┤',
    '│  CAUSAL CHAIN                                              │',
  ];

  for (const section of result.causalChain) {
    lines.push(`│  • ${section.title.substring(0, 54).padEnd(54)}│`);
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push('│  TOP INFLUENCES                                            │');

  for (const inf of result.influences.slice(0, 3)) {
    const icon = inf.type === 'input' ? '📥' :
                 inf.type === 'policy' ? '🛡️' :
                 inf.type === 'execution' ? '⚙️' : '🔌';
    lines.push(`│  ${icon} ${inf.description.substring(0, 52).padEnd(52)}│`);
  }

  lines.push('├────────────────────────────────────────────────────────────┤');
  lines.push(`│  Hash: ${result.resultHash.substring(0, 16)}...`.padEnd(61) + '│');
  lines.push('└────────────────────────────────────────────────────────────┘');

  return lines.join('\n');
}

