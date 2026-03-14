# Benchmarks

Benchmark claims must be tied to real command output.

## Commands

```bash
pnpm benchmark
pnpm evidence
pnpm verify:benchmark-drift
```

## Reporting rules

- Report command, commit SHA, and environment for every number.
- Treat benchmark output as environment-specific unless repeated in controlled conditions.
- Do not claim universal throughput/latency guarantees from one local run.

## Evidence policy

Include generated benchmark artifacts in review material when publishing performance claims.
