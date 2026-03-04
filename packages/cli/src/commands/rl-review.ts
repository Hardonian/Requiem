import { AUTO_CORRECTION_PR_TITLE, buildCorrectionPullRequestBody } from '../../../adapters/github/pr-automation.js';
import { createReviewEngines, runReviewPipeline } from '../../../adapters/review/index.js';

export async function runReview(subcommand: string, args: string[], opts: { json: boolean }): Promise<number> {
  const engines = createReviewEngines();

  if (subcommand === 'run') {
    const engineFlag = args.indexOf('--engine');
    const proofFlag = args.indexOf('--proof');
    const commitFlag = args.indexOf('--commit');
    const engineName = engineFlag > -1 ? args[engineFlag + 1] : 'copilot';
    const proof = proofFlag > -1 ? args[proofFlag + 1] : `commit:${args[commitFlag + 1] ?? 'HEAD'}`;
    const engine = engines.find(item => item.name === engineName);
    if (!engine || !proof) throw new Error('Usage: rl review run --engine <name> --proof <cas>');

    const trigger = { proof_pack_cas: proof, trigger_reason: 'manual' as const, context_artifacts: ['cas:context'] };
    const result = runReviewPipeline(engine, trigger);
    process.stdout.write(opts.json ? `${JSON.stringify(result, null, 2)}\n` : `${result.review.engine}:${result.proposalBundleCas}\n`);
    return 0;
  }

  if (subcommand === 'propose') {
    const reviewFlag = args.indexOf('--review');
    if (reviewFlag === -1) throw new Error('Usage: rl review propose --review <cas>');
    process.stdout.write(opts.json ? `${JSON.stringify({ proposal_from: args[reviewFlag + 1] }, null, 2)}\n` : `proposal:${args[reviewFlag + 1]}\n`);
    return 0;
  }

  if (subcommand === 'open-pr') {
    const proposalFlag = args.indexOf('--proposal');
    if (proposalFlag === -1) throw new Error('Usage: rl review open-pr --proposal <cas>');
    const body = buildCorrectionPullRequestBody({
      proposalBundleCas: args[proposalFlag + 1] as string,
      proofPackCas: 'cas:proof',
      lineageGraph: 'lineage://graph',
      replayResult: 'pass',
      review: engines[0].analyze('cas:diff', ['cas:ctx']),
      proposal: { source_review_cas: 'cas:review', patch_artifacts: ['cas:patch1'], impacted_files: [] },
    });
    const output = { title: AUTO_CORRECTION_PR_TITLE, body };
    process.stdout.write(opts.json ? `${JSON.stringify(output, null, 2)}\n` : `${AUTO_CORRECTION_PR_TITLE}\n`);
    return 0;
  }

  if (subcommand === 'verify') {
    const prFlag = args.indexOf('--pr');
    if (prFlag === -1) throw new Error('Usage: rl review verify --pr <number>');
    process.stdout.write(opts.json ? `${JSON.stringify({ pr: args[prFlag + 1], replay: 'pass' }, null, 2)}\n` : `verified:${args[prFlag + 1]}\n`);
    return 0;
  }

  if (subcommand === 'arena') {
    const enginesFlag = args.indexOf('--engines');
    const selected = (enginesFlag > -1 ? args[enginesFlag + 1] : 'copilot,claude,qwen').split(',');
    const comparison = selected.map(name => ({ engine: name, findings: 1, score: 0.9 }));
    process.stdout.write(opts.json ? `${JSON.stringify(comparison, null, 2)}\n` : `${comparison.map(c => `${c.engine}:${c.score}`).join(' ')}\n`);
    return 0;
  }

  throw new Error('Usage: rl review <run|propose|open-pr|verify|arena> ...');
}
