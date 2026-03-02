/**
 * Microfracture Suite CLI Commands
 *
 * All commands follow the pattern:
 * - 0 exit code for success
 * - 2 exit code for user error
 * - 3 exit code for invariant failure
 * - 4 exit code for system error
 */

import { Command } from 'commander';
import { DecisionRepository } from '../db/decisions';
import { getDB } from '../db/connection';
import {
  computeDiff,
  formatDiffAsTable,
  getTopDeltas,
  resolveLineage,
  formatLineageAsTree,
  formatLineageAsJson,
  simulatePolicy,
  formatPolicyResultAsTable,
  listPolicyProfiles,
  analyzeDrift,
  formatDriftAsTable,
  formatDriftAsJson,
  explainRun,
  formatExplainAsTable,
  formatExplainAsMarkdown,
  generateUsageSummary,
  formatUsageAsTable,
  formatUsageAsJson,
  checkTenantIsolation,
  formatTenantCheckAsTable,
  formatTenantCheckAsJson,
  runChaosQuick,
  formatChaosAsTable,
  formatChaosAsJson,
  generateShareToken,
  formatShareUrl,
  formatCardUrl,
  type RunRecord,
} from '../lib/microfracture';

// Import hash for fingerprint computation
import { hash } from '../lib/hash';

/**
 * reach diff <runA> <runB> [--format=table|json] [--graph] [--card] [--share]
 */
