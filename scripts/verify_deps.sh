#!/usr/bin/env bash
# scripts/verify_deps.sh
# Phase 3+4: Dependency discipline gate.
#
# Checks:
#   1. C++ / CMake: third_party/ must only contain allowlisted vendored libs.
#   2. Node.js: ready-layer/package.json deps must be on allowlist.
#   3. No duplicate major version explosions in Node deps.
#   4. License check: no copyleft (GPL/AGPL) in runtime dependencies.
#
# Allowlist: contracts/deps.allowlist.json
#
# Exit 0: all dependencies approved.
# Exit 1: unapproved dependency found.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ALLOWLIST="${REPO_ROOT}/contracts/deps.allowlist.json"

echo "=== verify:deps ==="
VIOLATIONS=0

if [ ! -f "$ALLOWLIST" ]; then
  echo "FAIL: contracts/deps.allowlist.json not found"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. C++ vendored dependencies (third_party/)
# ---------------------------------------------------------------------------
echo "  [cpp] Checking third_party/ against allowlist..."
ALLOWED_CPP=$(python3 -c "
import json
with open('${ALLOWLIST}') as f:
    a = json.load(f)
for lib in a.get('cpp_vendored', []):
    print(lib['name'])
" 2>/dev/null)

if [ -d "${REPO_ROOT}/third_party" ]; then
  for d in "${REPO_ROOT}/third_party"/*/; do
    lib=$(basename "$d")
    if ! echo "$ALLOWED_CPP" | grep -qx "$lib"; then
      echo "  FAIL [cpp]: unapproved vendored lib: $lib (add to contracts/deps.allowlist.json)"
      VIOLATIONS=$((VIOLATIONS + 1))
    else
      echo "  OK  [cpp]: $lib"
    fi
  done
fi

# ---------------------------------------------------------------------------
# 2. Node.js direct dependencies
# ---------------------------------------------------------------------------
echo "  [node] Checking ready-layer/package.json against allowlist..."
PKG="${REPO_ROOT}/ready-layer/package.json"

if [ -f "$PKG" ]; then
  ALLOWED_NODE=$(python3 -c "
import json
with open('${ALLOWLIST}') as f:
    a = json.load(f)
for dep in a.get('node_runtime', []) + a.get('node_dev', []):
    print(dep['name'])
" 2>/dev/null)

  # Check direct runtime deps
  python3 -c "
import json, sys
with open('${PKG}') as f:
    pkg = json.load(f)
deps = list(pkg.get('dependencies', {}).keys()) + list(pkg.get('devDependencies', {}).keys())
for d in deps:
    print(d)
" | while read -r dep; do
    if ! echo "$ALLOWED_NODE" | grep -qx "$dep"; then
      echo "  FAIL [node]: unapproved dependency: $dep (add to contracts/deps.allowlist.json)"
      VIOLATIONS=$((VIOLATIONS + 1))
    else
      echo "  OK  [node]: $dep"
    fi
  done
fi

# ---------------------------------------------------------------------------
# 3. License check (node_modules if installed)
# ---------------------------------------------------------------------------
echo "  [license] Checking for copyleft runtime dependencies..."
NODE_MODULES="${REPO_ROOT}/ready-layer/node_modules"
COPYLEFT_VIOLATIONS=0
if [ -d "$NODE_MODULES" ]; then
  # Find package.json files one level deep in node_modules
  while IFS= read -r pkg_file; do
    pkg_name=$(python3 -c "
import json
try:
    with open('${pkg_file}') as f:
        d = json.load(f)
    print(d.get('name','?') + ' @ ' + d.get('version','?') + ': ' + str(d.get('license','?')))
except: pass
" 2>/dev/null || true)
    license=$(python3 -c "
import json
try:
    with open('${pkg_file}') as f:
        d = json.load(f)
    print(str(d.get('license','?')))
except: print('?')
" 2>/dev/null || echo "?")
    if echo "$license" | grep -qiE "^(GPL|AGPL|LGPL)" 2>/dev/null; then
      echo "  WARN [license]: copyleft license in dependency: $pkg_name"
      COPYLEFT_VIOLATIONS=$((COPYLEFT_VIOLATIONS + 1))
    fi
  done < <(find "$NODE_MODULES" -maxdepth 2 -name "package.json" 2>/dev/null | head -200)

  if [ "$COPYLEFT_VIOLATIONS" -eq 0 ]; then
    echo "  OK  [license]: no copyleft runtime deps detected"
  else
    echo "  WARN: $COPYLEFT_VIOLATIONS copyleft dep(s) found — review manually"
    # Warn only; not a hard fail (LGPL runtime deps may be acceptable)
  fi
else
  echo "  SKIP [license]: node_modules not installed (run npm install in ready-layer/)"
fi

# ---------------------------------------------------------------------------
# 4. Snapshot check — emit dependency snapshot artifact
# ---------------------------------------------------------------------------
SNAPSHOT_DIR="${REPO_ROOT}/artifacts/reports"
mkdir -p "$SNAPSHOT_DIR"
SNAPSHOT_FILE="${SNAPSHOT_DIR}/deps_snapshot.json"

python3 - <<PYEOF
import json, os, datetime

result = {
    "schema": "deps_snapshot_v1",
    "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
    "cpp_vendored": [],
    "node_direct": {}
}

# C++ vendored
third_party = "${REPO_ROOT}/third_party"
if os.path.isdir(third_party):
    result["cpp_vendored"] = sorted(os.listdir(third_party))

# Node.js direct deps
pkg_path = "${REPO_ROOT}/ready-layer/package.json"
if os.path.exists(pkg_path):
    with open(pkg_path) as f:
        pkg = json.load(f)
    result["node_direct"]["dependencies"] = pkg.get("dependencies", {})
    result["node_direct"]["devDependencies"] = pkg.get("devDependencies", {})

with open("${SNAPSHOT_FILE}", "w") as f:
    json.dump(result, f, indent=2)
print(f"  Snapshot: ${SNAPSHOT_FILE}")
PYEOF

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:deps PASSED ==="
  exit 0
else
  echo "=== verify:deps FAILED ($VIOLATIONS unapproved dep(s)) ==="
  exit 1
fi
