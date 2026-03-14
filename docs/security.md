# Security Operations

## Supply chain and proof security

Use these commands:

- `requiem security:scan [--sbom <path>]` to generate SBOM and run dependency denylist checks.
- `requiem proof:sign <proofpack> --key <private.pem>` to append an Ed25519 manifest signature.
- `requiem proof:verify <proofpack> --key <public.pem>` to verify attached signatures.
- `requiem proof:inspect <proofpack>` to inspect execution and hash fields.

## Security posture notes

- Verification output is explicit (`valid: true/false`) and returns non-zero on failure.
- Proofpack inspection reports missing required fields instead of silently passing.
