# Product Hunt Assets: Requiem

## 1. Tagline Options
- "Every AI decision. Provable. Replayable. Enforced."
- "The Provable AI Runtime for Autonomous Agents."
- "Cryptographic receipts for your AI tools."
- "Stop the AI Black Box with a Deterministic Runtime."

## 2. Maker Story Draft
"Hi Product Hunt! I'm [NAME], one of the creators of Requiem. We built this because we were tired of deployments where we had to 'just trust' that an agent wouldn't hallucinate a tool call or drift into unsafe behavior. Requiem gives you a cryptographic receipt for every action—if it deviates from policy or isn't deterministic, it fails the verification. We'd love for you to try out `pnpm reach run` and see your first Provable Execution today!"

## 3. Feature Bullets
- **Deterministic Engine**: Identical runs produce identical hashes.
- **Deny-by-Default Policy**: Governance that actually blocks the execution.
- **Byte-Level Replay**: Audit anything, anytime.
- **MCP Native**: Plugs into the existing Model Context Protocol ecosystem.
- **High Performance**: Native C++ core for ultra-low latency hashing.

## 4. Q&A Responses
- **"How is this different from LangSmith?"**: "LangSmith is great for observability, but Requiem is about **Active Governance**. We don't just watch; we enforce and prove."
- **"Does it support [Local Model X]?"**: "Yes! As long as the model produces text or tool calls, Requiem can wrap the execution in a provable sandbox."

## 5. First Comment Template
"Thanks for checking us out! Requiem is born from the need for 'Receipts in the AI Age.' Check out our `DETERMINISM.md` in the repo to see how we handle BLAKE3 hashing and Merkle-tree logging. I'll be here all day to answer technical questions!"
