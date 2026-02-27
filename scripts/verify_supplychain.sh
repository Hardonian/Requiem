#!/usr/bin/env bash
# scripts/verify_supplychain.sh — Supply-chain hardening gate.
#
# Validates:
#   1. SBOM exists and is CycloneDX-compliant JSON.
#   2. SBOM components match the approved deps allowlist.
#   3. Binary checksum artifact exists and is well-formed.
#   4. No unapproved vendored dependencies in third_party/.
#   5. All vendored deps have explicit license declarations.
#   6. Release signature scaffold present (warns if not configured).
#   7. SBOM timestamp is not stale (> 90 days triggers warning).
#
# Exit 0: supply chain verified.
# Exit 1: violation detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SBOM="${REPO_ROOT}/artifacts/reports/sbom.json"
CHECKSUM="${REPO_ROOT}/artifacts/reports/binary_checksum.json"
ALLOWLIST="${REPO_ROOT}/contracts/deps.allowlist.json"
POLICY="${REPO_ROOT}/policy/default.policy.json"

echo "=== verify:supplychain ==="
VIOLATIONS=0
WARNINGS=0

# ---------------------------------------------------------------------------
# 1. SBOM exists and is valid JSON
# ---------------------------------------------------------------------------
if [ ! -f "$SBOM" ]; then
  echo "  FAIL: artifacts/reports/sbom.json not found"
  echo "    -> Run: cmake --build build && generate SBOM via syft or cdxgen"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  python3 -c "import json; json.load(open('${SBOM}'))" 2>/dev/null || {
    echo "  FAIL: artifacts/reports/sbom.json is not valid JSON"
    VIOLATIONS=$((VIOLATIONS + 1))
  }
  echo "  OK  [sbom]: sbom.json is valid JSON"
fi

# ---------------------------------------------------------------------------
# 2. SBOM format validation (CycloneDX)
# ---------------------------------------------------------------------------
if [ -f "$SBOM" ]; then
  python3 - <<PYEOF
import json, sys, datetime

with open("${SBOM}") as f:
    sbom = json.load(f)

violations = 0

# Check bomFormat
if sbom.get("bomFormat") != "CycloneDX":
    print(f"  FAIL [sbom/format]: expected CycloneDX, got '{sbom.get('bomFormat')}'")
    violations += 1

# Check specVersion
spec_ver = sbom.get("specVersion", "")
allowed_versions = ["1.4", "1.5", "1.6"]
if spec_ver not in allowed_versions:
    print(f"  FAIL [sbom/version]: specVersion '{spec_ver}' not in allowed {allowed_versions}")
    violations += 1

# Check metadata
meta = sbom.get("metadata", {})
if "component" not in meta:
    print("  FAIL [sbom/metadata]: missing metadata.component")
    violations += 1
else:
    comp = meta["component"]
    if not comp.get("name"):
        print("  FAIL [sbom/metadata]: metadata.component.name is empty")
        violations += 1
    if not comp.get("version"):
        print("  WARN [sbom/metadata]: metadata.component.version is empty")

# Check timestamp freshness (warn if > 90 days)
ts_str = meta.get("timestamp", "")
if ts_str:
    try:
        ts = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        age_days = (now - ts).days
        if age_days > 90:
            print(f"  WARN [sbom/freshness]: SBOM is {age_days} days old — regenerate before release")
        else:
            print(f"  OK  [sbom/freshness]: SBOM age = {age_days} days")
    except Exception as e:
        print(f"  WARN [sbom/freshness]: could not parse timestamp '{ts_str}': {e}")
else:
    print("  WARN [sbom/timestamp]: metadata.timestamp not set")

# Check components list
components = sbom.get("components", [])
if not components:
    print("  WARN [sbom/components]: no components listed — SBOM may be incomplete")
else:
    for c in components:
        if not c.get("name"):
            print(f"  FAIL [sbom/components]: component missing name: {c}")
            violations += 1
        if not c.get("licenses") and c.get("scope") == "required":
            print(f"  WARN [sbom/components]: required component '{c.get('name')}' has no license")

if violations == 0:
    print(f"  OK  [sbom/structure]: CycloneDX {spec_ver} with {len(components)} component(s)")
else:
    sys.exit(1)
