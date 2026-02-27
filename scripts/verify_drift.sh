#!/usr/bin/env bash
set -euo pipefail
./build/requiem bench run --spec docs/examples/bench_spec.json --out build/bench_drift.json
./build/requiem drift analyze --bench build/bench_drift.json --out build/drift_drift.json
./build/requiem drift pretty --in build/drift_drift.json
