# Security Considerations

## Threat Model

### Assets

1. **Execution Determinism**: Ensuring same inputs produce same outputs
2. **Data Integrity**: CAS objects and execution results
3. **Workspace Isolation**: Preventing path traversal
4. **Resource Limits**: Preventing DoS via resource exhaustion

### Threats

| Threat | Severity | Mitigation |
|--------|----------|------------|
| Hash collision | Critical | BLAKE3 with 256-bit output |
| Silent crypto downgrade | Critical | Fail-closed behavior |
| Path traversal | High | Workspace confinement |
| Resource exhaustion | High | Timeouts, limits |
| Environment leakage | Medium | Allowlist/denylist |
| Information disclosure | Medium | Output truncation |

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
```

This prevents:
- Request/result collision attacks
- CAS content spoofing
- Cross-context confusion

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

**Planned:**
- Seccomp-BPF syscall filtering
- Landlock LSM path restrictions
- Namespaces (PID, network)

### Windows

**Current:**
- Job Objects with kill-on-close
- Timeout enforcement
- Path-based workspace confinement

**Planned:**
- Restricted tokens
- Process mitigation policies
- AppContainer sandbox

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

## Resource Limits

### Timeouts

- Default: 5 seconds
- Configurable per-request
- Hard kill after timeout (SIGKILL / TerminateJobObject)

### Memory

- Output capture limited (default: 4KB)
- Total process memory limited via rlimits (Linux)

### File Descriptors

- Limited via rlimits (Linux)
- Prevents FD exhaustion attacks

## Audit and Compliance

### Execution Logs

JSONL format with:
- Request/result digests
- Timestamp (wall clock for audit)
- Policy applied
- Sandbox capabilities

### Redaction

- Environment values can be redacted
- Output content can be excluded
- Digests preserved for verification

### Signed Results

Stub for PKI integration:
```json
{
  "result_digest": "abc...",
  "signature": "<signature over result_digest>"
}
```

## Security Checklist

### Deployment

- [ ] `requiem validate-replacement` passes
- [ ] `requiem doctor` reports no blockers
- [ ] BLAKE3 test vectors pass
- [ ] Sandbox capabilities verified
- [ ] Resource limits configured

### Development

- [ ] No hardcoded secrets
- [ ] All paths canonicalized
- [ ] All inputs validated
- [ ] Error messages don't leak info
- [ ] Audit logging enabled

### Maintenance

- [ ] Regular `cas verify` runs
- [ ] Monitor for drift
- [ ] Review audit logs
- [ ] Update dependencies

## Vulnerability Disclosure

Report security issues to the maintainers. Do not open public issues for security vulnerabilities.

## References

- [BLAKE3 Specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf)
- [CAA Record Guidelines](https://datatracker.ietf.org/doc/html/rfc8659)
- [Linux Seccomp](https://www.kernel.org/doc/html/latest/userspace-api/seccomp_filter.html)
- [Windows Job Objects](https://docs.microsoft.com/en-us/windows/win32/procthread/job-objects)