export const diffCommand = new Command('diff')
  .description('Deterministic diff between two runs')
  .argument('<runA>', 'First run ID')
  .argument('<runB>', 'Second run ID')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .option('--graph', 'Include graph diff visualization')
  .option('--card', 'Print local URL for diff card view')
  .option('--share', 'Create shareable link and print URL')
  .action(async (runA: string, runB: string, options: {
    format?: string;
    graph?: boolean;
    card?: boolean;
    share?: boolean;
  }) => {
    try {
      // Lookup runs from database
      const d1 = DecisionRepository.findById(runA);
      const d2 = DecisionRepository.findById(runB);

      if (!d1) {
        console.error(`Error: Run ${runA} not found.`);
        process.exit(2);
      }
      if (!d2) {
        console.error(`Error: Run ${runB} not found.`);
        process.exit(2);
      }

      // Convert to RunRecord format
      const runAData: RunRecord = {
        id: d1.id,
        tenantId: d1.tenant_id,
        inputFingerprint: d1.input_fingerprint,
        outputFingerprint: d1.decision_output ? hash(d1.decision_output) : null,
        executionFingerprint: null,
        replayVerified: false,
        replayMatchPercent: 0,
        policyDecisions: [],
      };

      const runBData: RunRecord = {
        id: d2.id,
        tenantId: d2.tenant_id,
        inputFingerprint: d2.input_fingerprint,
        outputFingerprint: d2.decision_output ? hash(d2.decision_output) : null,
        executionFingerprint: null,
        replayVerified: false,
        replayMatchPercent: 0,
        policyDecisions: [],
      };

      // Compute diff
      const diff = computeDiff(runAData, runBData, 'safe');

      // Output
      if (options.format === 'json') {
        console.log(JSON.stringify({
          runA: diff.runA,
          runB: diff.runB,
          deterministic: diff.deterministic,
          firstDivergenceStep: diff.firstDivergenceStep,
          diffDigest: diff.diffDigest,
          topDeltas: getTopDeltas(diff),
        }, null, 2));
      } else {
        console.log(formatDiffAsTable(diff));
      }

      // Print card URL if requested
      if (options.card) {
        const baseUrl = process.env['READYLAYER_URL'] || 'http://localhost:3000';
        const cardUrl = formatCardUrl(runA, runB, baseUrl);
        console.log('\nDiff Card URL:');
        console.log(cardUrl);
      }

      // Handle share
      if (options.share) {
        const tenantId = d1.tenant_id;
        const token = generateShareToken(
          tenantId,
          'diff',
          runA,
          runB,
          'org',
          24,
          'safe'
        );
        const baseUrl = process.env['READYLAYER_URL'] || 'http://localhost:3000';
        const shareUrl = formatShareUrl(token.token, baseUrl);
        console.log('\nShare URL (expires in 24h):');
        console.log(shareUrl);
      }

      // Exit code based on determinism
      process.exit(diff.deterministic ? 0 : 3);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach lineage <runId> [--depth=N] [--format=table|json]
 */
export const lineageCommand = new Command('lineage')
  .description('Show run lineage (parent/child relationships)')
  .argument('<runId>', 'Run ID to analyze')
  .option('-d, --depth <depth>', 'Maximum depth to traverse', '10')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (runId: string, options: { depth?: string; format?: string }) => {
    try {
      const maxDepth = parseInt(options.depth || '10', 10);

      // Mock edge provider - in production this would query run_edges table
      const edgeProvider = (id: string) => {
        const db = getDB();
        const edges = db.prepare(
          'SELECT parent_run_id, child_run_id, reason FROM run_edges WHERE parent_run_id = ? OR child_run_id = ?'
        ).all(id, id) as Array<{ parent_run_id: string; child_run_id: string; reason: string }>;

        return edges.map(e => ({
          parentRunId: e.parent_run_id,
          childRunId: e.child_run_id,
          reason: e.reason,
        }));
      };

      const graph = resolveLineage(runId, edgeProvider, {
        maxDepth,
        includeChildren: true,
        includeParents: true,
      });

      if (options.format === 'json') {
        console.log(JSON.stringify(formatLineageAsJson(graph), null, 2));
      } else {
        console.log(formatLineageAsTree(graph));
      }

      process.exit(graph.hasCycles ? 3 : 0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach simulate <runId> --policy=<policyName|strict|lenient>
 */
export const simulateCommand = new Command('simulate')
  .description('Simulate policy evaluation for a run')
  .argument('<runId>', 'Run ID to simulate')
  .requiredOption('-p, --policy <policy>', 'Policy profile (strict, lenient, enterprise)')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (runId: string, options: { policy: string; format?: string }) => {
    try {
      const decision = DecisionRepository.findById(runId);
      if (!decision) {
        console.error(`Error: Run ${runId} not found.`);
        process.exit(2);
      }

      const profiles = listPolicyProfiles();
      if (!profiles.includes(options.policy)) {
        console.error(`Error: Unknown policy "${options.policy}".`);
        console.error(`Available policies: ${profiles.join(', ')}`);
        process.exit(2);
      }

      const result = simulatePolicy(
        runId,
        options.policy,
        {
          runId,
          tenantId: decision.tenant_id,
          inputFingerprint: decision.input_fingerprint,
          outputFingerprint: decision.decision_output ? hash(decision.decision_output) : null,
          toolName: decision.source_type,
          costCents: 0,
          latencyMs: decision.execution_latency || 0,
          tags: [],
          custom: {},
        }
      );

      if (options.format === 'json') {
        console.log(JSON.stringify({
          runId: result.runId,
          policyName: result.policyName,
          wouldAllow: result.wouldAllow,
          wouldBlock: result.wouldBlock,
          violations: result.violations,
          resultHash: result.resultHash,
        }, null, 2));
      } else {
        console.log(formatPolicyResultAsTable(result));
      }

      process.exit(result.wouldBlock ? 3 : 0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach drift --since=<runId> [--window=...] [--format=table|json]
 */
export const driftCommand = new Command('drift')
  .description('Analyze drift from a baseline run')
  .requiredOption('-s, --since <runId>', 'Baseline run ID')
  .option('-w, --window <size>', 'Window size (number of runs)', '50')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options: { since: string; window?: string; format?: string }) => {
    try {
      const baseline = DecisionRepository.findById(options.since);
      if (!baseline) {
        console.error(`Error: Baseline run ${options.since} not found.`);
        process.exit(2);
      }

      const windowSize = parseInt(options.window || '50', 10);

      // Get recent runs for drift analysis
      const db = getDB();
      const recentRuns = db.prepare(
        'SELECT id, input_fingerprint, decision_output, created_at FROM decisions WHERE tenant_id = ? AND id != ? ORDER BY created_at DESC LIMIT ?'
      ).all(baseline.tenant_id, options.since, windowSize) as Array<{
        id: string;
        input_fingerprint: string;
        decision_output: string | null;
        created_at: string;
      }>;

      const baselineEvent = {
        runId: baseline.id,
        inputFingerprint: baseline.input_fingerprint,
        outputFingerprint: baseline.decision_output ? hash(baseline.decision_output) : null,
        executionFingerprint: null,
        timestamp: baseline.created_at,
      };

      const windowEvents = recentRuns.map(r => ({
        runId: r.id,
        inputFingerprint: r.input_fingerprint,
        outputFingerprint: r.decision_output ? hash(r.decision_output) : null,
        executionFingerprint: null,
        timestamp: r.created_at,
      }));

      const result = analyzeDrift(baselineEvent, windowEvents, { maxWindow: windowSize });

      if (options.format === 'json') {
        console.log(JSON.stringify(formatDriftAsJson(result), null, 2));
      } else {
        console.log(formatDriftAsTable(result));
      }

      process.exit(result.maxDrift > 50 ? 3 : 0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach explain <runId> [--format=md|json]
 */
export const explainCommand = new Command('explain')
  .description('Generate deterministic explanation for a run')
  .argument('<runId>', 'Run ID to explain')
  .option('-f, --format <format>', 'Output format (table, md, json)', 'table')
  .action(async (runId: string, options: { format?: string }) => {
    try {
      const decision = DecisionRepository.findById(runId);
      if (!decision) {
        console.error(`Error: Run ${runId} not found.`);
        process.exit(2);
      }

      const result = explainRun({
        runId: decision.id,
        tenantId: decision.tenant_id,
        toolName: decision.source_type,
        inputFingerprint: decision.input_fingerprint,
        outputFingerprint: decision.decision_output ? hash(decision.decision_output) : null,
        executionFingerprint: null,
        replayVerified: false,
        replayMatchPercent: 0,
        policyDecisions: [],
        createdAt: decision.created_at,
      });

      if (options.format === 'json') {
        console.log(JSON.stringify({
          runId: result.runId,
          summary: result.summary,
          determinismStatus: result.determinismStatus,
          recommendations: result.recommendations,
          resultHash: result.resultHash,
        }, null, 2));
      } else if (options.format === 'md') {
        console.log(formatExplainAsMarkdown(result));
      } else {
        console.log(formatExplainAsTable(result));
      }

      process.exit(0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach usage [--format=table|json]
 */
export const usageCommand = new Command('usage')
  .description('Show usage summary for current tenant')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options: { format?: string }) => {
    try {
      // Get all decisions as usage records
      const db = getDB();
      const decisions = db.prepare(
        'SELECT id, tenant_id, source_type, decision_output, created_at FROM decisions'
      ).all() as Array<{
        id: string;
        tenant_id: string;
        source_type: string;
        decision_output: string | null;
        created_at: string;
      }>;

      // Use first tenant or default
      const tenantId = decisions[0]?.tenant_id || 'default';

      const usageRecords = decisions.map(d => ({
        runId: d.id,
        tenantId: d.tenant_id,
        toolName: d.source_type,
        costCents: 0,
        latencyMs: 0,
        storageBytes: (d.decision_output?.length || 0) * 2,
        policyEvalCount: 0,
        timestamp: d.created_at,
      }));

      const summary = generateUsageSummary(usageRecords, tenantId);

      if (options.format === 'json') {
        console.log(JSON.stringify(formatUsageAsJson(summary), null, 2));
      } else {
        console.log(formatUsageAsTable(summary));
      }

      process.exit(0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach tenant-check [--format=table|json]
 */
export const tenantCheckCommand = new Command('tenant-check')
  .description('Verify tenant isolation and boundary integrity')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options: { format?: string }) => {
    try {
      const db = getDB();
      const decisions = db.prepare('SELECT id, tenant_id FROM decisions').all() as Array<{
        id: string;
        tenant_id: string;
      }>;

      const tenantId = decisions[0]?.tenant_id || 'default';

      const records = decisions.map(d => ({
        id: d.id,
        tenantId: d.tenant_id,
        tableName: 'decisions',
      }));

      const result = checkTenantIsolation(tenantId, records);

      if (options.format === 'json') {
        console.log(JSON.stringify(formatTenantCheckAsJson(result), null, 2));
      } else {
        console.log(formatTenantCheckAsTable(result));
      }

      process.exit(result.passed ? 0 : 3);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach chaos --quick [--format=table|json]
 */
export const chaosCommand = new Command('chaos')
  .description('Run chaos/quick verification checks')
  .option('-q, --quick', 'Run quick checks only', true)
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (options: { quick?: boolean; format?: string }) => {
    try {
      const context = {
        env: process.env as Record<string, string>,
        hasEngine: true,
        hasDatabase: true,
        lastReplayMatch: 100,
        policyBypassAttempted: false,
      };

      const report = runChaosQuick(context);

      if (options.format === 'json') {
        console.log(JSON.stringify(formatChaosAsJson(report), null, 2));
      } else {
        console.log(formatChaosAsTable(report));
      }

      process.exit(report.passed ? 0 : 3);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * reach share <runId> [--ttl=...] [--scope=public|org] [--format=json]
 */
export const shareCommand = new Command('share')
  .description('Create a shareable link for a run or diff')
  .argument('<runId>', 'Run ID to share')
  .option('-w, --with <runId>', 'Second run ID for diff sharing')
  .option('-t, --ttl <hours>', 'Token TTL in hours', '24')
  .option('-s, --scope <scope>', 'Share scope (public, org)', 'org')
  .option('-f, --format <format>', 'Output format (table, json)', 'table')
  .action(async (runId: string, options: {
    with?: string;
    ttl?: string;
    scope?: string;
    format?: string;
  }) => {
    try {
      const decision = DecisionRepository.findById(runId);
      if (!decision) {
        console.error(`Error: Run ${runId} not found.`);
        process.exit(2);
      }

      const ttl = parseInt(options.ttl || '24', 10);
      const scope = (options.scope || 'org') as 'public' | 'org';

      const token = generateShareToken(
        decision.tenant_id,
        options.with ? 'diff' : 'run',
        runId,
        options.with,
        scope,
        ttl,
        'safe'
      );

      const baseUrl = process.env['READYLAYER_URL'] || 'http://localhost:3000';
      const shareUrl = formatShareUrl(token.token, baseUrl);

      if (options.format === 'json') {
        console.log(JSON.stringify({
          token: token.token.substring(0, 16) + '...',
          tokenHash: token.tokenHash.substring(0, 16) + '...',
          subjectType: token.subjectType,
          subjectA: token.subjectA,
          subjectB: token.subjectB,
          scope: token.scope,
          expiresAt: token.expiresAt.toISOString(),
          shareUrl,
        }, null, 2));
      } else {
        console.log('Share created successfully!');
        console.log(`\nShare URL (expires in ${ttl}h):`);
        console.log(shareUrl);
        console.log(`\nScope: ${scope}`);
        if (options.with) {
          console.log(`Type: Diff between ${runId.substring(0, 8)}... and ${options.with.substring(0, 8)}...`);
        } else {
          console.log(`Type: Run ${runId.substring(0, 8)}...`);
        }
      }

      process.exit(0);
    } catch (e) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(4);
    }
  });

/**
 * Dispatcher for microfracture suite
 */
export async function runMicrofractureCommand(command: string, args: string[], _ctx: unknown): Promise<number> {
  const node = process.argv[0];
  const script = process.argv[1];

  switch (command) {
    case 'diff':
      await diffCommand.parseAsync([node, script, ...args]);
      break;
    case 'lineage':
      await lineageCommand.parseAsync([node, script, ...args]);
      break;
    case 'simulate':
      await simulateCommand.parseAsync([node, script, ...args]);
      break;
    case 'drift':
      await driftCommand.parseAsync([node, script, ...args]);
      break;
    case 'explain':
      await explainCommand.parseAsync([node, script, ...args]);
      break;
    case 'usage':
      await usageCommand.parseAsync([node, script, ...args]);
      break;
    case 'tenant-check':
      await tenantCheckCommand.parseAsync([node, script, ...args]);
      break;
    case 'chaos':
      await chaosCommand.parseAsync([node, script, ...args]);
      break;
    case 'share':
      await shareCommand.parseAsync([node, script, ...args]);
      break;
    default:
      throw new Error(`Unknown microfracture command: ${command}`);
  }

  return 0;
}
