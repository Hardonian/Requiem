# Security Overview: Requiem Integrity Model

**Version**: 1.0.0  
**Last Updated**: 2026-03-02

## 1. Security Architecture: "Assume Breach"

Requiem is built on the principle that if a model is compromised or a prompt is injected, the **Execution Layer** must remain secure. We don't try to sanitize the AI's "thought"; we enforce the AI's "action."

## 2. Theoretical Defense Layers

### Layer 1: Native Sandbox

The C++ engine executes tool calls in a restricted process namespace. It has no access to the host file system or network except for the specific capabilities granted by the Policy VM.

### Layer 2: Policy VM (Gatekeeper)

A deny-by-default execution environment. Even if an AI instructs a tool to "delete * from users," the Policy VM checks the operation against a Merkle-signed budget and RBAC permission. If it's not explicitly allowed, the instruction is dropped *before* the tool is invoked.

### Layer 3: Cryptographic receipts

Every run generates a trace-hash. If an attacker modifies a database log to hide a policy breach, the historical receipt verification (`reach verify`) will fail because the Merkle root will no longer align.

## 3. Incident Response Plan

- **Detection**: Any verification failure in high-integrity projects triggers an automatic `ALERT_INTEGRITY_COMPROMISED`.
- **Isolation**: Affected Tenant IDs are immediately moved into "Read-Only" mode in the CAS.
- **Audit**: Auditors use `reach lineage` to trace the state back to the point of divergence.

## 4. Threat Model Summary

| Threat | Requiem Mitigation |
| :--- | :--- |
| **Prompt Injection** | Policy VM gate prevents unauthorized tool execution. |
| **Log Tampering** | Merkle-signed receipts make modification detectable. |
| **Data Leakage** | Tenant isolation and domain-separated storage. |
| **Environment Poisoning** | Synthetic environment injection in the native engine. |

## 5. Vulnerability Disclosure

We maintain a `SECURITY.md` in the root of the repository. All vulnerabilities should be reported to <security@requiem.sh>.
