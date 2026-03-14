# Technical FAQ

## Why does deterministic execution matter?

Determinism turns incident/debugging questions from probabilistic to testable. If a run can be replayed from canonical input and policy state, root cause isolation is faster and claims are easier to verify.

## How does replay work?

Replay consumes stored execution artifacts, reconstructs run context, and re-evaluates execution paths against recorded expectations. The operator can then compare replay output to prior receipts/evidence.

## How does CAS help prevent mutation?

CAS stores artifacts by digest. If content changes, the digest changes. This makes silent in-place mutation detectable because references no longer match expected hashes.

## How is policy evaluation proven?

Policy evaluation is recorded as part of execution evidence (for example policy digests and decision traces attached to run artifacts/proof material). Verification checks can assert the evaluated policy state matches what execution claims.

## How are proofpacks different from logs?

Logs are chronological records and may be operationally useful but weak as standalone integrity evidence. Proofpacks are structured evidence artifacts intended for verification workflows (digest linkage, execution context, and integrity metadata).

## What guarantees are provided today?

Requiem emphasizes deterministic execution pathways, replay, policy gating, and integrity-oriented storage. Exact guarantee boundaries depend on enabled components and deployment configuration.

## What is experimental?

Some security and platform-hardening features may be partial or in-progress depending on environment (for example specific sandboxing/auth integrations). Use the limitations doc and theatre/security audits to scope production claims.
