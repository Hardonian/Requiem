#!/usr/bin/env bash
set -euo pipefail
health_json="$(./build/requiem health)"
echo "$health_json"
if ! echo "$health_json" | grep -q '"hash_primitive":"blake3"'; then
  echo "hash primitive is not blake3"
  exit 2
fi
if echo "$health_json" | grep -qE '"hash_backend":"fallback"|"hash_backend":"unavailable"'; then
  echo "hash backend is not authoritative"
  exit 2
fi
./build/requiem validate-replacement
