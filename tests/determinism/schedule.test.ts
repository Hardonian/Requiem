import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

type Step = { id: string; deps: string[] };

function deterministicOrder(steps: Step[]): string[] {
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();
  for (const s of steps) {
    indeg.set(s.id, indeg.get(s.id) ?? 0);
    for (const d of s.deps) {
      succ.set(d, [...(succ.get(d) ?? []), s.id]);
      indeg.set(s.id, (indeg.get(s.id) ?? 0) + 1);
    }
  }
  const ready = [...indeg.entries()].filter(([, n]) => n === 0).map(([k]) => k).sort();
  const out: string[] = [];
  while (ready.length) {
    const cur = ready.shift()!;
    out.push(cur);
    for (const s of succ.get(cur) ?? []) {
      indeg.set(s, (indeg.get(s) ?? 0) - 1);
      if (indeg.get(s) === 0) {
        ready.push(s);
        ready.sort();
      }
    }
  }
  return out;
}

describe('deterministic schedule invariant', () => {
  it('chooses lexicographic tie-breakers deterministically', () => {
    const steps: Step[] = [
      { id: 'b', deps: [] },
      { id: 'a', deps: [] },
      { id: 'c', deps: ['a', 'b'] },
    ];
    assert.deepEqual(deterministicOrder(steps), ['a', 'b', 'c']);
    assert.deepEqual(deterministicOrder(steps), deterministicOrder(steps));
  });
});
