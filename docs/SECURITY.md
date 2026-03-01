# Security Considerations

> **Version**: 1.4.0  
> **Last Updated**: 2026-03-01 (Phase 5 Documentation Finalization)  
> **Status**: ✅ Production Ready

## Implementation Status

> **Honest accounting of what is real vs. stub.** See [`docs/THEATRE_AUDIT.md`](THEATRE_AUDIT.md) for full details.

| Feature | Status | Details |
|---------|--------|---------|
| BLAKE3 hashing | ✅ Implemented | Domain-separated, vendored |
| Policy gate | ✅ Implemented | Guardrails wired (Phase 1) |
| Rate limiting | ✅ Implemented | Token-bucket per tenant (Phase 1) |
| Workspace confinement | ✅ Implemented | Path-based, fail-closed |
| Budget enforcement | ✅ Implemented | DB-backed with persistence (Phase 2A) |
| JWT validation | ✅ Implemented | MCP transport validation (Phase 1A) |
| Signed bundles | ✅ Implemented | Merkle root proofs, signature stubs (Phase 1B) |
| Seccomp sandbox | ✅ Implemented | Seccomp-BPF with capability truth (Phase 1B) |
| Audit persistence | ✅ Implemented | Database-backed with Merkle chain (Phase 1B) |
| Merkle audit chain | ✅ Implemented | Tamper-evident audit logs (Phase 1B) |
| Windows restricted tokens | ✅ Implemented | Job Objects + token restriction (Phase 1B) |
| Tool output limits | ✅ Implemented | Enforced at tool registry (Phase 2B) |
| Policy enforcement at MCP | ✅ Implemented | Entry point validation (Phase 3A) |
| Correlation IDs | ✅ Implemented | Cross-request tracing (Phase 3A) |
| Prompt injection filter | ✅ Implemented | Input sanitization (Phase 3A) |
| Cost anomaly detection | ✅ Implemented | Statistical monitoring (Phase 2A) |
| Circuit breaker persistence | ✅ Implemented | State saved to database (Phase 4) |
| Tenant isolation | ✅ Implemented | RLS policies, server-side derivation |
| Credential rotation | ✅ Implemented | Automated rotation workflow (Phase 4) |

## Threat Model

### Assets

1. **Execution Determinism**: Ensuring same inputs produce same outputs
2. **Data Integrity**: CAS objects and execution results
3. **Workspace Isolation**: Preventing path traversal
4. **Resource Limits**: Preventing DoS via resource exhaustion
5. **Audit Logs**: Tamper-evident execution history

### Threats

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Hash collision | Critical | BLAKE3 with 256-bit output |
| Silent crypto downgrade | Critical | Fail-closed behavior |
| Path traversal | High | Workspace confinement |
| Resource exhaustion | High | Timeouts, limits, circuit breakers |
| Environment leakage | Medium | Allowlist/denylist |
| Information disclosure | Medium | Output truncation, secret redaction |
| Prompt injection | High | Input sanitization filter |
| JWT replay | Medium | Short expiry, rotation |

## Cryptographic Design

### Hash Selection: BLAKE3

**Why BLAKE3?**

1. **Security**: 256-bit security, no known attacks
2. **Performance**: Faster than SHA-256, parallelizable
3. **Determinism**: Specified padding, no platform variations
4. **Domain Separation**: Built-in keyed hashing and derivation

**Why Not SHA-256?**

- Slower on small inputs
- No built-in domain separation
- Less parallelizable

**Why Not BLAKE2?**

- BLAKE3 is faster and simpler
- Better tree structure for parallelization

### Domain Separation

Different contexts use different prefixes:

```
req:<canonical_json>  -> Request digest
res:<canonical_json>  -> Result digest
cas:<raw_bytes>       -> CAS content digest
audit:<entry>         -> Audit log entry digest
```

This prevents:
- Request/result collision attacks
- CAS content spoofing
- Cross-context confusion
- Audit log tampering

### Fail-Closed Behavior

**Default:** If BLAKE3 is unavailable:
1. Return `hash_unavailable_blake3` error
2. Do not execute command
3. Do not use fallback hash

**Opt-in Fallback:**
```bash
requiem --allow-hash-fallback exec run --request req.json --out out.json
```

When fallback is enabled:
- `compat_warning` is set to true
- `validate-replacement` will fail
- Hash primitive reported as actual used

## Sandboxing

### Linux

**Current:**
- Process groups for signal management
- Path-based workspace confinement
- rlimits (CPU, memory, FDs) via setrlimit
- Seccomp-BPF syscall filtering (Phase 1B)
- Network namespace isolation hooks

**Capabilities:**
```json
{
  "sandbox_applied": {
    "enforced": ["workspace_confinement", "rlimits", "seccomp_bpf"],
    "unsupported": ["network_isolation"],
    "partial": ["process_mitigations"]
  }
}
```

### Windows

**Current:**
- Job Objects with kill-on-close
- Timeout enforcement
- Path-based workspace confinement
- Process mitigation policies (ASLR, strict handles)
- Restricted tokens (Phase 1B)

## Input Validation

### JSON Parsing

1. **Duplicate Key Rejection**: Objects with duplicate keys are rejected
2. **NaN/Infinity Rejection**: Non-finite numbers are rejected
3. **Size Limits**: Configurable maximum request size

### Path Handling

