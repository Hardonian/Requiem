#!/usr/bin/env tsx
/**
 * verify-agent-quality.ts — AI eval regression gate
 *
 * Runs all eval cases from eval/cases/ against registered skills/tools.
 * Exits non-zero if any case fails.
 *
 * Run: npx tsx scripts/verify-agent-quality.ts
 */

import { runEvalHarness } from '../packages/ai/src/eval/harness.js';
import { loadEvalCases } from '../packages/ai/src/eval/cases.js';

// Bootstrap
import '../packages/ai/src/tools/builtins/system.echo.js';
import '../packages/ai/src/tools/builtins/system.health.js';
import '../packages/ai/src/skills/baseline.js';

// ─── Inline Test Cases ────────────────────────────────────────────────────────
// These are always run (supplement the file-based cases)

import type { EvalCase } from '../packages/ai/src/eval/cases.js';

const INLINE_CASES: EvalCase[] = [
  {
    id: 'tool.echo.basic',
    description: 'system.echo returns input payload unchanged',
    tool: 'system.echo',
    input: { payload: 'hello-eval' },
    evalMethod: 'contains',
    requiredKeys: ['payload', 'echoed_at'],
  },
  {
    id: 'tool.health.status',
    description: 'system.health returns status:ok',
    tool: 'system.health',
    input: {},
    evalMethod: 'contains',
    requiredKeys: ['status', 'tools_registered', 'version'],
  },
  {
    id: 'skill.tool_smoke.run',
    description: 'skill.tool_smoke runs without error',
    skill: 'skill.tool_smoke',
    input: {},
    evalMethod: 'schema_valid',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n=== verify-agent-quality ===\n');

  // Load file-based cases
  const fileCases = loadEvalCases();
  const allCases = [...INLINE_CASES, ...fileCases];

  console.log(`Running ${allCases.length} eval cases (${INLINE_CASES.length} inline, ${fileCases.length} from files)\n`);

  const result = await runEvalHarness(allCases);

  console.log('\n─── Results ───────────────────────────────────────────');
  console.log(`Total:  ${result.totalCases}`);
  console.log(`Passed: ${result.passed}`);
  console.log(`Failed: ${result.failed}`);
  console.log('───────────────────────────────────────────────────────');

  if (result.failed > 0) {
    console.log('\nFailed cases:');
    for (const r of result.results.filter(r => !r.passed)) {
      console.error(`  ✗ [${r.caseId}] ${r.description}`);
      if (r.error) console.error(`    Error: ${r.error}`);
      if (r.diffs?.length) {
        for (const d of r.diffs) {
          console.error(`    Diff at ${d.path}: expected=${JSON.stringify(d.expected)} actual=${JSON.stringify(d.actual)}`);
        }
      }
    }
    process.exit(1);
  }

  console.log('\nAll eval cases passed.\n');
}

main().catch(err => {
  console.error('verify-agent-quality FATAL:', err);
  process.exit(1);
});
