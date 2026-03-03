# Pull Request

## 🏁 Summary

**Type**: [e.g., Bug Fix, Feature, Performance, Refactor]
**Core Invariant Impact**: [Describe how this affects `Provable Execution`, `Enforced Governance`, or `Replayable Outcomes`]

## ⚙️ Changes

- [ ] List significant change 1
- [ ] List significant change 2

## 🛡️ Verification Results (REQUIRED)

PRs will **not** be merged without a passing result from the following commands:

- [ ] `pnpm run verify`: Passed (Lint, Typecheck, Boundaries)
- [ ] `pnpm run verify:ci`: Passed (Determinism, Integration, Drift)
- [ ] `pnpm reach chaos --quick`: Passed (Survival)

---

## 📈 Performance & Drift

- [ ] `pnpm run verify:ratchet`: No regression detected.
- [ ] `pnpm reach drift`: 0 drift on baseline executions.

## 📄 Documentation Truth

- [ ] `npx tsx scripts/docs-truth-gate.ts`: Passed (README command sync).
- [ ] `npx tsx scripts/claims-linter.ts`: Passed (No aspirational claims).

---

## 🧐 Rationale (Determinism First)

*Why is this change necessary? How does it reduce entropy?*