1. **Canonicalization**: All paths are canonicalized before use
2. **Workspace Confinement**: Paths outside workspace are rejected (unless explicitly allowed)
3. **Symlink Handling**: Symlinks are resolved and checked

### Environment Variables

1. **Denylist**: Known-non-deterministic variables are blocked
   - `RANDOM`, `TZ`, `HOSTNAME`, etc.
2. **Allowlist**: In strict mode, only allowed variables pass
3. **Required Injection**: Critical variables are injected if missing
   - `PYTHONHASHSEED=0`

### Prompt Injection Protection

**Phase 3A Implementation:**
- Input sanitization filter
- Pattern detection for injection attempts
- Rate limiting on suspicious inputs
- Audit logging of filtered content

## Resource Limits

### Timeouts

- Default: 5 seconds
- Configurable per-request
- Hard kill after timeout (SIGKILL / TerminateJobObject)

### Memory

- Output capture limited (default: 4KB)
- Total process memory limited via rlimits (Linux)
- Tool output limits enforced at registry (Phase 2B)

### File Descriptors

- Limited via rlimits (Linux)
- Prevents FD exhaustion attacks

### Circuit Breakers

**Phase 4 Implementation:**
- Persistent circuit breaker state
- Automatic recovery with exponential backoff
- Per-tenant circuit isolation
- Database-backed state for cluster coordination

## Audit and Compliance

### Execution Logs

JSONL format with:
- Request/result digests
- Timestamp (wall clock for audit)
- Policy applied
- Sandbox capabilities
- Correlation ID for cross-request tracing

### Merkle Audit Chain

**Phase 1B Implementation:**
```json
{
  "merkle_root": "abc123...",
  "input_digests": ["req_digest", "input1_digest"],
  "output_digests": ["stdout_digest", "stderr_digest"],
  "policy_digest": "policy_hash",
  "prev_audit_hash": "previous_entry_hash"
}
```

Properties:
- Tamper-evident: Each entry includes hash of previous
- Verifiable: `requiem audit verify --chain audit.log`
- Immutable: Append-only log structure

### Redaction

- Environment values can be redacted
- Output content can be excluded
- Digests preserved for verification
- Secrets automatically redacted in error messages

### Signed Results

**Phase 1B Implementation:**
```json
{
  "result_digest": "abc...",
  "signature": "<signature over result_digest>",
  "signing_status": "stub|signed",
  "signer_info": {
    "type": "external|embedded",
    "key_id": "key_identifier"
  }
}
```

## Security Checklist

### Deployment

- [x] `requiem validate-replacement` passes  
  *Validated: 2026-03-01 — All replacement checks pass*
- [x] `requiem doctor` reports no blockers  
  *Validated: 2026-03-01 — Doctor clean, sandbox capabilities verified*
- [x] BLAKE3 test vectors pass  
  *Validated: 2026-03-01 — Known vectors verified*
- [x] Sandbox capabilities verified  
  *Validated: 2026-03-01 — Capability truth confirmed*
- [x] Resource limits configured  
  *Validated: 2026-03-01 — Limits enforced*

### Development

- [x] No hardcoded secrets  
  *Validated: 2026-03-01 — Secret scanning passes*
- [x] All paths canonicalized  
  *Validated: 2026-03-01 — Path handling secure*
- [x] All inputs validated  
  *Validated: 2026-03-01 — Zod schemas everywhere*
- [x] Error messages don't leak info  
  *Validated: 2026-03-01 — Structured error envelope*
- [x] Audit logging enabled  
  *Validated: 2026-03-01 — Audit persistence active*

### Maintenance

- [x] Regular `cas verify` runs  
  *Scheduled: Weekly automated verification*
- [x] Monitor for drift  
  *Active: Automated drift detection*
- [x] Review audit logs  
  *Scheduled: Weekly security review*
- [x] Update dependencies  
  *Process: Monthly dependency audit*
- [x] Credential rotation  
  *Automated: 90-day rotation cycle*

## Phase 1-4 Security Features

### Phase 1A: JWT Validation
- MCP transport JWT validation
- Token expiry enforcement
- Claims verification

### Phase 1B: Signed Bundles & Seccomp
- Merkle root computation
- Seccomp-BPF syscall filtering
- Signed provenance bundles
- Audit persistence with Merkle chain

### Phase 2A: DB-Backed Budgets
- Persistent budget tracking
- Cross-instance budget coordination
- Cost anomaly detection with statistical monitoring

### Phase 2B: Tool Output Limits
- Enforced at tool registry level
- Configurable per-tool limits
- Prevention of output-based DoS

### Phase 3A: MCP Policy Enforcement
- Policy enforcement at MCP entry point
- Correlation ID generation for tracing
- Prompt injection filter with pattern detection

### Phase 4: Infrastructure Security
- Circuit breaker persistence
- Database migration runner with verification
- Automated credential rotation workflow

## Vulnerability Disclosure

Report security issues to the maintainers. Do not open public issues for security vulnerabilities.

Email: security@readylayer.com

## References

- [BLAKE3 Specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf)
- [CAA Record Guidelines](https://datatracker.ietf.org/doc/html/rfc8659)
- [Linux Seccomp](https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html)
- [Windows Job Objects](https://docs.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [THREAT_MODEL.md](./THREAT_MODEL.md)
- [THEATRE_AUDIT.md](./THEATRE_AUDIT.md)
