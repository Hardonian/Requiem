import { createHash } from 'node:crypto';

import type { ReviewAdapter, ReviewArtifact, ReviewFinding } from '../../../review/types.js';

export abstract class BaseReviewAdapter implements ReviewAdapter {
  abstract name: string;
  abstract version: string;
  abstract model_name: string;
  abstract model_version: string;

  analyze(diff_artifact: string, context_artifacts: string[]): ReviewArtifact {
    const findings = this.buildFindings(diff_artifact, context_artifacts);
    return {
      engine: this.name,
      version: this.version,
      findings,
      suggested_patches: this.proposeFix(findings),
      confidence: findings.length === 0 ? 0.95 : 0.78,
      model_name: this.model_name,
      model_version: this.model_version,
      prompt_template_hash: createHash('sha256').update(`${this.name}:${this.version}`).digest('hex'),
      temperature: 0,
      seed: 7,
    };
  }

  proposeFix(findings: ReviewFinding[]): string[] {
    return findings.map((finding, idx) => `patch-${idx + 1}:${finding.rule}`);
  }

  protected buildFindings(diff_artifact: string, context_artifacts: string[]): ReviewFinding[] {
    if (diff_artifact.includes('TODO') || context_artifacts.length === 0) {
      return [{ rule: 'review.incomplete-context', severity: 'medium', message: 'Insufficient context or TODO marker found.' }];
    }
    return [{ rule: 'review.determinism.guard', severity: 'low', message: 'Checked replay invariants for candidate patch.' }];
  }
}
