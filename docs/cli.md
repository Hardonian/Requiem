# Reach CLI Reference

The Reach CLI (`requiem` / `reach`) is the command-line interface for the Requiem control plane.

## Category Definition

Requiem is a **control plane for AI systems**, not a wrapper, router, or dashboard. It enforces invariants:

- **Deterministic replay semantics** — identical inputs produce identical outputs
- **Policy enforcement boundaries** — deny-by-default on every invocation
- **Provenance fingerprinting** — every execution has a cryptographic proof
- **Economic compute units** — explicit metering, not hidden costs
- **Observability spine** — complete trace from request to proof

## Installation

```bash
# From the monorepo
cd packages/cli
pnpm install
pnpm run build

# The CLI is available as both `requiem` and `reach`
```

## Global Flags

| Flag              | Description                  |
| ----------------- | ---------------------------- |
| `--json`          | Output in JSON format        |
| `--minimal`       | Quiet deterministic output   |
| `--explain`       | Verbose structural reasoning |
| `--trace`         | Optional execution insight   |
| `--help`, `-h`    | Show help for a command      |
| `--version`, `-v` | Show version information     |

## Commands by Layer

### CONTROL (Deterministic Execution)

#### `requiem run <name> [input]`

Execute a tool with determinism proof.

```bash
requiem run system.echo "hello" [--json] [--explain]
```

#### `requiem verify <hash>`

Verify execution determinism.

```bash
requiem verify <result_digest> [--json]
```

#### `requiem replay run <id>`

Replay an execution with verification.

```bash
requiem replay run <execution_id> [--json]
```

#### `requiem replay diff <run1> <run2>`

Deterministic diff between two runs.

```bash
requiem replay diff run1 run2 [--format=json]
```

#### `requiem fingerprint <hash>`

Generate shareable execution proof.

```bash
requiem fingerprint <result_digest>
```

---

### OBSERVABILITY

#### `requiem trace <id>`

Visualize decision trace.

```bash
requiem trace <execution_id> [--json]
```

#### `requiem stats`

Determinism metrics, policy events, replay state.

```bash
requiem stats [--json]
```

#### `requiem status`

System health and enforcement state.

```bash
requiem status [--json]
```

#### `requiem telemetry`

Real-time usage stats.

```bash
requiem telemetry [--json]
```

---

### GOVERNANCE

#### `requiem learn [--window=7d]`

Show learning signals and diagnoses.

```bash
requiem learn --window=7d [--format=json]
```

#### `requiem realign <patch-id>`

Apply patch in new branch and verify.

```bash
requiem realign <patch_id>
```

#### `requiem pivot plan <name>`

Plan a strategic pivot.

```bash
requiem pivot plan <name>
```

#### `requiem symmetry [--economics]`

Show symmetry metrics.

```bash
requiem symmetry [--economics]
```

#### `requiem economics [--alerts|--forecast]`

Show economic metrics.

```bash
requiem economics --forecast
```

---

### PROOF SURFACES (Microfracture Suite)

#### `requiem diff <runA> <runB>`

Deterministic diff between runs.

```bash
requiem diff runA runB [--format=json]
```

#### `requiem lineage <runId> [--depth=N]`

Show run ancestry graph.

```bash
requiem lineage <run_id> --depth=3
```

#### `requiem simulate <runId> --policy=<name>`

Simulate policy evaluation.

```bash
requiem simulate <run_id> --policy=default
```

#### `requiem drift --since=<runId> [--window]`

Analyze behavior drift over time.

```bash
requiem drift --since=7d --window=30d
```

#### `requiem explain <runId> [--format=md|json]`

Generate deterministic explanation.

```bash
requiem explain <run_id> --format=md
```

#### `requiem share <runId> [--ttl] [--scope]`

Create shareable proof link.

```bash
requiem share <run_id> --ttl=24h --scope=public
```

#### `requiem chaos --quick [--format]`

Run chaos verification checks.

```bash
requiem chaos --quick
```

#### `requiem usage [--format]`

Show tenant usage summary.

```bash
requiem usage --format=json
```

#### `requiem tenant-check [--format]`

Verify tenant isolation.

```bash
requiem tenant-check --format=json
```

---

