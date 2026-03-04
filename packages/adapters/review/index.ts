import { createHash } from 'node:crypto';

import type { CorrectionProposal, ProofTriggerEvent, ReviewAdapter, ReviewArtifact } from '../../review/types.js';
import { ClaudeReviewAdapter } from './review-claude.js';
import { CodellamaReviewAdapter } from './review-codellama.js';
import { CopilotReviewAdapter } from './review-copilot.js';
import { GeminiReviewAdapter } from './review-gemini.js';
import { QwenReviewAdapter } from './review-qwen.js';
import { SemgrepReviewAdapter } from './review-semgrep.js';

export function createReviewEngines(): ReviewAdapter[] {
  return [
    new CopilotReviewAdapter(),
    new ClaudeReviewAdapter(),
    new GeminiReviewAdapter(),
    new QwenReviewAdapter(),
    new CodellamaReviewAdapter(),
    new SemgrepReviewAdapter(),
  ];
}

export function runReviewPipeline(engine: ReviewAdapter, trigger: ProofTriggerEvent): { review: ReviewArtifact; proposal: CorrectionProposal; proposalBundleCas: string } {
  const review = engine.analyze(trigger.proof_pack_cas, trigger.context_artifacts);
  const source_review_cas = createHash('sha256').update(JSON.stringify(review)).digest('hex');
  const proposal: CorrectionProposal = {
    source_review_cas,
    patch_artifacts: review.suggested_patches,
    impacted_files: review.findings.map(f => f.file).filter((f): f is string => Boolean(f)),
  };
  const proposalBundleCas = createHash('sha256').update(JSON.stringify(proposal)).digest('hex');
  return { review, proposal, proposalBundleCas };
}
