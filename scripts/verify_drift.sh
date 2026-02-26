#!/usr/bin/env bash
set -euo pipefail
./build/requiem_cli bench run --spec docs/examples/bench_spec.json --out build/bench_drift.json
./build/requiem_cli drift analyze --bench build/bench_drift.json --out build/drift_drift.json
./build/requiem_cli drift pretty --in build/drift_drift.json
