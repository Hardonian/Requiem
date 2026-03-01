# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-20.x-green)](#quickstart)
[![Security](https://img.shields.io/badge/security-audit_complete-brightgreen)](docs/SECURITY.md)

Deterministic AI execution platform with tenant isolation, replay, and audit.

## Quickstart (3 commands)

This demonstrates Requiem's core guarantee: **identical inputs always produce an identical `result_digest`**, across runs, workers, and time.

No database required for the core engine. The engine proves determinism on its own.

```bash
# 1. Clone and install
git clone https://github.com/Hardonian/Requiem.git && cd Requiem && pnpm install

# 2. Build the native engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j

# 3. Prove determinism — runs the same workload 3× and verifies all result_digests match
./build/requiem demo
```

Expected output:
```json
{"ok":true,"deterministic":true,"runs":3,"result_digest":"<hash>","latency_ms":[...]}
```

**Determinism is confirmed when `"deterministic":true` and all three runs share the same `result_digest`.**

### Inspect Policy and Version Contracts

```bash
# View the active policy (hash algorithm, CAS version, tenant rules, license allowlist)
./build/requiem policy explain
### 1. Interactive Setup (Recommended)

The easiest way to get started is with the interactive quickstart command. It will check your environment, start the database, and run a demo.

```bash
pnpm exec reach quickstart
```

### 2. Manual Setup

If you prefer to run commands manually:

#### Setup Environment

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install
cp .env.example .env
docker-compose up -d
```

#### Run a Command & Get a Hash

Execute a command through the Requiem CLI (`reach`). Every deterministic execution returns a unique, verifiable hash.

```bash
pnpm exec reach run system.echo "Hello, Determinism!"
```

# View all version constants enforced at startup
./build/requiem version
```

Policy enforcement is not implicit. `policy explain` shows every active constraint. `version` shows every numeric constant that CI verifies.

### Replay an Execution

```bash
# Execute a workload and capture the result
./build/requiem exec run --request docs/examples/exec_request_smoke.json --out build/result.json

# Replay and verify: re-runs in sandbox, fails if result_digest diverges
./build/requiem exec replay \
  --request docs/examples/exec_request_smoke.json \
  --result build/result.json \
  --cas .requiem/cas/v2
#### Verify Determinism

You can now use this hash to verify the execution. Requiem will re-run the command in a hermetic sandbox and verify that the new output cryptographically matches the original.

```bash
pnpm exec reach verify <paste-your-execution-hash-here>
```

> **Two CLIs:** `./build/requiem` (C++ native engine — determinism, CAS, replay, policy) and `pnpm exec requiem` (TypeScript control plane — AI decisions, junctions, MCP). See **[CLI Reference](docs/cli.md)**.

> For the web dashboard (requires PostgreSQL), see **[ReadyLayer setup](ready-layer/README.md)**.
#### Launch Dashboard

Visualize your executions and audit logs in the local dashboard.

```bash
pnpm exec reach ui
```

> For a full list of available commands, see the **[CLI Reference](docs/cli.md)**.

## Core Concepts

At its heart, Requiem is a system for creating, storing, and verifying records of execution. The data model reflects this simple purpose. This is the Prisma schema that powers the ReadyLayer dashboard:

```prisma
// ready-layer/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  tenantId   String   @map("tenant_id")
  actorId    String   @map("actor_id")
  action     String
  resourceId String?  @map("resource_id")
  traceId    String   @map("trace_id")
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([tenantId, createdAt])
  @@map("audit_logs")
}

// ─── AI Cost Records ──────────────────────────────────────────────────────────

model AiCostRecord {
  id           String   @id @default(cuid())
  tenantId     String   @map("tenant_id")
  actorId      String   @map("actor_id")
  provider     String
  model        String
  inputTokens  Int      @map("input_tokens")
  outputTokens Int      @map("output_tokens")
  costCents    Int      @map("cost_cents")
  latencyMs    Int      @map("latency_ms")
  traceId      String   @map("trace_id")
  phase        String?
  createdAt    DateTime @default(now()) @map("created_at")

  @@index([tenantId, createdAt])
  @@map("ai_cost_records")
}

// ─── Replay Records ───────────────────────────────────────────────────────────

model ReplayRecord {
  id          String   @id @default(cuid())
  hash        String   @unique
  tenantId    String   @map("tenant_id")
  toolName    String   @map("tool_name")
  toolVersion String   @map("tool_version")
  inputHash   String   @map("input_hash")
  integrity   String
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([tenantId, hash])
  @@map("replay_records")
}
```

## Verification

This repository contains a comprehensive verification suite.

-   **`pnpm run verify`**: Runs all fast, essential checks (lint, typecheck, boundaries). Run this before committing.
-   **`pnpm run verify:ci`**: Runs the complete CI suite, including slower integration and determinism tests.

> For more details on the architecture, see the [Architecture Overview](docs/ARCHITECTURE.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
