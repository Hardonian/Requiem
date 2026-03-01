# Requiem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/badge/CI-passing-brightgreen)](#verification)
[![Node](https://img.shields.io/badge/node-20.x-green)](#quickstart)
[![Security](https://img.shields.io/badge/security-audit_complete-brightgreen)](docs/SECURITY.md)

Deterministic AI execution platform with tenant isolation, replay, and audit.

## Quickstart (5 minutes)

This guide will show you Requiem's core value: **guaranteed deterministic execution and replay**.

### 1. Setup Environment

First, clone the repository. This project uses `pnpm` for package management.

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install
```

Next, copy the example environment file. For this quickstart, you won't need to change anything.

```bash
cp .env.example .env
```

### 2. Start the Database

Requiem requires a PostgreSQL database. We've included a `docker-compose.yml` to make this easy.

```bash
docker-compose up -d
```

### 3. Run a Command & Get a Hash

Now, execute a command through the Requiem CLI (`reach`). Every deterministic execution returns a unique, verifiable hash.

```bash
pnpm exec reach run "echo 'Hello, Determinism!'"
```

You will see output that includes an `executionHash`. This is the cryptographic proof of your execution.

### 4. Replay by Hash

You can now use this hash to replay the execution. Requiem will re-run the command in a hermetic sandbox and verify that the new output cryptographically matches the original.

```bash
pnpm exec reach replay <paste-your-execution-hash-here>
```

You should see a `✅ Replay Successful` message. You have just proven that your command's execution is reproducible.

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
