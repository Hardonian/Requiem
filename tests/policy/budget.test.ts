import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DefaultBudgetChecker, AtomicBudgetChecker } from '../../packages/ai/src/policy/budgets.js';

describe('budget enforcement', () => {
  it('denies when budget not configured', async () => {
    const checker = new DefaultBudgetChecker(false);
    const res = await checker.check('tenant-missing', 50);
    assert.equal(res.allowed, false);
  });

  it('denies over-budget attempts before execution', async () => {
    const checker = new AtomicBudgetChecker({ 'tenant-budget': { maxCostCents: 10, windowSeconds: 3600 } });
    const ok = await checker.check('tenant-budget', 5);
    assert.equal(ok.allowed, true);
    const deny = await checker.check('tenant-budget', 6);
    assert.equal(deny.allowed, false);
  });
});
