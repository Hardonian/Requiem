# Extensibility Safety Rules

These rules are mandatory for platform ecosystem growth.

1. **Published Interface Only**
   - Extensions must use documented interfaces (CLI contract, API route contract, plugin manifest contract).

2. **No Direct Core State Mutation**
   - Plugins/extensions cannot write internal runtime state except via approved APIs.

3. **Tenant Context Required**
   - Any extension touching tenant data must require tenant context and deny cross-tenant access by default.

4. **Policy Gate Is Non-Optional**
   - Extension-triggered execution must flow through policy evaluation before side effects.

5. **Traceability Is Mandatory**
   - Extension actions must emit trace/request IDs and machine-readable failure envelopes.

6. **Determinism Contract**
   - Extension outputs used in proofs/replay must be canonicalized and hash-stable.

7. **Version Compatibility**
   - Extensions must declare interface version and minimum supported core version.

8. **No Contract Bypass via CLI**
   - CLI extensions cannot invoke privileged backend behavior that bypasses API/auth/policy contracts.

9. **Schema-First Inputs**
   - Extension payloads must be validated before execution; invalid payloads return problem+json style errors.

10. **Explicit Degraded Modes**
    - If checks cannot run (e.g., missing dependency), response must be explicit and machine-visible.

