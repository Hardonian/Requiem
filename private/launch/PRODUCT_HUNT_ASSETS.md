# Product Hunt Launch Assets: Requiem

**Project Name**: Requiem - The Provable AI Runtime

## 1. Tagline
Every AI decision. Provable. Replayable. Enforced. 

## 2. Maker Comment

Hey PH! 👋

We built Requiem because we were tired of the "Black Box" problem in AI agents. You run a prompt, it works once, then it fails in production, and you have no idea why. Logs lie, but cryptographic hashes don't.

Requiem is a native execution layer that treats AI as a semantic state machine.
- **Deterministic**: 100% bit-perfect replay of any tool call.
- **Governed**: Deny-by-default Policy VM stops rogue agents *before* they act.
- **Provable**: Generates BLAKE3-signed "Receipts" for every decision.

Whether you're building a multi-agent system or a simple chatbot, Requiem gives you the "Black Box Flight Recorder" for your AI.

Check out the CLI: `pnpm reach run`

Looking forward to your feedback!

## 3. Demo Script (60s)

1. **[0-10s]**: Opening shot of the `reach` CLI. "This is Requiem. It proves what your AI actually did."
2. **[10-25s]**: Run a tool call. Show the execution fingerprint appearing. "Every action produces a cryptographic receipt."
3. **[25-45s]**: Tamper with a local file and run `reach verify`. Show the big RED error. "If the state drifts by a single byte, we catch it."
4. **[45-60s]**: Transition to the ReadyLayer dashboard. "Visual management for enterprise-grade integrity. Requiem: The Runtime of Record."

## 4. FAQ (External)

- **Q: Is this just for OpenAI?**
  - A: No, we support any provider via our Tool Registry and MCP (Model Context Protocol).
- **Q: Does it slow down my app?**
  - A: The core engine is C++. We've optimized hashing to be sub-5ms.
- **Q: Can I run this locally?**
  - A: Yes, the `reach` CLI is MIT Licensed and designed to be run on your own machine.
