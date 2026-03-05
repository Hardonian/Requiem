import { buildBundle, createSeededRng, exportBundle } from './generator.js';

export function generateFinanceScenario(seed = 4242, count = 32): ReturnType<typeof buildBundle> {
  const rand = createSeededRng(seed);
  const records = Array.from({ length: count }, (_, i) => {
    const debit = Math.round(rand() * 10000) / 100;
    const credit = Math.round(rand() * 10000) / 100;
    return {
      ledger_id: `fin-${i + 1}`,
      debit,
      credit,
      delta: Number((debit - credit).toFixed(2)),
      reconciled: Math.abs(debit - credit) < 0.01,
    };
  });
  return buildBundle(seed, 'finance-reconciliation', records);
}

if (process.argv[1]?.includes('scenario-finance')) {
  exportBundle('scripts/test-data/out-finance.json', generateFinanceScenario());
}
