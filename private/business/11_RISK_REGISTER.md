# Risk Register: Requiem

| Risk Description | Category | Impact | Likelihood | Mitigation Strategy |
|------------------|----------|--------|------------|---------------------|
| **Policy Bypass Vulnerability** | Technical| High | Low | Native C++ implementation of the gate; Formal TLA+ specification; Continuous fuzzing. |
| **Model Non-Determinism** | Market | Med | High | Focus on 'Semantic Determinism'; Provide drift metrics rather than binary pass/fail when models vary slightly. |
| **Adoption Friction** | Market | High | Med | Standardize on MCP (Model Context Protocol); Provide 'Zero-Rewrite' adapters for existing stacks. |
| **Data Privacy (PII leakage)** | Legal | High | Low | CAS hashing to abstract data; Deny-by-default policy gate; Encryption-at-rest. |
| **Performance Overhead** | Operational| Med | Med | Use BLAKE3 and native C++ for performance; Keep policy logic lean; Async logging. |
| **Provider API Changes** | Technical| Med | High | Abstraction layer for model providers; Regular CI testing against latest upstream APIs. |
| **Open Source Fragmentation**| Strategic| Low | Med | Maintain clear governance; Strong documentation; Responsive core maintainer team. |

## Detailed Technical Risk: Sandbox Escape
**Problem**: An untrusted tool execution might escape the local sandbox and compromise the host machine.
**Mitigation**: Use hardened containerization or lightweight VMs (e.g., Firecracker) where necessary; Enforce strict syscall filtering in the Native Engine.

## Detailed Market Risk: Competition from Cloud Providers
**Problem**: AWS/OpenAI might build native "Deterministic Logging" or "Safety Gates."
**Mitigation**: Maintain a "Provider-Agnostic" stance; Focus on the *Proof* rather than just the *Action*. A receipt that works across all models is more valuable than a siloed one.
