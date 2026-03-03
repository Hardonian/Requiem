# Sales Enablement: Requiem

## 1. Ideal Customer Profile (ICP)
- **Sector**: FinTech, Legal, Healthcare, Enterprise Software.
- **Team Size**: 20+ Engineers with at least 5 focus on AI/ML.
- **Pain Points**:
  - High failure rate in production AI agents.
  - Inability to satisfy auditors regarding AI decision logic.
  - Fear of "shadow AI" tool usage within the company.

## 2. Discovery Questions
- "How do you currently prove to your legal team that your AI agent didn't violate a data privacy policy?"
- "If a customer asks for a step-by-step audit of an AI-generated decision from 3 months ago, how long does it take you to produce that?"
- "What happens today when you upgrade from GPT-4 to a newer model—how do you guarantee no behavior regressions?"

## 3. Demo Script Highlights
1. **The Proof**: Run a tool call, show the BLAKE3 hash. "This is your cryptographic receipt."
2. **The Policy**: Attempt a forbidden tool call. Show the `reach run` failure. "The gate is enforced at the runtime level. No bypass."
3. **The Replay**: Open ReadyLayer. Replay the run. "Identical result, verified to the byte."

## 4. Objection Responses
- **"We already have logs"**: "Logs are just stories. Requiem produces *evidence*. You can't replay a log to verify its integrity."
- **"This sounds complex"**: "It’s one CLI command (`reach`). We handle the hashing, the sandbox, and the policy evaluation automatically."
- **"We trust our providers (OpenAI/Anthropic)"**: "You trust them to provide the model, but you need to verify *your use* of that model. Requiem is the bridge between their raw output and your business safety."

## 5. Proof Checklist for POCs
- [ ] Install Reach CLI locally.
- [ ] Connect a custom tool (MCP).
- [ ] Define a "Deny-by-Default" policy.
- [ ] Verify a deterministic execution across two different team member machines.
- [ ] View the run trace in ReadyLayer.
