# Technical Due Diligence Checklist

Use this checklist when assessing whether Requiem's claims are supported in your environment.

## 1) System Guarantees (Claim Scope)

- [ ] Determinism claim is limited to documented contract/version scope.
- [ ] Replay claim is tied to concrete replay commands and stored artifacts.
- [ ] Policy enforcement claim is tied to policy verification scripts and runtime checks.
- [ ] Integrity claim is tied to CAS/proof verification commands, not logs alone.

## 2) Verification Commands (Repo-Level)

Run and archive outputs:

```bash
pnpm verify:demo
pnpm verify:determinism
pnpm verify:policy
pnpm verify:replay
pnpm verify:routes
pnpm verify:repo
```

## 3) Deterministic Replay Demonstration

- [ ] Execute a baseline run.
- [ ] Capture run id/receipt output.
- [ ] Replay same run artifacts.
- [ ] Compare replay and baseline result fields.
- [ ] Document any mismatch as drift or unsupported path.

## 4) Proof Verification

- [ ] Verify log integrity surfaces (`log verify`).
- [ ] Verify CAS integrity surfaces (`cas verify`).
- [ ] Verify proofpack schema and verification path used in your environment.
- [ ] Confirm verification failure behavior is explicit (no silent pass states).

## 5) Test Coverage Areas to Inspect

- [ ] Determinism regression tests and golden corpus checks.
- [ ] Policy route/runtime checks.
- [ ] Tenant isolation and no-leakage checks.
- [ ] Replay/diff regression checks.
- [ ] Supply-chain/dependency verification checks.

## 6) Security Considerations

- [ ] AuthN/AuthZ configuration reviewed for production (no placeholder assumptions).
- [ ] Secrets handling and no-secret checks reviewed.
- [ ] Sandbox/isolation mode documented for deployment OS/runtime.
- [ ] Signing keys and trust roots managed outside source control.
- [ ] Audit logging retention and tamper-evidence requirements defined.

## 7) Data Integrity Protections

- [ ] CAS digest strategy and hash versioning reviewed.
- [ ] Artifact immutability assumptions documented.
- [ ] Version contract and migration checks validated.
- [ ] Backup/restore process preserves digest/address consistency.

## 8) Residual Risk Statement (Required)

Before launch, document:

- what is proven by automated checks,
- what is assumed by environment/config,
- what remains experimental or partially implemented.
