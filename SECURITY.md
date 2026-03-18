# Security Policy

## Reporting a vulnerability

Do not open public issues for suspected vulnerabilities.

- Email: **security@ready-layer.com**
- Include:
  - affected component or file,
  - reproduction steps,
  - expected impact,
  - proof-of-concept details if you have them,
  - whether the issue is local-only, ReadyLayer-specific, or affects the native engine.

## Response expectations

- Initial acknowledgment target: within 3 business days.
- Triage follow-up: after initial review with severity and next-step guidance.
- Coordinated disclosure: preferred when a fix is available.

## Repository-specific security notes

This repository contains:

- native engine code,
- CLI/operator code,
- ReadyLayer web/API code,
- verification scripts and documentation.

The current web tenancy model is user-scoped rather than proven shared-org SaaS tenancy. Reports that cross user/tenant boundaries, auth fallback boundaries, or local/deployed mode confusion are in scope.

## Out-of-scope for public repo claims

Do not infer from this repository alone:

- hosted enterprise operating procedures,
- commercial SLA commitments,
- external audit/certification status.

## Contributor expectations

- Do not commit secrets, tokens, or private keys.
- Do not document insecure dev shortcuts as deployment guidance.
- Prefer fail-closed behavior for auth, tenant context, and configuration errors.
- Treat degraded states as explicit and machine-visible, not silently successful.
