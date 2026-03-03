# Industrialization Plus Report

> **Status:** COMPLETE  
> **Date:** 2026-03-02  
> **Scope:** Demo Reliability + Contract Freeze + Enforcement Suite

---

## Summary

This report documents the industrialization effort to make the Requiem system **demo-proof**, **contract-stable**, **CI-enforced**, and **launch-ready**.

### Deliverables Added

| Section | Deliverable | Location |
|---------|-------------|----------|
| A | Demo runner script | `scripts/demo-run.ts` |
| A | Demo doctor script | `scripts/demo-doctor.ts` |
| A | Deterministic fixtures | `examples/demo/` |
| A | Make targets | `Makefile` (demo, demo:verify, demo:clean) |
| B | CLI contract doc | `docs/contracts/cli_contract.md` |
| B | API envelope contract | `docs/contracts/api_envelope_contract.md` |
| B | Schema versioning policy | `docs/contracts/schema_versioning.md` |
| B | Contract verification | `scripts/verify-cli-contract.ts` |
| C | Secrets leak verification | `scripts/verify-nosecrets.ts` |
| C | Stack leak verification | `scripts/verify-no-stack-leaks.ts` |
| C | CI quality gate wiring | `package.json` (verify:ci) |
| D | Demo documentation | `docs/DEMO.md` |

---

## Section A: Demo Reliability Lock

### A1: One-Command Demo Runner

**File:** `scripts/demo-run.ts`

Executes the full vertical slice:
```
doctor -> policy check -> plan hash -> plan run -> log verify -> cas verify
```

Features:
- Exits non-zero on any failure
- Produces JSON summary with receipt hash and run_id
- Writes artifacts to `demo_artifacts/`
- Supports `--json` flag for machine parsing
- Generates trace_id for distributed tracing

**Usage:**
```bash
npx tsx scripts/demo-run.ts
npx tsx scripts/demo-run.ts --json
make demo
```

### A2: Deterministic Fixtures

**Location:** `examples/demo/`

| Fixture | Purpose | Determinism Guarantees |
|---------|---------|----------------------|
| `policy.json` | Policy rules | Fixed version, deterministic IDs |
| `plan.json` | Execution plan | Fixed step IDs, empty env_allowlist |
| `input.json` | Request context | Fixed timestamp |
| `README.md` | Documentation | Commands and expected outputs |

All fixtures use:
- Hardcoded timestamps (no wall-clock)
- Empty environment allowlists (no env contamination)
- Stable JSON ordering (deterministic serialization)

### A3: Demo Doctor

**File:** `scripts/demo-doctor.ts`

Pre-flight validation:
- CLI availability and version
- Required files exist
- Environment variables (safe check)
- Engine health (`requiem doctor`)
- Artifacts directory writable
- JSON parseable

**Usage:**
```bash
npx tsx scripts/demo-doctor.ts
npx tsx scripts/demo-doctor.ts --json
make doctor
```

### A4: Make Targets

Updated `Makefile`:

```makefile
demo: build:cpp ## Run deterministic demo
        @npx tsx scripts/demo-doctor.ts
        @npx tsx scripts/demo-run.ts

demo\\:verify: build:cpp ## Run demo with replay verification
        @npx tsx scripts/demo-doctor.ts
        @npx tsx scripts/demo-run.ts
        @echo ""
        @echo "Verifying replay exactness..."
        @./build/Release/requiem.exe log verify --json

demo\\:clean: ## Clean demo artifacts
        @echo "Cleaning demo artifacts..."
        @rm -rf demo_artifacts
        @mkdir -p demo_artifacts
```

### A5: CI Integration

Added to `verify:ci` in `package.json`.

---

## Section B: Contract Freeze + Backcompat Harness

### B1: Authoritative Contract Docs

Created `docs/contracts/` directory with three documents:

#### cli_contract.md

Documents:
- Exit codes (0, 1, 2, 3, 124, 128+N)
- Global flags (`--json`, `--help`, `--version`)
- Command specifications with JSON output schemas
- Error envelope requirements
- Deprecation policy

#### api_envelope_contract.md

Documents:
- Success envelope: `{ok: true, data: T, trace_id, request_id, timestamp}`
- Error envelope: `{ok: false, error: {code, message, hint}, trace_id, ...}`
- Pagination schema
- Streaming response format
- HTTP status code mapping
- Error code registry (client and server errors)

#### schema_versioning.md

Documents:
- Semantic versioning (SemVer 2.0.0)
- Breaking vs additive changes
- Deprecation process (4 steps)
- Compatibility matrix
- Current contract versions

### B2: Contract Snapshots

**Location:** `tests/contracts/` (directory created, snapshots committed as baseline)

Snapshot strategy:
- Store normalized output (volatile fields redacted)
- Focus on structure, not values
- Allow additive changes (new optional fields)
- Block breaking changes (removed/renamed fields)

### B3: Contract Verification

**File:** `scripts/verify-cli-contract.ts`

Checks:
- Help output includes documented commands
- JSON responses have required fields
- Error envelopes follow contract
- Exit codes are as documented
- No secrets in capability output
- CLI commands respond correctly

**Usage:**
```bash
npx tsx scripts/verify-cli-contract.ts
pnpm run verify:contracts
```

### B4: Deprecation Policy

Documented in `schema_versioning.md`:

1. Mark deprecated (Minor release)
2. Add compatibility shim (same release)
3. Sunset period (full major cycle)
4. Removal (next major)

---

## Section C: Enforcement Verify Suite

### C1: Verify Scripts

#### verify:nosecrets

**File:** `scripts/verify-nosecrets.ts`

Checks:
- CLI output for secret patterns
- Log files for leaked tokens
- Source code for hardcoded secrets

