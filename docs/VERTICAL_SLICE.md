# VERTICAL_SLICE.md

Status: VERIFIED  
Date: 2026-03-02  
Engine binary: `./build/requiem`

## Goal

Demonstrate deterministic plan execution with verifiable artifacts across kernel and web boundaries.

## Slice Steps

### 1. Build + health

```bash
pnpm build
./build/requiem doctor
```

### 2. Plan verification + hash

```bash
./build/requiem plan verify --plan examples/demo/plan.json
./build/requiem plan hash --plan examples/demo/plan.json
```

Expected:
- `plan.verify` envelope with `data.ok=true`
- deterministic `data.plan_hash`

### 3. Deterministic run

```bash
./build/requiem plan run --plan examples/demo/plan.json
./build/requiem plan run --plan examples/demo/plan.json
```

Expected:
- same `receipt_hash` for same plan inputs

### 4. Event log integrity

```bash
./build/requiem log verify
```

Expected:
- typed envelope (`kind=log.verify`)
- `data.ok=true` and `data.failures=[]`

### 5. Contract verification gates

```bash
pnpm verify:boundaries
pnpm verify:integrity
pnpm verify:policy
pnpm verify:replay
pnpm verify:web
```

## Evidence

- `pnpm verify:demo` passes and executes doctor + plan verify/hash/run + log verify.
- `pnpm verify:replay` confirms same-input receipt hash stability and typed error behavior.
- `pnpm verify:integrity` confirms CAS round-trip/hash determinism and capability revoke flow.
