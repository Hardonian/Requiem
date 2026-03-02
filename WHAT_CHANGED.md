# WHAT_CHANGED - Requiem CLI and Web Console Expansion

## Overview
This update completes the full CLI surface and web console as specified in the kernel specification.

---

## PHASE A - CLI Command Surfaces

### New Commands Implemented

#### 1. CAS (Content-Addressable Storage)
**File:** `packages/cli/src/commands/cas.ts`
- `reach cas put <file>` - Store a file in CAS with BLAKE3 digest
- `reach cas get <digest>` - Retrieve file by digest
- `reach cas ls [prefix]` - List CAS objects with pagination
- `reach cas verify [--fix]` - Verify CAS integrity
- `reach cas gc [--dry-run] [--age=N]` - Safe garbage collection

#### 2. Capabilities
**File:** `packages/cli/src/commands/caps.ts`
- `reach caps mint <name> [--expires=<duration>]` - Mint capability token
- `reach caps inspect <token>` - Inspect capability details
- `reach caps list [--all]` - List active capabilities
- `reach caps revoke <token>` - Revoke capability token

#### 3. Policy
**File:** `packages/cli/src/commands/policy.ts`
- `reach policy add <file>` - Add new policy
- `reach policy list` - List all policies
- `reach policy eval <policy>` - Evaluate policy against context
- `reach policy versions <policy>` - Show version history
- `reach policy test <policy>` - Run policy test cases

#### 4. Snapshots
**File:** `packages/cli/src/commands/snapshots.ts`
- `reach snapshots create [--name=<name>]` - Create snapshot
- `reach snapshots list` - List snapshots with pagination
- `reach snapshots restore <id>` - Restore snapshot (gated)
- `reach snapshots show <id>` - Show snapshot details

#### 5. Event Log Enhancements
**File:** `packages/cli/src/commands/logs.ts`
- Added `reach logs verify` - Verify log integrity and prev-hash chain

#### 6. Budget Receipts
**File:** `packages/cli/src/commands/budget.ts`
- Added `reach budget receipt show <id>` - Show receipt details
- Added `reach budget receipt verify <id>` - Verify receipt integrity

---

## PHASE B - Web Console Pages

### Pages Implemented
**Location:** `ready-layer/src/app/console/`

1. **logs/page.tsx** - Event log viewer with search, filter, pagination
2. **objects/page.tsx** - CAS object browser with integrity verification
3. **capabilities/page.tsx** - Capability token management with revoke
4. **policies/page.tsx** - Policy listing and management
5. **runs/page.tsx** - Execution history with status
6. **plans/page.tsx** - Plan definitions
7. **finops/page.tsx** - Budget tracking and financial operations
8. **snapshots/page.tsx** - Snapshot management with restore

---

## PHASE C - CI Verify Scripts

### Scripts Created
**Location:** `packages/cli/src/`

1. **verify-boundaries.ts** - Verify tenant isolation and boundary integrity
2. **verify-integrity.ts** - Verify data integrity and checksums
3. **verify-policy.ts** - Verify policy configuration
4. **verify-replay.ts** - Verify replay capability
5. **verify-web.ts** - Verify web console pages and API routes
6. **verify-all.ts** - Master script that runs all verifications

### NPM Scripts Added
```json
"verify:boundaries": "tsx src/verify-boundaries.ts",
"verify:integrity": "tsx src/verify-integrity.ts",
"verify:policy": "tsx src/verify-policy.ts",
"verify:replay": "tsx src/verify-replay.ts",
"verify:web": "tsx src/verify-web.ts",
"verify:all": "tsx src/verify-all.ts"
```

---

## API Routes

### Existing Routes (Enhanced)
- `/api/logs` - Event log entries with pagination
- `/api/objects` - CAS object operations
- `/api/caps` - Capability operations
- `/api/policies` - Policy management
- `/api/runs` - Execution history
- `/api/plans` - Plan operations
- `/api/budgets` - Budget operations
- `/api/snapshots` - Snapshot operations

---

## Key Features

### All Commands:
- Support `--json` for structured output
- Use typed error envelopes
- Never expose secrets (only fingerprints)
- Follow kernel invariants

### All Web Pages:
- Use React with TypeScript
- Include loading states
- Include error handling
- Follow consistent UI patterns

### All Verify Scripts:
- Return proper exit codes
- Check data integrity
- Verify system invariants

---

## Breaking Changes
None - all additions are additive.

---

## Migration Notes
None required - new functionality only.

---

## Related Documentation
- `docs/KERNEL_SPEC.md` - Authoritative kernel specification
- `docs/cli.md` - CLI reference
- `docs/reference/console.md` - Console reference
