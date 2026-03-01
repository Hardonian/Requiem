import { Command } from 'commander';
import { DecisionRepository } from '../db/decisions';
import { hash } from '../lib/hash';
import { AgentStep } from '../lib/agent-runner';

export const trace = new Command('trace')
  .description('Visualize the decision trace for a specific execution ID')
  .argument('<executionId>', 'The ID of the execution/decision to inspect')
  .option('-j, --json', 'Output the raw trace as JSON')
  .action((executionId: string, options: { json?: boolean }) => {
    const decision = DecisionRepository.findById(executionId);

    if (!decision) {
      console.error(`❌ Execution ID '${executionId}' not found.`);
      process.exit(1);
    }

    // Parse Trace
    let traceSteps: AgentStep[] = [];
    try {
      if (decision.decision_trace) {
        traceSteps = JSON.parse(decision.decision_trace);
      }
    } catch (e) {
      console.error('❌ Failed to parse decision trace JSON.');
      process.exit(1);
    }

    // JSON Output Mode
    if (options.json) {
      console.log(JSON.stringify(traceSteps, null, 2));
      return;
    }

    // Parse Usage
    let usage = { prompt_tokens: 0, completion_tokens: 0, cost_usd: 0 };
    try {
      if (decision.usage) {
        usage = JSON.parse(decision.usage);
      }
    } catch (e) {
      // Ignore usage parse errors for display
    }

    // Header
    console.log('\n🔍 REQUIEM TRACE INSPECTOR');
    console.log('────────────────────────────────────────');
    console.log(`ID:          ${decision.id}`);
    console.log(`Tenant:      ${decision.tenant_id}`);
    console.log(`Timestamp:   ${decision.created_at}`);
    console.log(`Status:      ${decision.status}`);
    console.log(`Latency:     ${decision.execution_latency != null ? decision.execution_latency.toFixed(2) + 'ms' : 'N/A'}`);
    console.log(`Source:      ${decision.source_type} (${decision.source_ref})`);
    console.log(`Total Cost:  $${usage.cost_usd.toFixed(6)}`);
    console.log('────────────────────────────────────────\n');

    // Waterfall
    if (traceSteps.length === 0) {
      console.log('No trace steps recorded for this execution.');
    } else {
      const tableData = traceSteps.map((step, idx) => {
        const inputHash = hash(JSON.stringify(step.input)).substring(0, 7);
        const outputHash = step.output ? hash(JSON.stringify(step.output)).substring(0, 7) : '(null)';
        const stepCost = step.usage ? `$${step.usage.cost_usd.toFixed(6)}` : '-';

        return {
          '#': idx + 1,
          'Tool': step.tool,
          'Input Sig': inputHash,
          'Output Sig': outputHash,
          'Cost': stepCost,
          'Status': step.error ? '❌ FAIL' : '✅ OK'
        };
      });

      console.table(tableData);
    }
    console.log(''); // Trailing newline
  });
