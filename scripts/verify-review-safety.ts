import fs from 'node:fs';

import { createReviewEngines, runReviewPipeline } from '../packages/adapters/review/index.js';
import { validateTriggerCapabilities } from '../packages/review/triggers.js';

function verifyNoDirectWrites(): void {
  const files = fs.readdirSync('packages/adapters/review').filter(name => name.endsWith('.ts'));
  const violating = files.filter(file => {
    const content = fs.readFileSync(`packages/adapters/review/${file}`, 'utf8');
    return content.includes('writeFile') || content.includes('appendFile') || content.includes('rmSync');
  });
  if (violating.length > 0) {
    throw new Error(`Review safety violation: direct file mutation API usage in ${violating.join(', ')}`);
  }
}

function verifyPipeline(): void {
  const engines = createReviewEngines();
  const trigger = {
    proof_pack_cas: 'cas:proof123',
    trigger_reason: 'manual' as const,
    context_artifacts: ['cas:diff1'],
  };
  if (!validateTriggerCapabilities(trigger, ['review:run'])) {
    throw new Error('Capability checks failed for review trigger.');
  }

  const { proposalBundleCas } = runReviewPipeline(engines[0], trigger);
  if (!proposalBundleCas) {
    throw new Error('Missing proposal bundle CAS output.');
  }
}

verifyNoDirectWrites();
verifyPipeline();
process.stdout.write('review safety checks passed\n');
