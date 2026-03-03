# Sales Enablement: Requiem

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Battlecard: The "Provable" Pitch

### The Problem
Companies are terrified of "Rogue AI" or "Hallucination Costs." They usually solve this by adding more filters or restricting use cases.

### The Requiem Solution
Don't restrict the AI; govern the **Execution**. We provide the sandbox and the "Flight Recorder." If it's not strictly according to policy, it doesn't happen.

## 2. Typical Objections & Rebuttals

| Objection | Rebuttal |
|-----------|----------|
| **"Doesn't this add latency?"** | Our core engine is C++. Hashing overhead is < 5ms. The cost of a single hallucination or budget overrun is far higher than 5ms. |
| **"We already use LangSmith for logs."** | Logs are for developers to *read*. Receipts are for the system to *verify*. You can't replay a LangSmith log and guarantee it was the original output. With Requiem, you can. |
| **"Our model provider handles safety."** | Model safety is context-blind. Requiem's Policy VM enforces *your* business logic (e.g., "Don't spend more than $10 on this specific user") which models can't see. |
| **"Is this another vendor lock-in?"** | Our core is MIT Licensed. You own your receipts and your logs. We provide the management layer for convenience and scale. |

## 3. Discovery Questions
- "How do you prove to your CISO that an AI agent didn't access unauthorized data?"
- "If a customer claims an AI made an illegal promise, how do you reproduce the exact state of that decision today?"
- "What happens when your model provider updates their model and your agent's behavior drifts? How do you detect it before customers do?"

## 4. The "Reach Verify" Demo
1. Run a tool: `reach run system.echo '{"test":1}'`
2. Show the fingerprint.
3. Modify the underlying data.
4. Run `reach verify <hash>` and show it **FAIL**.
5. Explain: "This failure is your safety net. If the state isn't exactly what was proven, Requiem stops it."

## 5. Pricing Guidance
- Start with a "Governance Audit" (Free/OSS).
- Upsell to "Departmental Enforcement" (Pro).
- Close on "Institutional Integrity" (Enterprise).
