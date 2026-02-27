#!/usr/bin/env bash
set -euo pipefail
./build/requiem bench run --spec docs/examples/bench_spec.json --out build/bench.json
./build/requiem drift analyze --bench build/bench.json --out build/drift.json
