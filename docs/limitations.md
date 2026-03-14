# Limitations and Guarantee Boundaries

This document is intentionally explicit. Use it to avoid over-claiming.

## Guarantees with Stronger Coverage (Repository-Level)

- Determinism and version-contract verification surfaces exist in CI scripts.
- CAS and integrity verification surfaces exist in operator/verification commands.
- Replay and diff workflows are present in CLI/doc surfaces.
- Policy verification checks exist in repo verification scripts.

> Stronger coverage means these are represented as code paths and verification scripts in this repository. It does **not** mean every deployment has identical runtime guarantees.

## Partial Guarantees

- End-to-end security posture depends on deployment choices (auth provider, key management, network boundaries, secrets management).
- Cryptographic signing and verification guarantees depend on key provisioning and enforcement configuration.
- Multi-tenant guarantees depend on route/runtime enforcement and operational controls in the deployed environment.

## Experimental / In-Progress Areas

- Some hardening capabilities are identified as stubs or in-progress in repository audits (for example specific auth/sandbox integrations).
- Enterprise/control-plane features may evolve faster than OSS kernel guarantees and should be validated against release state.

## Unsupported or Not-Guaranteed Scenarios

- Claims of formal security certification without external audit artifacts.
- Claims of universal reproducibility across arbitrary environments without pinned versions and controlled runtime dependencies.
- Claims that logs alone constitute tamper-proof proof material.

## Operator Guidance

Before external launch claims:

1. run verification scripts in your target environment,
2. archive generated evidence artifacts,
3. narrow marketing language to verified properties.
