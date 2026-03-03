# Demo Script: Requiem (60-Seconds)

## Narrative: "The Power of Proof"

### [0:00-0:15] - The Setup

"We’re building an agent that can access our internal file system. In a normal world, we just hope it doesn't delete anything. In Requiem, we **verify** it."

### [0:15-0:30] - The First Run (Reach CLI)

"Watch what happens when I run a simple echo command through our Reach CLI."

```bash
reach run system.echo '{"message":"hello"}'
```

"Look at this: a **cryptographic fingerprint**. This isn't just a log; it's a BLAKE3 proof of the exactly what was executed and what came back."

### [0:30-0:45] - The Policy Enforcement

"Now, let's try to cheat. I'll attempt to run a command that violates our security policy (e.g., accessing a restricted tenant)."

```bash
reach run restricted.tool '{"secret":"123"}'
```

"Immediate failure. Detailed as `Invariant failure (tenant violation)`. The Policy Gate blocked this at the runtime layer before a single byte of untrusted code could run."

### [0:45-1:00] - The Audit (ReadyLayer Console)

"Finally, we can jump into the ReadyLayer dashboard. Here is our execution history—immutable and re-playable. I can verify this specific run from three days ago and prove to an auditor that it matches the original fingerprint to the byte."

### Closing

"That’s Requiem. AI execution you can finally trust. Provable. Replayable. Enforced."