### ENTERPRISE

#### `requiem decide evaluate --junction <id>`

Evaluate a decision for a junction.

```bash
requiem decide evaluate --junction <id>
```

#### `requiem decide explain --junction <id>`

Explain why a decision was made.

```bash
requiem decide explain --junction <id>
```

#### `requiem decide outcome --id <id> --status <status>`

Record an outcome.

```bash
requiem decide outcome --id <id> --status=approved
```

#### `requiem junctions scan --since <time>`

Scan for junctions.

```bash
requiem junctions scan --since=7d
```

#### `requiem agent serve --tenant <id>`

Start MCP stdio server.

```bash
requiem agent serve --tenant <tenant_id>
```

#### `requiem ai tools list`

List all registered AI tools.

```bash
requiem ai tools list [--json]
```

#### `requiem ai skills run <name>`

Run an AI skill.

```bash
requiem ai skills run <skill_name>
```

---

### TOOL MANAGEMENT

#### `requiem tool list [--json] [--capability <cap>]`

List all registered AI tools.

```bash
requiem tool list [--json] [--capability=compute]
```

#### `requiem tool exec <name> --input <json>`

Execute a registered tool by name.

```bash
requiem tool exec <name> --input '{"key":"value"}' [--tenant <id>]
```

---

### DASHBOARD & SETUP

#### `requiem ui [--port <port>] [--host <host>]`

Launch the web dashboard.

```bash
requiem ui --port=3000
```

#### `requiem quickstart`

10-minute proof flow.

```bash
requiem quickstart
```

#### `requiem init`

Initialize configuration.

```bash
requiem init
```

---

### ADMIN

#### `requiem backup`

Dump database to JSON.

```bash
requiem backup
```

#### `requiem restore`

Restore database from JSON.

```bash
requiem restore <backup_file>
```

#### `requiem import`

Ingest decision logs from CSV.

```bash
requiem import <file.csv>
```

#### `requiem nuke`

Clear database state.

```bash
requiem nuke [--confirm]
```

#### `requiem doctor [--json]`

Validate environment setup.

```bash
requiem doctor [--json]
```

#### `requiem bugreport`

Generate diagnostic report.

```bash
requiem bugreport
```

#### `requiem selftest`

Run comprehensive self-diagnostic checks.

```bash
requiem selftest
```

#### `requiem bench`

Sub-millisecond latency baseline.

```bash
requiem bench
```

#### `requiem fast-start [--minimal]`

Cached skip of engine/DB checks.

```bash
requiem fast-start --minimal
```

## Environment Variables

| Variable                   | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `DECISION_ENGINE`          | Engine type: `ts` or `requiem` (default: `ts`) |
| `FORCE_RUST`               | Force TypeScript fallback: `true`/`false`      |
| `REQUIEM_ENGINE_AVAILABLE` | Set to `true` if native engine is built        |
| `REQUIEM_WORKSPACE_ROOT`   | Workspace root path                            |
| `REQUIEM_TENANT_ID`        | Default tenant ID                              |
| `REQUIEM_ENTERPRISE`       | Enable enterprise features                     |

## Exit Codes

| Code | Meaning             |
| ---- | ------------------- |
| 0    | SUCCESS             |
| 1    | GENERAL_ERROR       |
| 2    | INVALID_ARGUMENTS   |
| 3    | POLICY_VIOLATION    |
| 4    | DETERMINISM_FAILURE |
| 5    | REPLAY_MISMATCH     |
| 6    | CONFIG_ERROR        |
| 7    | DB_ERROR            |
| 8    | NETWORK_ERROR       |
| 9    | PERMISSION_DENIED   |

### DURABILITY EVIDENCE

#### `requiem test:durability`

Run disk-backed durability verification and emit `bench/recovery-report.json`.

```bash
requiem test:durability
```

#### `requiem test:fault-injection`

Run deterministic failpoint crash matrix and emit `bench/crash-matrix-report.json`.

```bash
requiem test:fault-injection
```

#### `requiem doctor`

Run startup and environment diagnostics.

```bash
requiem doctor --json
```

#### `requiem evidence`

Bundle benchmark and durability artifacts under `bench/evidence`.

```bash
requiem evidence
```
