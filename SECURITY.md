# Security Policy

## Supported Versions

Only the latest major version of Requiem is officially supported with security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| < 1.3   | :x:                |

## Reporting a Vulnerability

We take the security of Requiem seriously. If you believe you have found a security vulnerability, please do NOT open a public issue. Instead, please report it following these steps:

1. Send an email to [security@reach.com](mailto:security@reach.com).
2. Include a description of the vulnerability and steps to reproduce it.
3. If possible, provide a proof-of-concept.

We will acknowledge your report within 48 hours and provide a timeline for a fix if applicable. We request that you follow responsible disclosure practices and give us reasonable time to address the issue before making it public.

## Security Design

Requiem is built with security as a first-class citizen:

- **Deterministic Execution**: Prevents subtle state-based attacks.
- **Hard Sandboxing**: Cross-platform process isolation.
- **Fail-Closed Crypto**: Rejects execution if BLAKE3 is unavailable.
- **Content-Addressable Storage**: Automatic integrity verification.

For a detailed breakdown of our threat model, cryptographic design, and sandbox implementation, please refer to [docs/SECURITY.md](docs/SECURITY.md).
