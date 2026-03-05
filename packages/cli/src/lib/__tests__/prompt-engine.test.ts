import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYoloPlan, resolveSlashCommand, runPromptById, validatePrompt, listPrompts } from '../prompt-engine.js';

test('lists and validates prompt artifacts', () => {
  const prompts = listPrompts();
  assert.ok(prompts.length > 0);
  const first = prompts[0];
  assert.deepEqual(validatePrompt(first), []);
});

test('resolves slash commands and runs prompt deterministically', () => {
  const promptId = resolveSlashCommand('/review');
  const runA = runPromptById(promptId, { module: 'packages/cli', focus: 'security' });
  const runB = runPromptById(promptId, { module: 'packages/cli', focus: 'security' });
  assert.equal(runA.trace_id, runB.trace_id);
  assert.match(runA.output.rendered, /packages\/cli/);
});

test('builds yolo plan with required guardrails', () => {
  const plan = buildYoloPlan('fix');
  assert.ok(plan.executed_commands.includes('pnpm lint'));
  assert.match(plan.auto_commit_message ?? '', /\[agent-fix\]/);
});
