import assert from 'node:assert/strict';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildPromptGraph,
  ensurePromptOsScaffold,
  enforcePromptPolicy,
  runSwarm,
} from '../packages/cli/src/lib/prompt-os.js';
import { listPrompts } from '../packages/cli/src/lib/prompt-engine.js';

ensurePromptOsScaffold();

const graph = buildPromptGraph();
assert.equal(graph.has_cycle, false, 'prompt graph must be acyclic');
assert.ok(graph.nodes.length > 0, 'prompt graph must include nodes');

const prompts = listPrompts();
const violations = prompts.flatMap((p) => enforcePromptPolicy(p));
assert.equal(violations.length, 0, `policy violations found: ${violations.join(', ')}`);

const runA = runSwarm({ change: 'lint cleanup' });
const runB = runSwarm({ change: 'lint cleanup' });
assert.equal(runA.roles.length, 5, 'swarm must execute all roles');
assert.deepEqual(
  runA.roles.map((r) => r.prompt_id),
  runB.roles.map((r) => r.prompt_id),
  'swarm role coordination must be deterministic in prompt ordering',
);

const logsDir = 'logs/prompts';
if (existsSync(logsDir)) {
  for (const file of readdirSync(logsDir)) {
    if (file.endsWith('.log.json') || file === 'audit.ndjson' || file === 'metrics.ndjson') {
      unlinkSync(join(logsDir, file));
    }
  }
}
const artifactsDir = 'logs/prompts/artifacts';
if (existsSync(artifactsDir)) {
  for (const file of readdirSync(artifactsDir)) {
    if (file.endsWith('.json')) {
      unlinkSync(join(artifactsDir, file));
    }
  }
}

console.log('prompt-os checks passed');
