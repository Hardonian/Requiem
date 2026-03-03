# Positioning & Messaging: Requiem

## 1. Core Message
**Every AI decision. Provable. Replayable. Enforced.**

## 2. Taglines
- The Provable AI Runtime.
- Receipts for the AI Age.
- Black Box Recording for Autonomous Agents.
- Governance as Code, Enforced at the Edge.

## 3. Elevator Pitch
Requiem is the first execution layer designed specifically for the governance of autonomous AI. While other tools focus on prompt engineering or model orchestration, Requiem focuses on **integrity**. We provide a cryptographic proof for every model action, a deny-by-default policy gate for every tool call, and a byte-level replay engine to audit failures. If your AI is doing high-stakes work, it needs to be running on Requiem.

## 4. "What it is" vs "What it isn't"
| What it IS | What it IS NOT |
|------------|----------------|
| A provable runtime | A simple prompt router |
| A deterministic sandbox | A generic cloud VM |
| A policy gatekeeper | A logging wrapper |
| A semantic state machine | A linear workflow engine |

## 5. Objection Handling
- **"Is it slow?"**: No. The core engine is written in C++ and uses BLAKE3, which is faster than MD5 or SHA-256. Overhead is measured in microseconds.
- **"Do I have to rewrite my code?"**: Requiem integrates via a clean CLI (Reach) and standard provider interfaces. If you use MCP, migration is trivial.
- **"Is this just logging?"**: No. Logging is passive. Requiem is active—it enforces policy *before* execution and verifies determinism *after*.

## 6. Value Pillars
- **Trust**: Close the trust gap between models and users.
- **Compliance**: Automated audit trails for SOX, HIPAA, and GDPR.
- **Stability**: Catch regressions in AI behavior before they hit production.
