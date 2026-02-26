# Bench Output

`requiem bench run --spec <json> --out <json>` emits:
- `latency_ms.p50/p95/p99`
- `throughput_ops_sec`
- `result_digests[]` for drift checks

`requiem drift analyze --bench <bench.json> --out <drift.json>` emits:
- `drift.ok`
- `drift.mismatches[]` with category, expected/observed, run indices, hints
