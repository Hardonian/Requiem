import { Command } from 'commander';
import { DecisionRepository } from '../db/decisions';
import { randomBytes } from 'crypto';

export const stress = new Command('stress')
  .description('Generate synthetic load for testing telemetry')
  .option('-d, --duration <seconds>', 'Duration in seconds', '5')
  .option('-r, --rate <rps>', 'Requests per second', '5')
  .option('--tenant <id>', 'Tenant ID', 'stress-test')
  .action(async (options: { duration: string; rate: string; tenant: string }) => {
    const duration = parseInt(options.duration, 10);
    const rate = parseInt(options.rate, 10);
    const tenantId = options.tenant;

    console.log(`\n🔥 REQUIEM STRESS TEST`);
    console.log(`   Target: ${tenantId}`);
    console.log(`   Rate:   ${rate} req/s`);
    console.log(`   Time:   ${duration}s`);
    console.log('────────────────────────────────────────');

    const intervalMs = 1000 / rate;
    const endTime = Date.now() + duration * 1000;
    let count = 0;

    const generate = () => {
      const latency = Math.floor(Math.random() * 500) + 50; // 50-550ms
      const tokens = Math.floor(Math.random() * 1000) + 100;
      const cost = (tokens / 1000) * 0.002; // Approx $0.002 per 1k tokens

      DecisionRepository.create({
        tenant_id: tenantId,
        source_type: 'stress_test',
        source_ref: `synthetic-${randomBytes(4).toString('hex')}`,
        input_fingerprint: randomBytes(32).toString('hex'),
        decision_input: { prompt: 'synthetic load' },
        decision_output: { response: 'synthetic response' },
        usage: { prompt_tokens: tokens, completion_tokens: 0, cost_usd: cost },
        status: 'evaluated',
        execution_latency: latency,
        outcome_status: Math.random() > 0.1 ? 'success' : 'failure'
      });

      process.stdout.write('.');
      count++;
    };

    while (Date.now() < endTime) {
      const start = Date.now();
      generate();
      const elapsed = Date.now() - start;
      const wait = Math.max(0, intervalMs - elapsed);
      await new Promise(r => setTimeout(r, wait));
    }

    console.log(`\n\n✅ Completed. Generated ${count} decisions.`);
  });
