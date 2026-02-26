#!/usr/bin/env bash
set -euo pipefail
./build/requiem_cli bench run --spec docs/examples/bench_spec.json --out build/bench.json
./build/requiem_cli drift analyze --bench build/bench.json --out build/drift.json
