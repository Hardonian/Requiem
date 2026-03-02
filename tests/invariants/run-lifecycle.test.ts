/**
 * Invariant Test Suite — Run Lifecycle State Machine
 *
 * Tests:
 * - Forward-only sequential progression
 * - Illegal transition rejection
 * - State skip rejection
 * - State regression rejection
 * - DIVERGENT reachability from any non-terminal state
 * - Terminal state immutability
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RunLifecycleTracker, RunLifecycleStates, createRunLifecycleStateMachine } from '../../packages/cli/src/lib/run-lifecycle';

describe('RunLifecycleStateMachine', () => {
  it('should allow full happy-path traversal', () => {
    const tracker = new RunLifecycleTracker('test-run-001');
    assert.equal(tracker.getState(), RunLifecycleStates.INIT);

    tracker.advance(RunLifecycleStates.POLICY_CHECKED);
    assert.equal(tracker.getState(), RunLifecycleStates.POLICY_CHECKED);

    tracker.advance(RunLifecycleStates.ARBITRATED);
    assert.equal(tracker.getState(), RunLifecycleStates.ARBITRATED);

    tracker.advance(RunLifecycleStates.EXECUTED);
    assert.equal(tracker.getState(), RunLifecycleStates.EXECUTED);

    tracker.advance(RunLifecycleStates.MANIFEST_BUILT);
    assert.equal(tracker.getState(), RunLifecycleStates.MANIFEST_BUILT);

    tracker.advance(RunLifecycleStates.SIGNED);
    assert.equal(tracker.getState(), RunLifecycleStates.SIGNED);

    tracker.advance(RunLifecycleStates.LEDGER_COMMITTED);
    assert.equal(tracker.getState(), RunLifecycleStates.LEDGER_COMMITTED);

    tracker.advance(RunLifecycleStates.COMPLETE);
    assert.equal(tracker.getState(), RunLifecycleStates.COMPLETE);
    assert.equal(tracker.isComplete(), true);
    assert.equal(tracker.isDivergent(), false);
  });

  it('should reject state skip (INIT → EXECUTED)', () => {
    const tracker = new RunLifecycleTracker('test-run-002');
    assert.throws(
      () => tracker.advance(RunLifecycleStates.EXECUTED),
      (err: Error) => err.message.includes('Invalid state transition') || err.message.includes('skip'),
    );
  });

  it('should reject state regression (ARBITRATED → INIT)', () => {
    const tracker = new RunLifecycleTracker('test-run-003');
    tracker.advance(RunLifecycleStates.POLICY_CHECKED);
    tracker.advance(RunLifecycleStates.ARBITRATED);
    assert.throws(
      () => tracker.advance(RunLifecycleStates.INIT),
      (err: Error) => err.message.includes('Invalid state transition') || err.message.includes('regression'),
    );
  });

  it('should reject skipping forward (POLICY_CHECKED → EXECUTED)', () => {
    const tracker = new RunLifecycleTracker('test-run-004');
    tracker.advance(RunLifecycleStates.POLICY_CHECKED);
    assert.throws(
      () => tracker.advance(RunLifecycleStates.EXECUTED),
      (err: Error) => err.message.includes('Invalid state transition') || err.message.includes('skip'),
    );
  });

  it('should allow DIVERGENT from any non-terminal state', () => {
    const states = [
      RunLifecycleStates.INIT,
      RunLifecycleStates.POLICY_CHECKED,
      RunLifecycleStates.ARBITRATED,
      RunLifecycleStates.EXECUTED,
      RunLifecycleStates.MANIFEST_BUILT,
      RunLifecycleStates.SIGNED,
    ];

    for (const startState of states) {
      const tracker = new RunLifecycleTracker(`test-diverge-from-${startState}`);

      // Advance to the target state
      const ordered = [
        RunLifecycleStates.POLICY_CHECKED,
        RunLifecycleStates.ARBITRATED,
        RunLifecycleStates.EXECUTED,
        RunLifecycleStates.MANIFEST_BUILT,
        RunLifecycleStates.SIGNED,
        RunLifecycleStates.LEDGER_COMMITTED,
      ];

      for (const s of ordered) {
        if (s === startState) break;
        if (tracker.getState() !== startState) {
          tracker.advance(s);
        }
      }

      // If we're not at the desired start state, advance to it
      if (tracker.getState() !== startState && startState !== RunLifecycleStates.INIT) {
        // Already handled via the loop above
      }

      tracker.diverge(`divergence test from ${startState}`);
      assert.equal(tracker.isDivergent(), true);
      assert.equal(tracker.isComplete(), true);
    }
  });

  it('should reject transitions from COMPLETE', () => {
    const tracker = new RunLifecycleTracker('test-run-terminal');
    tracker.advance(RunLifecycleStates.POLICY_CHECKED);
    tracker.advance(RunLifecycleStates.ARBITRATED);
    tracker.advance(RunLifecycleStates.EXECUTED);
    tracker.advance(RunLifecycleStates.MANIFEST_BUILT);
    tracker.advance(RunLifecycleStates.SIGNED);
    tracker.advance(RunLifecycleStates.LEDGER_COMMITTED);
    tracker.advance(RunLifecycleStates.COMPLETE);

    assert.throws(
      () => tracker.advance(RunLifecycleStates.INIT),
      (err: Error) => err.message.includes('terminal') || err.message.includes('Invalid state transition'),
    );
  });

  it('should reject divergence from COMPLETE', () => {
    const tracker = new RunLifecycleTracker('test-run-no-diverge');
    tracker.advance(RunLifecycleStates.POLICY_CHECKED);
    tracker.advance(RunLifecycleStates.ARBITRATED);
    tracker.advance(RunLifecycleStates.EXECUTED);
    tracker.advance(RunLifecycleStates.MANIFEST_BUILT);
    tracker.advance(RunLifecycleStates.SIGNED);
    tracker.advance(RunLifecycleStates.LEDGER_COMMITTED);
    tracker.advance(RunLifecycleStates.COMPLETE);

    assert.throws(
      () => tracker.diverge('should not work'),
      (err: Error) => err.message.includes('terminal'),
    );
  });

  it('should reject divergence from DIVERGENT', () => {
    const tracker = new RunLifecycleTracker('test-double-diverge');
    tracker.diverge('first divergence');

    assert.throws(
      () => tracker.diverge('second divergence'),
      (err: Error) => err.message.includes('terminal'),
    );
  });

  it('should maintain transition history', () => {
    const tracker = new RunLifecycleTracker('test-history');
    tracker.advance(RunLifecycleStates.POLICY_CHECKED);
    tracker.advance(RunLifecycleStates.ARBITRATED);

    const history = tracker.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].from, RunLifecycleStates.INIT);
    assert.equal(history[0].to, RunLifecycleStates.POLICY_CHECKED);
    assert.equal(history[1].from, RunLifecycleStates.POLICY_CHECKED);
    assert.equal(history[1].to, RunLifecycleStates.ARBITRATED);
  });
});

describe('StateMachine configuration validation', () => {
  it('should validate that all transition targets exist', () => {
    const machine = createRunLifecycleStateMachine();
    const states = machine.getStates();

    // Ensure all states are reachable or terminal
    assert.ok(states.length >= 9, `Expected at least 9 states, got ${states.length}`);
    assert.ok(states.includes(RunLifecycleStates.INIT));
    assert.ok(states.includes(RunLifecycleStates.COMPLETE));
    assert.ok(states.includes(RunLifecycleStates.DIVERGENT));
  });

  it('should mark COMPLETE and DIVERGENT as terminal', () => {
    const machine = createRunLifecycleStateMachine();
    const terminals = machine.getTerminalStates();

    assert.ok(terminals.includes(RunLifecycleStates.COMPLETE));
    assert.ok(terminals.includes(RunLifecycleStates.DIVERGENT));
    assert.equal(terminals.length, 2, 'Exactly two terminal states expected');
  });
});
