import type { CorrectionProposal, ReviewArtifact } from '../../review/types.js';

export function buildCorrectionPullRequestBody(input: {
  proposalBundleCas: string;
  proofPackCas: string;
  lineageGraph: string;
  replayResult: 'pass' | 'fail';
  review: ReviewArtifact;
  proposal: CorrectionProposal;
}): string {
  return [
    '## Auto Correction Proposal',
    '',
    `- proof cover: ${input.proofPackCas}`,
    `- lineage graph: ${input.lineageGraph}`,
    `- replay result: ${input.replayResult}`,
    `- correction proof pack: ${input.proposalBundleCas}`,
    '',
    '### Findings',
    ...input.review.findings.map(f => `- [${f.severity}] ${f.rule}: ${f.message}`),
    '',
    '### Patch artifacts',
    ...input.proposal.patch_artifacts.map(p => `- ${p}`),
  ].join('\n');
}

export const AUTO_CORRECTION_PR_TITLE = 'Auto Correction Proposal (Deterministically Verified)';
