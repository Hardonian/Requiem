# CLI Reference

> Complete reference for the Requiem CLI (`reach` or `requiem`)

---

## Installation

```bash
npm install -g @requiem/cli
# or
pnpm add -g @requiem/cli
```

The CLI provides two binary aliases:
- `reach` - Short form (recommended)
- `requiem` - Full name

---

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |
| `--minimal` | Quiet, deterministic output |
| `--explain` | Verbose structural reasoning |
| `--trace` | Include execution trace |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

---

## Command Reference

### Control Commands

#### `reach run <name> [input]`
Execute a tool with determinism proof.

```bash
reach run system.echo "hello world"
reach run system.echo "hello" --json
```

**Options:**
- `--tenant <id>` - Run as specific tenant
- `--dry-run` - Validate without executing

---

#### `reach verify <hash>`
Verify execution determinism against stored proof.

```bash
reach verify sha256:abc123...
reach verify sha256:abc123... --json
```

---

#### `reach replay run <id>`
Replay an execution with verification.

```bash
reach replay run exec_123abc
reach replay run exec_123abc --verify
```

---

#### `reach replay diff <run1> <run2>`
Compare two executions for determinism drift.

```bash
reach replay diff exec_abc exec_def
reach replay diff exec_abc exec_def --format json
```

---

### Observability Commands

#### `reach stats`
View determinism rate, policy events, replay state.

```bash
reach stats
reach stats --json
reach stats --minimal
```

**Output:**
```json
{
  "total_decisions": 1523,
  "avg_latency_ms": 45.2,
  "total_cost_usd": 0.043,
  "success_rate": 0.998
}
```

---

#### `reach status`
System health and enforcement state.

```bash
reach status
reach status --json
```

**Output:**
```json
{
  "healthy": true,
  "version": "0.2.0",
  "determinism": { "enforced": true, "hashAlgorithm": "BLAKE3-v1" },
  "policy": { "enforced": true, "mode": "standard" },
  "replay": { "available": true, "storageBackend": "local-ndjson" }
}
```

---

#### `reach trace <id>`
Visualize decision trace.

```bash
reach trace exec_123abc
reach trace exec_123abc --format dot
```

---

### Proof Surface Commands

#### `reach diff <runA> <runB>`
Deterministic diff between runs.

```bash
reach diff run_abc run_def
reach diff run_abc run_def --format json
```

---

#### `reach lineage <runId>`
Show run ancestry graph.

```bash
reach lineage run_abc
reach lineage run_abc --depth=5
```

---

#### `reach drift`
Analyze behavior drift over time.

```bash
reach drift --since=7d
reach drift --since=run_abc --window=24h
```

---

#### `reach explain <runId>`
Generate deterministic explanation.

```bash
reach explain run_abc
reach explain run_abc --format md
```

---

### Governance Commands

#### `reach learn`
Show learning signals and diagnoses.

```bash
reach learn
reach learn --window=7d --format json
```

---

#### `reach symmetry`
Show symmetry metrics.

```bash
reach symmetry
reach symmetry --economics --json
```

---

#### `reach economics`
Show economic metrics.

```bash
reach economics
reach economics --alerts
reach economics --forecast
```

---

### Admin Commands

#### `reach doctor`
Validate environment setup.

```bash
reach doctor
reach doctor --json
reach doctor --fix  # Run repairs
```

**Checks:**
- Database integrity
- CAS consistency
- Engine availability
- Config schema
- Runtime versions

---

#### `reach init`
Initialize configuration.

```bash
reach init
reach init --tenant=myorg
reach init --force
```

---

#### `reach backup`
Dump database to JSON.

```bash
reach backup > backup.json
reach backup --compress
```

---

#### `reach nuke`
Clear database state (destructive).

```bash
reach nuke
reach nuke --force  # Skip confirmation
```

---

### Enterprise Commands

#### `reach decide evaluate --junction <id>`
Evaluate a decision for a junction.

```bash
reach decide evaluate --junction=authz_check --context='{"user":"alice"}'
```

---

#### `reach junctions scan`
Scan for junctions.

```bash
reach junctions scan --since=7d
reach junctions scan --since=24h --format json
```

---

#### `reach agent serve --tenant <id>`
Start MCP stdio server.

```bash
reach agent serve --tenant=myorg
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success / Healthy / Degraded |
| 1 | Error / Unhealthy / Failed |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `REQUIEM_API_URL` | API endpoint for remote engine |
| `REQUIEM_DATA_DIR` | Data directory path |
| `REQUIEM_CONFIG_PATH` | Config file path |
| `REQUIEM_TENANT_ID` | Default tenant ID |
| `REQUIEM_DEBUG` | Enable debug logging |
| `FORCE_RUST` | Use Rust engine (if available) |

---

## Files

| Path | Description |
|------|-------------|
| `~/.requiem/config.json` | User configuration |
| `~/.requiem/data/` | Database and CAS storage |
| `~/.requiem/logs/` | Execution logs |

---

## Quick Reference Card

```bash
# Daily operations
reach doctor                    # Health check
reach stats                     # View metrics
reach status                    # System status

# Execution
reach run <tool> [input]        # Execute tool
reach verify <hash>             # Verify proof
reach replay run <id>           # Replay execution

# Investigation
reach trace <id>                # View trace
reach explain <id>              # Get explanation
reach diff <a> <b>              # Compare runs

# Maintenance
reach init                      # Setup
reach backup                    # Create backup
reach doctor --fix              # Repair issues
```

---

*See also: [Console Reference](./console.md), [Troubleshooting](../troubleshooting.md)*
