# Product Positioning & Messaging: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Core Positioning

Requiem is the **Provable AI Runtime**. It is the execution layer of record for autonomous agents.

## 2. The Value Proposition

Current AI development relies on "probabilistic hope"—the hope that a model will follow instructions and that a wrapper will catch errors. Requiem replaces hope with **deterministic proof**.

| Feature | The Shift |
| :--- | :--- |
| **Execution** | From "Dynamic" to "Provable" |
| **Governance** | From "Middleware" to "Gatekeeper" |
| **Audit** | From "Logs" to "Receipts" |

## 3. Ideal Customer Profile (ICP)

- **Primary**: Enterprise Platform Engineering teams in regulated industries (Financial Technology, Healthcare, Legal).
- **Secondary**: SaaS companies building autonomous "co-pilots" that require high reliability and security.
- **Geography**: Global, with emphasis on North America and EU (due to regulatory requirements like EU AI Act).

## 4. Key Messaging Pillars

### Pillar 1: Receipts over Promises

*“Don't tell me what your AI might do. Show me a receipt of what it actually did.”*
Requiem generates a cryptographic proof for every tool call and decision. This is not logging; it is a verifiable commitment of state.

### Pillar 2: Governance as a Gate, Not a Filter

*“If it's not allowed, it doesn't run.”*
Unlike post-hoc monitoring, Requiem's Policy VM sits *in front* of the execution. If a policy check fails, the tool invocation never leaves the sandbox.

### Pillar 3: Replay to Zero-Drift

*“Reproduce any bug, any time, exactly.”*
Because the runtime is deterministic, teams can replay any production failure locally to the bit. This reduces MTTR (Mean Time To Recovery) for AI failures by 90%.

## 5. Elevators Pitches

### The 10-Second Pitch

"Requiem is a provable runtime for AI agents. It ensures every decision is deterministic, governed by strict policy, and produces a cryptographic receipt for auditing. It's the black-box flight recorder for AI."

### The Technical Pitch

"We built a native C++ engine with BLAKE3 hashing and a TypeScript control plane that treats AI execution as a semantic state machine. It enforces deny-by-default policies at the runtime level, ensuring that agent behavior is always auditable and replayable without drift."