Patterns detected:
- `secret_key`, `private_key`, `token`, `api_key`, `password`
- Hex strings (64-128 chars)
- JWT tokens
- Environment variable exposure

**Usage:**
```bash
npx tsx scripts/verify-nosecrets.ts
pnpm run verify:nosecrets
```

#### verify:no-stack-leaks

**File:** `scripts/verify-no-stack-leaks.ts`

Checks:
- API routes for proper error wrapping
- Error response utilities for stack patterns
- CLI source for raw exception output

Prohibited in responses:
- `"stack"` fields
- `"traceback"` fields
- File paths (`src/...`, `node_modules/...`)
- Line numbers in paths

**Usage:**
```bash
npx tsx scripts/verify-no-stack-leaks.ts
pnpm run verify:no-stack-leaks
```

#### verify:demo

**File:** Combination of `demo-doctor.ts` and `demo-run.ts`

**Usage:**
```bash
pnpm run verify:demo
```

#### verify:contracts

**File:** `scripts/verify-cli-contract.ts`

**Usage:**
```bash
pnpm run verify:contracts
```

### C2: Secrets + Leak Hygiene

Implemented guarantees:

1. **Capability tokens** — Only fingerprint returned after mint, never the token itself
2. **Redaction utilities** — Centralized in codebase, reused everywhere
3. **Safe grep patterns** — Tuned to minimize false positives
4. **CI enforcement** — `verify:nosecrets` runs on every build

### C3: CI Wiring

Updated `package.json`:

```json
{
  "verify:ci": "npm-run-all verify verify:cpp verify:ai verify:routes verify:contracts verify:nosecrets verify:no-stack-leaks verify:demo verify:ratchet verify:entropy"
}
```

Quality gate now includes:
1. lint
2. typecheck
3. verify:boundaries
4. verify:cpp
5. verify:contracts
6. verify:nosecrets
7. verify:no-stack-leaks
8. verify:demo
9. verify:ratchet
10. verify:entropy

---

## Section D: Additional Needle-Movers

### D1: Demo Documentation

**File:** `docs/DEMO.md`

Contents:
- 60-second quick start
- What the demo does (vertical slice)
- Expected output
- Replay exactness verification
- Where to find receipts/logs
- Common failures and fixes
- Manual demo steps
- Web UI demo

### D2: Error UX Clarity

All API errors now map to typed envelopes with:
- `code` — Machine-readable error code
- `message` — Human-readable description
- `trace_id` — Distributed tracing correlation
- `hint` — Safe, actionable suggestion

UI shows:
- Error code
- Trace ID (for debug bundle)
- Safe hint
- **No stack traces**

### D3: Repo Hygiene

Ensured:
- `.editorconfig` — Consistent formatting
- `.gitignore` — `demo_artifacts/` ignored
- `package.json` — Scripts documented
- `Makefile` — Help text for all targets

Removed dead references:
- Aspirational commands removed from README
- All documented commands exist and work

---

## Contract Surfaces Frozen

| Surface | Version | Frozen Until |
|---------|---------|--------------|
| CLI Commands | v1.x | v2.0.0 |
| CLI Exit Codes | v1.x | v2.0.0 |
| CLI JSON Output | v1.x | v2.0.0 |
| API Envelope | v1.x | v2.0.0 |
| Error Codes | v1.x | v2.0.0 |
| CAS Format | v2 | v3.0.0 |
| Capability Token | v1 | v2.0.0 |

---

## Commands Run to Verify

### From Requiem Root

```bash
# Installation
pnpm install
make build

# Lint
pnpm run lint

# Typecheck
pnpm run typecheck

# Tests
make test

# Build
make build

# Contract verification
pnpm run verify:contracts

# Demo verification
pnpm run verify:demo

# Secrets verification
pnpm run verify:nosecrets

# Stack leak verification
pnpm run verify:no-stack-leaks

# Doctor
make doctor

# Demo replay exactness
make demo:verify
```

### From Web Root (ready-layer)

```bash
# Installation
pnpm install

# Lint
pnpm run lint

# Typecheck
pnpm run type-check

# Tests
pnpm test

# Build
pnpm run build
```

---

## Final Gates: STATUS

| Gate | Status | Notes |
|------|--------|-------|
| install | PASS | pnpm install works |
| lint | PASS | No errors |
| typecheck | PASS | No errors |
| tests | PASS | C++ tests pass |
| build | PASS | Engine and web build |
| verify:contracts | PASS | Contract checks pass |
| verify:demo | PASS | Demo runs successfully |
| verify:nosecrets | PASS | No secrets detected |
| verify:no-stack-leaks | PASS | No stack leak patterns |
| doctor | PASS | Health check passes |
| demo replay exactness | PASS | Deterministic output |
| web build | PASS | Next.js builds |

---

## Conclusion

All industrialization requirements have been implemented:

1. **Demo Reliability Lock** — One-command demo with deterministic fixtures
2. **Contract Freeze** — Authoritative docs, snapshots, and verification
3. **Enforcement Suite** — Secrets, stack leaks, and demo verification
4. **Needle-Movers** — Documentation, error UX, and repo hygiene

The system is now **demo-proof**, **contract-stable**, **CI-enforced**, and **launch-ready**.

---

## References

- `docs/contracts/cli_contract.md`
- `docs/contracts/api_envelope_contract.md`
- `docs/contracts/schema_versioning.md`
- `docs/DEMO.md`
- `scripts/demo-run.ts`
- `scripts/demo-doctor.ts`
- `scripts/verify-cli-contract.ts`
- `scripts/verify-nosecrets.ts`
- `scripts/verify-no-stack-leaks.ts`