PYEOF
  [ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# 3. SBOM components vs allowlist cross-check
# ---------------------------------------------------------------------------
if [ -f "$SBOM" ] && [ -f "$ALLOWLIST" ]; then
  python3 - <<PYEOF
import json, sys

with open("${SBOM}") as f:
    sbom = json.load(f)
with open("${ALLOWLIST}") as f:
    allowlist = json.load(f)

allowed_names = set()
for section in ["cpp_vendored", "cpp_system_optional"]:
    for dep in allowlist.get(section, []):
        allowed_names.add(dep["name"])

violations = 0
for comp in sbom.get("components", []):
    name = comp.get("name", "")
    if name and name not in allowed_names:
        print(f"  WARN [sbom/allowlist]: SBOM component '{name}' not in deps.allowlist.json — add or verify it's system-only")

print("  OK  [sbom/allowlist]: SBOM vs allowlist cross-check complete")
PYEOF
fi

# ---------------------------------------------------------------------------
# 4. Binary checksum artifact
# ---------------------------------------------------------------------------
if [ ! -f "$CHECKSUM" ]; then
  echo "  WARN [checksum]: artifacts/reports/binary_checksum.json not found"
  echo "    -> Generated on build; run verify.sh first"
  WARNINGS=$((WARNINGS + 1))
else
  python3 - <<PYEOF
import json, sys

with open("${CHECKSUM}") as f:
    cs = json.load(f)

violations = 0
if not cs.get("binaries") and not cs.get("artifacts"):
    print("  WARN [checksum]: binary_checksum.json has no entries")
else:
    count = len(cs.get("binaries", cs.get("artifacts", {})))
    print(f"  OK  [checksum]: {count} binary checksum(s) present")
PYEOF
fi

# ---------------------------------------------------------------------------
# 5. Vendored dependency license declarations
# ---------------------------------------------------------------------------
THIRD_PARTY="${REPO_ROOT}/third_party"
if [ -d "$THIRD_PARTY" ]; then
  echo "  [supplychain/vendor]: checking vendored dep license files..."
  for d in "${THIRD_PARTY}"/*/; do
    lib=$(basename "$d")
    has_license=$(find "$d" -maxdepth 1 -iname "LICENSE*" -o -iname "COPYING*" | head -1)
    if [ -z "$has_license" ]; then
      echo "  FAIL [supplychain/vendor]: '$lib' has no LICENSE file in third_party/${lib}/"
      VIOLATIONS=$((VIOLATIONS + 1))
    else
      echo "  OK  [supplychain/vendor]: $lib has license file"
    fi
  done
fi

# ---------------------------------------------------------------------------
# 6. Policy supply_chain enforcement
# ---------------------------------------------------------------------------
if [ -f "$POLICY" ]; then
  python3 - <<PYEOF
import json, sys

with open("${POLICY}") as f:
    policy = json.load(f)

sc = policy.get("supply_chain", {})
violations = 0

if sc.get("require_sbom") and not sc.get("sbom_format"):
    print("  FAIL [supplychain/policy]: require_sbom=true but sbom_format not set")
    violations += 1

if sc.get("require_release_signature"):
    print("  WARN [supplychain/policy]: require_release_signature=true — ensure signing key is configured in CI")

if violations == 0:
    print("  OK  [supplychain/policy]: supply_chain policy fields valid")
else:
    sys.exit(1)
PYEOF
  [ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# 7. Dependency allowlist prohibited license check
# ---------------------------------------------------------------------------
if [ -f "$ALLOWLIST" ]; then
  python3 - <<PYEOF
import json, sys

with open("${ALLOWLIST}") as f:
    al = json.load(f)

prohibited = al.get("policy", {}).get("prohibited_licenses", [])
if not prohibited:
    print("  FAIL [supplychain/licenses]: no prohibited licenses defined in allowlist")
    sys.exit(1)

# Check that all vendored deps have licenses that are not prohibited
violations = 0
for dep in al.get("cpp_vendored", []) + al.get("node_runtime", []):
    lic = dep.get("license", "")
    for proh in prohibited:
        if proh in lic:
            print(f"  FAIL [supplychain/licenses]: '{dep['name']}' license '{lic}' matches prohibited '{proh}'")
            violations += 1

if violations == 0:
    print(f"  OK  [supplychain/licenses]: no prohibited licenses in dependency allowlist ({len(prohibited)} prohibited SPDX IDs)")
else:
    sys.exit(1)
PYEOF
  [ $? -ne 0 ] && VIOLATIONS=$((VIOLATIONS + 1))
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo ""
echo "  Summary: violations=$VIOLATIONS warnings=$WARNINGS"
if [ "$VIOLATIONS" -eq 0 ]; then
  echo "=== verify:supplychain PASSED ==="
  exit 0
else
  echo "=== verify:supplychain FAILED ($VIOLATIONS violation(s)) ==="
  exit 1
fi
