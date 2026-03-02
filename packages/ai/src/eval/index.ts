/**
 * @fileoverview Eval module public exports.
 */

export {
  runEvalCase,
  runEvalHarness,
  runAdversarialSuite,
  runTenantIsolationSuite,
  runPerformanceSuite,
  generateReport,
  type EvalRunResult,
  type HarnessResult,
  type TestReport,
} from './harness.js';
export { diff, diffValues, type DiffResult, type DiffEntry } from './diff.js';
export { loadEvalCases, loadGoldens, type EvalCase, type EvalGolden, type EvalMethod } from './cases.js';
