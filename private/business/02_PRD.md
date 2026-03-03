# Product Requirements Document (PRD): Requiem

## 1. Problem Statement
Current AI agent frameworks lack **execution integrity**. When an agent fails or behaves unexpectedly, it is difficult to:
1. Prove exactly what happened.
2. Reproduce the failure deterministically.
3. Verify that all safety policies were actually applied at the runtime level.
4. Detect behavioral "drift" when models or prompts change.

## 2. Goals
- **Determinism**: Ensure AI runs are repeatable and stable.
- **Auditability**: Provide a tamper-evident ledger of every AI decision.
- **Governance**: Enforce strict policy gates on all tool and model interactions.
- **Portability**: Allow execution batches to be replayed anywhere via CAS.

## 3. Non-Goals
- **Model Training**: Requiem does not train or fine-tune models.
- **Prompt Engineering**: We provide the runtime, but we are not a prompt-generation service (though we help diff them).
- **General Purpose CI**: We are specifically an *AI execution* layer.

## 4. Personas
- **AI Architect**: Designs the agent system and defines the "Three Guarantees."
- **Governance Lead**: Defines policies for data access, spend, and safety.
- **DevOps Engineer**: Integrates Requiem into the CI/CD pipeline for verification.

## 5. User Stories
- *As a Developer*, I want to run a tool via Reach and get a cryptographic hash so I can prove the result is correct.
- *As a Security Officer*, I want to ensure no agent can call an 'rm -rf' equivalent without passing an RBAC check.
- *As a Platform Owner*, I want to replay a customer's failed run to see exactly where the model diverged from the policy.

## 6. Success Metrics
- **Verification Rate**: % of runs that pass determinism checks in production.
- **Policy Block Rate**: Number of illicit tool calls prevented by the Policy Gate.
- **Drift Confidence**: Ability to quantify "semantic drift" (0-100) between model versions.

## 7. Constraints & Scope
- **Latency**: Policy evaluation and hashing must not add significant overhead to agent response times.
- **Runtime**: Must support Linux/MacOS as primary targets; Windows support for core engine is secondary but maintained.
- **Compatibility**: Must integrate with standard Model Context Protocol (MCP) servers.
