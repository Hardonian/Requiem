# Demo Scripts: Requiem / Zeo

## 1. The 60s Elevator Pitch (The "Why")

### Scene 1: The Problem (0-15s)

> "AI is running your logic, but how do you know what it actually did? Was it the same twice? Did it follow policy?"

### Scene 2: The Proof (15-45s)

> "Requiem is the Provable AI Runtime. Run any tool—get a 64-character BLAKE3 fingerprint. Identical inputs, identical hash. Every time. Replayable to the byte."

### Scene 3: The Closure (45-60s)

> "Every decision. Provable. Replayable. Enforced. This is Requiem."

## 2. The 2m Product Tour (The "How")

### Scene 1: Intro (0-30s)

- Visual: CLI Installation (`pnpm install`).
- Script: "Starting with Requiem is as simple as any Node.js tool..."

### Scene 2: Execution (30s-1m)

- Visual: `pnpm reach run system.echo '{"message":"hello"}'`.
- Script: "The real power is in the `Execution Fingerprint`. This isn't just a log—it's a cryptographic proof of the semantic state change."

### Scene 3: Policy Gate (1m-1m30s)

- Visual: `reach explain <run_id>`.
- Script: "Every invocation passes through a `deny-by-default` gate. No tool execution without passing policy."

### Scene 4: Drift (1m30s-2m)

- Visual: `reach drift --since=<last_run>`.
- Script: "When your model or prompt changes, Requiem tells you exactly what shifted. High-ROI drift taxonomy."

## 3. The 5m Deep Dive (The "Proof")

### Detailed Breakdown

1. **The CLI Architecture** (1m).
2. **BLAKE3-v1 Domain-Separated Hashing** (1m).
3. **The Microfracture Suite** (1m).
4. **ReadyLayer Dashboard** (1m).
5. **Formal Verification (TLA+) Overview** (1m).
