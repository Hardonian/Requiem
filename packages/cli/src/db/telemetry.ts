import { Command } from 'commander';
import { DecisionRepository } from '../db/decisions';

export const telemetry = new Command('telemetry')
  .description('Show real-time usage stats (sliding window)')
  .option('-w, --window <seconds>', 'Sliding window size in seconds', '60')
  .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '2')
  .option('--json', 'Output as JSON (single snapshot)')
  .action(async (options: { window: string; refresh: string; json?: boolean }) => {
    const windowSec = parseInt(options.window, 10) || 60;
    const refreshSec = parseInt(options.refresh, 10) || 2;

    const runLoop = async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowSec * 1000).toISOString();

      const decisions = DecisionRepository.list({ createdAfter: windowStart });

      let totalTokens = 0;
      let totalCost = 0;
      let requestCount = decisions.length;

      for (const d of decisions) {
        if (d.usage) {
          try {
            const u = JSON.parse(d.usage);
            totalTokens += (u.prompt_tokens || 0) + (u.completion_tokens || 0);
            totalCost += (u.cost_usd || 0);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }

      const tps = totalTokens / windowSec;
      const cpm = (totalCost / windowSec) * 60;
      const rpm = (requestCount / windowSec) * 60;

      if (options.json) {
        console.log(JSON.stringify({
          timestamp: now.toISOString(),
          window_seconds: windowSec,
          requests: requestCount,
          total_tokens: totalTokens,
          total_cost_usd: totalCost,
          rates: {
            tokens_per_sec: tps,
            cost_per_min: cpm,
            requests_per_min: rpm
          }
        }, null, 2));
        return;
      }

      // Clear console and print stats
      console.clear();
      console.log(`\n📡 REQUIEM TELEMETRY (Live)`);
      console.log(`   Window: Last ${windowSec}s | Refresh: ${refreshSec}s`);
      console.log('────────────────────────────────────────');
      console.log(`Requests:      ${requestCount}`);
      console.log(`Tokens:        ${totalTokens.toLocaleString()}`);
      console.log(`Cost:          $${totalCost.toFixed(6)}`);
      console.log('────────────────────────────────────────');
      console.log(`Throughput:    ${tps.toFixed(2)} tokens/sec`);
      console.log(`Burn Rate:     $${cpm.toFixed(4)} / min`);
      console.log(`Load:          ${rpm.toFixed(1)} req / min`);
      console.log('────────────────────────────────────────');
      console.log(`Press Ctrl+C to exit...`);
    };

    if (options.json) {
      await runLoop();
    } else {
      await runLoop();
      setInterval(runLoop, refreshSec * 1000);
    }
  });
