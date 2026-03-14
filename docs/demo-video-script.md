# 90–120s Demo Video Script

Audience: engineers evaluating technical credibility.
Tone: direct, no hype.

## Scene 1 — Start (0:00–0:15)

**Screen:** terminal at repo root.

**Narration:**
"This is Requiem, a deterministic execution runtime for agent workflows. In under two minutes we'll run a workflow, inspect evidence, replay it, and verify integrity artifacts."

**Commands:**
```bash
pnpm install
pnpm build
```

## Scene 2 — Run Demo Workflow (0:15–0:35)

**Screen:** run built-in demo.

**Narration:**
"First, we run the repo's demo verification flow. This executes doctor checks, plan verification, plan hashing, and run/log integrity checks."

**Command:**
```bash
pnpm verify:demo
```

## Scene 3 — Inspect Execution (0:35–0:55)

**Screen:** show generated demo artifacts.

**Narration:**
"Now we inspect the generated artifacts, including run identifiers and receipt material."

**Commands:**
```bash
cat demo_artifacts/demo-summary.json
cat demo_artifacts/demo-receipt.json
```

## Scene 4 — Generate/Inspect Proofpack (0:55–1:15)

**Screen:** open proofpack schema/docs and proof artifacts directory.

**Narration:**
"Requiem uses proof-oriented artifacts. The proofpack schema defines what is cryptographically bound to an execution."

**Commands:**
```bash
ls proofpacks
cat docs/proofpacks.md
```

## Scene 5 — Replay Execution (1:15–1:35)

**Screen:** replay command and diff command.

**Narration:**
"Replay reconstructs prior execution paths from stored artifacts. The goal is reproducibility and drift detection, not just rerun."

**Commands (example surface):**
```bash
requiem replay run <run_id>
requiem diff replay <run_a> <run_b>
```

## Scene 6 — Verify Proof/Integrity (1:35–1:55)

**Screen:** verification commands.

**Narration:**
"Finally, we verify integrity surfaces. If hashes or evidence chains do not match, verification fails."

**Commands:**
```bash
requiem log verify
requiem cas verify
```

## Closing (1:55–2:00)

**Narration:**
"That is the core loop: run, inspect, prove, replay, verify."
