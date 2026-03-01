import { Command } from 'commander';
import { DecisionRepository } from '../db/decisions';

export const stats = new Command('stats')
  .description('Display aggregated telemetry from the DecisionRepository')
  .option('--tenant <id>', 'Filter by tenant ID')
  .option('--json', 'Output as JSON')
  .action((options: { tenant?: string; json?: boolean }) => {
    const data = DecisionRepository.getStats(options.tenant);

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    console.log('\n📊 REQUIEM TELEMETRY');
    console.log('────────────────────────────────────────');
    console.log(`Total Decisions:  ${data.total_decisions}`);
    console.log(`Avg Latency:      ${data.avg_latency_ms.toFixed(2)} ms`);
    console.log(`Total Cost:       $${data.total_cost_usd.toFixed(6)}`);
    console.log(`Success Rate:     ${(data.success_rate * 100).toFixed(1)}%`);
    console.log('────────────────────────────────────────\n');
  });
