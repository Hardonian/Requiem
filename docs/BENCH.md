# Benchmarking Guide

## Overview

Requiem includes a built-in benchmark harness for measuring:

- Execution latency (min, max, mean, stddev)
- Percentiles (p50, p90, p95, p99)
- Throughput (ops/sec)
- Drift detection (determinism verification)
- CAS hit rates

## Running Benchmarks

### Basic Benchmark

```bash
# Create benchmark spec
cat > bench_spec.json << 'EOF'
{
  "command": "/bin/sh",
  "argv": ["-c", "echo hello"],
  "workspace_root": "/tmp/bench",
  "timeout_ms": 1000,
  "runs": 100
}
EOF

# Run benchmark
requiem bench run --spec bench_spec.json --out bench_result.json

# View results
cat bench_result.json
```

### Output Format

```json
{
  "runs": 100,
  "result_digests": [
    "abc123...",
    "abc123...",
    ...
  ],
  "latency_ms": {
    "min": 1.23,
    "max": 5.67,
    "mean": 2.34,
    "stddev": 0.56,
    "p50": 2.10,
    "p90": 3.20,
    "p95": 3.80,
    "p99": 4.50
  },
  "throughput_ops_sec": 42.7,
  "drift_count": 0
}
```

## Drift Detection

### What is Drift?

Drift occurs when the same input produces different digests across runs. This indicates non-deterministic behavior.

Common causes:
- Unseeded random numbers
- Timestamps in output
- PID-dependent behavior
- Unordered iteration
- Race conditions

### Detecting Drift

```bash
# Run benchmark
requiem bench run --spec spec.json --out bench.json

# Analyze for drift
requiem drift analyze --bench bench.json --out drift.json

# View drift report
requiem drift pretty --in drift.json
```

### Drift Report Format

```json
{
  "drift": {
    "ok": false,
    "mismatches": [
      {
        "category": "digest",
        "expected": "abc123...",
        "observed": "def456...",
        "run_indices": [5, 12, 18],
        "hints": ["env key present outside allowlist"]
      }
    ]
  }
}
```

## Regression Testing

### Compare Benchmarks

```bash
# Run baseline
requiem bench run --spec spec.json --out baseline.json

# Run current (after changes)
requiem bench run --spec spec.json --out current.json

# Compare
requiem bench compare --baseline baseline.json --current current.json --out comparison.json
```

### Comparison Output

```json
{
  "comparison": {
    "regression": false,
    "p50_delta_pct": 2.5,
    "p95_delta_pct": -1.2,
    "baseline_p50": 2.10,
    "current_p50": 2.15
  }
}
```

### Regression Thresholds

Default thresholds:
- p50 regression: > 10%
- p95 regression: > 10%

CI integration:
```bash
requiem bench compare --baseline baseline.json --current current.json || exit 1
```

## Deterministic Histogram

### Log-Bucket Histogram

For reproducible performance analysis:

```json
{
  "latency_histogram": {
    "bucket_bounds_ms": [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50],
    "bucket_counts": [5, 12, 45, 30, 6, 1, 0, 0, 1]
  }
}
```

Buckets use logarithmic spacing to capture both fast and slow outliers.

## CAS Performance

### Hit Rate Measurement

```bash
# First run (cold cache)
requiem bench run --spec spec.json --out cold.json

# Second run (warm cache)
requiem bench run --spec spec.json --out warm.json
```

CAS hit rate affects:
- Input validation speed
- Output retrieval speed
- Overall throughput

## Stress Testing

### Deterministic Stress Generator

```bash
cat > stress_spec.json << 'EOF'
{
  "command": "/bin/sh",
  "argv": ["-c", "for i in $(seq 1 100); do echo $i; done"],
  "workspace_root": "/tmp/stress",
  "timeout_ms": 5000,
  "runs": 1000,
  "concurrent": 10
}
EOF

requiem bench run --spec stress_spec.json --out stress.json
```

### Watchdog Integration

Stress tests include:
- Deadlock detection
- Memory sampling
- CPU utilization monitoring

## Scheduler Modes

### Repro Mode

For deterministic, reproducible benchmarks:

```json
{
  "policy": {
    "scheduler_mode": "repro"
  }
}
```

Characteristics:
- Single-threaded execution
- Strict FIFO ordering
- Minimal context switching
- Highest determinism

### Turbo Mode

For performance measurement:

```json
{
  "policy": {
    "scheduler_mode": "turbo"
  }
}
```

Characteristics:
- Worker pool execution
- Concurrent where safe
- Higher throughput
- Same digest semantics

## Best Practices

### 1. Warmup

Always include warmup runs:

```bash
# Warmup (results discarded)
requiem bench run --spec spec.json --out /dev/null

# Actual benchmark
requiem bench run --spec spec.json --out results.json
```

### 2. Statistical Significance

Minimum runs for reliable results:

| Metric | Min Runs |
|--------|----------|
| p50 | 30 |
| p95 | 100 |
| p99 | 200 |
| stddev | 50 |

### 3. Isolation

Run benchmarks on dedicated hardware:
- Disable CPU frequency scaling
- Pin to specific cores
- Disable SMT if possible
- Stop other services

### 4. Drift Monitoring

Continuous monitoring:

```bash
#!/bin/bash
requiem bench run --spec spec.json --out results.json
requiem drift analyze --bench results.json --out drift.json

if ! jq -e '.drift.ok' drift.json > /dev/null; then
  echo "DRIFT DETECTED!"
  exit 1
fi
```

## Troubleshooting

### High Variance

Causes:
- Background processes
- CPU frequency scaling
- Network activity
- Disk I/O contention

Solutions:
- Increase runs
- Isolate benchmark environment
- Use `taskset` for CPU pinning

### Drift in Deterministic Workload

Check:
1. Environment variables (use `policy.env_denylist`)
2. Time-based operations
3. Random number generation
4. Process IDs in output
5. Hash table iteration order

### CAS Misses

If CAS hit rate is low:
- Check CAS directory is shared between runs
- Verify CAS integrity with `requiem cas verify`
- Ensure consistent workspace paths

## Example: CI Integration

```yaml
# .github/workflows/benchmark.yml
name: Benchmark
on: [pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build
        run: cmake --build build
      
      - name: Download baseline
        uses: actions/download-artifact@v3
        with:
          name: benchmark-baseline
          path: baseline/
        continue-on-error: true
      
      - name: Run benchmark
        run: |
          requiem bench run --spec bench/spec.json --out results.json
          requiem drift analyze --bench results.json --out drift.json
      
      - name: Check for drift
        run: |
          if ! jq -e '.drift.ok' drift.json; then
            echo "Non-deterministic behavior detected!"
            exit 1
          fi
      
      - name: Compare to baseline
        if: hashFiles('baseline/results.json') != ''
        run: |
          requiem bench compare \
            --baseline baseline/results.json \
            --current results.json || exit 1
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-baseline
          path: results.json
```
