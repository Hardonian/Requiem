# Internal FAQ: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Product & Vision

### What is the "Synthesis Protocol"?
It is our internal method for removing non-determinism from AI tool calls. This includes environment sanitization and canonical serialization so that identical prompts always produce identical hashes.

### Why not just use standard logging?
Logs can be deleted or modified. Standard logging also doesn't prove that the code actually ran the way the log says it did. Requiem's Merkle-signed receipts are mathematically bound to the execution.

## 2. Technical

### Does the Policy VM support Python?
No. To maintain determinism and speed, the Policy VM is orated by our TypeScript control plane and enforced by the C++ engine. Python is too dynamic/non-deterministic for the core gatekeeper roles.

### How do we handle API key rotation?
API keys are never stored in the CAS. They are injected as environment variables at the Policy VM gate and wiped from the sandbox immediately after use.

## 3. Sales & Positioning

### Who is our biggest competitor?
Currently, "The Status Quo." Most companies just hope their AI works or use manual review. Technically, companies like Guardrails AI are adjacent, but they lack our native, deterministic execution layer.

### What is a "Proof Credit"?
It is our internal unit of value. It covers the cost of one policy evaluation and one cryptographic commitment to the ledger.

## 4. Operational

### Where do I report a security vulnerability?
Immediately notify the Security Lead and email <security@requiem.sh>. Do not discuss vulnerabilities in public Discord channels.

### How do I get a demo environment?
Ask in `#px-team` for a ReadyLayer invite. Use your `requiem.sh` internal account.
