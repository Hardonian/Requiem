# Internal FAQ: Requiem Stakeholders

## 1. Technical

- **Q: Why BLAKE3 instead of SHA-256?**
  - **A**: Speed and domain-separation. BLAKE3 is significantly faster on modern hardware and its tree-structure makes it ideal for the Merkle-tree logging we use in our ledger.
- **Q: What happens if the Native Engine crashes?**
  - **A**: The system fails-safe. Our "Deny-by-Default" posture means if the engine cannot verify a run, it is marked as invalid and no state is committed.

## 2. Business

- **Q: Who is our primary competitor?**
  - **A**: The status quo (unstructured logging + hope). Secondary competitors are observability tools like LangSmith, but we differentiate by being an *active* gatekeeper and *provable* runtime.
- **Q: Why are we giving away the core engine as OSS?**
  - **A**: Trust. A "Provable Runtime" that is closed-source is a contradiction. Developers need to see how the hashing and sandboxing work to trust the results. We monetize the *management* of those results via ReadyLayer.

## 3. Product Roadmap

- **Q: When is the Cloud Dashboard (ReadyLayer) launching?**
  - **A**: The Pro beta is scheduled for 60 days post-OSS launch.
- **Q: Does this work with any LLM?**
  - **A**: Yes. We wrap the model interaction. As long as the model supports tool calling or structured output, Requiem can verify it.

## 4. Sales/Marketing

- **Q: Is this "Deterministic AI"?**
  - **A**: Great question. Deep learning models are inherently probabilistic, but their *execution* and *governance* can be deterministic. Requiem makes the **environment** and **actions** deterministic, even if the model's creative output varies.
- **Q: What is a "Receipt"?**
  - **A**: It's shorthand for the BLAKE3 `result_digest` and the Merkle-chain proof that proves an action was taken, who took it, and that it passed all policy checks.
