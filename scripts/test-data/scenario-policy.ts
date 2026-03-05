import { buildBundle, createSeededRng, exportBundle } from './generator.js';

export function generatePolicyScenario(seed = 5151, count = 40): ReturnType<typeof buildBundle> {
  const rand = createSeededRng(seed);
  const records = Array.from({ length: count }, (_, i) => {
    const risk = Math.round(rand() * 100);
    return {
      case_id: `policy-${i + 1}`,
      tenant: i % 2 === 0 ? 'alpha' : 'beta',
      risk_score: risk,
      expected_action: risk > 70 ? 'deny' : risk > 40 ? 'review' : 'allow',
      tags: [risk % 2 === 0 ? 'even-risk' : 'odd-risk'],
    };
  });
  return buildBundle(seed, 'policy-edge-cases', records);
}

if (process.argv[1]?.includes('scenario-policy')) {
  exportBundle('scripts/test-data/out-policy.json', generatePolicyScenario());
}
