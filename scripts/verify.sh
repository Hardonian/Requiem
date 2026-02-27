#!/usr/bin/env bash
set -euo pipefail

echo "=== verify: build + test ==="

# Build with zstd if available, otherwise without
if pkg-config --exists libzstd 2>/dev/null; then
  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
else
  cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DREQUIEM_WITH_ZSTD=OFF
fi
cmake --build build -j
ctest --test-dir build --output-on-failure

echo "=== verify: PASSED ==="
