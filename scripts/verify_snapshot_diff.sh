#!/usr/bin/env bash
# scripts/verify_snapshot_diff.sh
# Governance gate: deps_snapshot.json PR diff check.
#
# Compares the current generated deps_snapshot.json against the base branch
# committed snapshot. Fails if any new dependency appears in the PR that is
# not listed in contracts/deps.allowlist.json.
#
# Design:
#   - verify_deps.sh already validates direct deps against the allowlist.
#   - This script adds a second enforcement layer: diff-based detection.
#     Any dep that NEWLY appears in the snapshot vs. the base branch must
#     be pre-approved in the allowlist. This catches cases where:
#       a) A dep was added to package.json but not to the allowlist first.
#       b) A vendored C++ lib was silently added to third_party/.
#   - If no base branch snapshot is available (e.g. first commit, branch
#     has no artifacts/reports/ yet), the script validates all entries
#     against the allowlist and exits.
#
# Environment variables:
#   GITHUB_BASE_REF — base branch for PR (e.g. "main"). Set automatically
#                     by GitHub Actions on pull_request events.
#   SNAPSHOT_FILE   — override the snapshot path (default: artifacts/reports/deps_snapshot.json)
#
# Exit 0: no unapproved new deps found.
# Exit 1: one or more new deps are not in the allowlist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ALLOWLIST="${REPO_ROOT}/contracts/deps.allowlist.json"
SNAPSHOT_FILE="${SNAPSHOT_FILE:-${REPO_ROOT}/artifacts/reports/deps_snapshot.json}"
BASE_REF="${GITHUB_BASE_REF:-main}"

echo "=== verify:snapshot_diff ==="

if [ ! -f "$SNAPSHOT_FILE" ]; then
  echo "  FAIL: snapshot not found at $SNAPSHOT_FILE"
  echo "  Run scripts/verify_deps.sh first to generate it."
  exit 1
fi

if [ ! -f "$ALLOWLIST" ]; then
  echo "  FAIL: allowlist not found at $ALLOWLIST"
  exit 1
fi

# ---------------------------------------------------------------------------
# Load allowlist entries (all approved dep names)
# ---------------------------------------------------------------------------
ALLOWED_ALL=$(python3 -c "
import json
with open('${ALLOWLIST}') as f:
    a = json.load(f)
all_names = set()
for section in ['cpp_vendored', 'cpp_system_optional', 'node_runtime', 'node_dev']:
    for dep in a.get(section, []):
        all_names.add(dep['name'])
for n in sorted(all_names):
    print(n)
" 2>/dev/null)

# ---------------------------------------------------------------------------
# Try to get base branch snapshot from git
# ---------------------------------------------------------------------------
BASE_SNAPSHOT_JSON=""
if git rev-parse "origin/${BASE_REF}" >/dev/null 2>&1; then
  BASE_SNAPSHOT_JSON=$(git show "origin/${BASE_REF}:artifacts/reports/deps_snapshot.json" 2>/dev/null || true)
fi

if [ -z "$BASE_SNAPSHOT_JSON" ]; then
  echo "  INFO: No base branch snapshot found (origin/${BASE_REF}:artifacts/reports/deps_snapshot.json)"
  echo "  INFO: Falling back to full allowlist validation only."

  # Validate all current entries against allowlist
  python3 - <<PYEOF
import json, sys

with open('${SNAPSHOT_FILE}') as f:
    current = json.load(f)

allowed = set("""${ALLOWED_ALL}""".strip().splitlines())

violations = []

for lib in current.get('cpp_vendored', []):
    if lib not in allowed:
        violations.append(f'[cpp_vendored] {lib}')

for section in ['dependencies', 'devDependencies']:
    for dep in current.get('node_direct', {}).get(section, {}).keys():
        if dep not in allowed:
            violations.append(f'[node_{section}] {dep}')

if violations:
    print(f'  FAIL: {len(violations)} unapproved dep(s) in snapshot:')
    for v in violations:
        print(f'    {v}')
    print('  Add to contracts/deps.allowlist.json before merging.')
    sys.exit(1)
else:
    print('  OK: all current deps are in the allowlist')
PYEOF
  echo "=== verify:snapshot_diff PASSED (full validation) ==="
  exit 0
fi

# ---------------------------------------------------------------------------
# Diff current snapshot against base branch snapshot
# ---------------------------------------------------------------------------
VIOLATIONS=0
python3 - <<PYEOF
import json, sys

base = json.loads("""${BASE_SNAPSHOT_JSON}""".replace('\\\\', '\\\\').replace('"', '\\"') if False else open('/dev/stdin').read())
PYEOF
# Use a temp file to avoid shell escaping issues with the JSON
echo "$BASE_SNAPSHOT_JSON" > /tmp/_requiem_base_snapshot.json

python3 - <<PYEOF
import json, sys, os

with open('/tmp/_requiem_base_snapshot.json') as f:
    base = json.load(f)

with open('${SNAPSHOT_FILE}') as f:
    current = json.load(f)

allowed_raw = """${ALLOWED_ALL}"""
allowed = set(allowed_raw.strip().splitlines()) if allowed_raw.strip() else set()

base_cpp = set(base.get('cpp_vendored', []))
curr_cpp = set(current.get('cpp_vendored', []))
new_cpp = curr_cpp - base_cpp

base_node = set()
for section in ['dependencies', 'devDependencies']:
    base_node.update(base.get('node_direct', {}).get(section, {}).keys())

curr_node = set()
for section in ['dependencies', 'devDependencies']:
    curr_node.update(current.get('node_direct', {}).get(section, {}).keys())

new_node = curr_node - base_node

removed_cpp  = base_cpp - curr_cpp
removed_node = base_node - curr_node

violations = []

if new_cpp:
    print(f'  NEW [cpp_vendored]:')
    for lib in sorted(new_cpp):
        status = 'APPROVED' if lib in allowed else 'NOT IN ALLOWLIST'
        print(f'    {lib}  [{status}]')
        if lib not in allowed:
            violations.append(f'cpp_vendored: {lib}')

if new_node:
    print(f'  NEW [node]:')
    for dep in sorted(new_node):
        status = 'APPROVED' if dep in allowed else 'NOT IN ALLOWLIST'
        print(f'    {dep}  [{status}]')
        if dep not in allowed:
            violations.append(f'node: {dep}')

if removed_cpp:
    print(f'  REMOVED [cpp_vendored]: {sorted(removed_cpp)}')
if removed_node:
    print(f'  REMOVED [node]: {sorted(removed_node)}')

if not new_cpp and not new_node and not removed_cpp and not removed_node:
    print('  OK: no dependency changes vs base branch')

if violations:
    print()
    print(f'  FAIL: {len(violations)} new dep(s) not in contracts/deps.allowlist.json:')
    for v in violations:
        print(f'    {v}')
    print()
    print('  To add a new dependency:')
    print('    1. Add entry to contracts/deps.allowlist.json with name, version, license, justification')
    print('    2. Then add to package.json / CMakeLists.txt')
    print('    3. PR must include: "Dependency-Added: <name>@<version> license=<spdx>"')
    sys.exit(1)
else:
    if new_cpp or new_node:
        print('  OK: all new deps are pre-approved in allowlist')
PYEOF

STATUS=$?
rm -f /tmp/_requiem_base_snapshot.json

echo ""
if [ "$STATUS" -eq 0 ]; then
  echo "=== verify:snapshot_diff PASSED ==="
else
  echo "=== verify:snapshot_diff FAILED ==="
fi
exit "$STATUS"
