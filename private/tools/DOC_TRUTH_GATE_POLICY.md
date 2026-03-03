# Doc Truth Gate Policy (Anti-Drift)

## Purpose

To prevent "doc drift" where the capabilities documented in `README.md` or `docs/` diverge from the actual behavior of the `reach` CLI or the underlying engine.

## Policy Requirements

### 1. Command Synchronicity

- Every command listed in the "CLI Commands" table of the `README.md` must exist in the `reach` CLI.
- The `reach help` (or equivalent) output must include these commands.
- The default usage patterns must match the documented examples.

### 2. No Aspirational Claims

- Docs must not claim a feature is "deterministic" if it fails the verification suite.
- Claims of "SOC 2" or other certifications must be linked to a specific, internal compliance report in `/private/procurement/` and labeled as "designed to support" unless the audit is complete.
- Use factual, technical language: "verified via BLAKE3" instead of "magic security".

### 3. Truth Gates in CI

- `docs-truth-gate.ts` runs in CI to verify that the README command list matches the CLI's actual command registry.
- `claims-linter.ts` scans for banned "market-speak" phrases or unsubstantiated claims.

## Governance

If a truth gate fails, the build fails. The documentation must be updated to match reality, or the code must be fixed to meet the documented standard.
