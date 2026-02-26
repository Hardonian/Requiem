#!/usr/bin/env bash
set -euo pipefail
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
health_json="$(./build/requiem_cli health)"
echo "$health_json"
if ! echo "$health_json" | rg -q '"hash_primitive":"blake3"'; then
  echo "hash primitive is not blake3"
  exit 2
fi
if echo "$health_json" | rg -q '"hash_backend":"fallback"|"hash_backend":"unavailable"'; then
  echo "hash backend is not authoritative"
  exit 2
fi
./build/requiem_cli validate-replacement
