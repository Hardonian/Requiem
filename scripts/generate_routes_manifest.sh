#!/usr/bin/env bash
# scripts/generate_routes_manifest.sh
# Scans ready-layer/src/app/api/ for route.ts files and updates routes.manifest.json
# with any missing routes (preserves existing entries and their metadata).
# Run after adding a new route; commit the updated manifest.
#
# Exit 0: manifest up to date or updated.
# Exit 1: error reading files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ROUTES_DIR="${REPO_ROOT}/ready-layer/src/app/api"
MANIFEST="${REPO_ROOT}/routes.manifest.json"

echo "=== generate_routes_manifest ==="

if [ ! -d "$ROUTES_DIR" ]; then
  echo "ERROR: $ROUTES_DIR not found"
  exit 1
fi

# Find all route.ts files and derive their paths
python3 - <<PYEOF
import json, os, re

routes_dir = "${ROUTES_DIR}"
manifest_path = "${MANIFEST}"
repo_root = "${REPO_ROOT}"

# Load existing manifest
with open(manifest_path) as f:
    manifest = json.load(f)

existing_paths = {r["path"] for r in manifest.get("routes", [])}
added = []

for root, dirs, files in os.walk(routes_dir):
    if "route.ts" in files:
        # Derive URL path from filesystem path
        rel = os.path.relpath(root, os.path.dirname(routes_dir.rstrip("/")))
        # ready-layer/src/app/api/engine/status -> /api/engine/status
        url_path = "/" + rel.replace(os.sep, "/").lstrip("/")
        # Strip "src/app" prefix
        url_path = re.sub(r"^.*?/api/", "/api/", url_path)

        file_rel = os.path.relpath(os.path.join(root, "route.ts"), repo_root)

        if url_path not in existing_paths:
            entry = {
                "path": url_path,
                "method": "GET",
                "file": file_rel,
                "auth_required": True,
                "probe": False,
                "description": f"TODO: add description for {url_path}",
                "invariants": ["INV-7"],
                "persona": "operator"
            }
            manifest["routes"].append(entry)
            added.append(url_path)
            print(f"  ADDED: {url_path}")
        else:
            print(f"  OK:    {url_path}")

if added:
    manifest["last_updated"] = "$(date -u +%Y-%m-%d)"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n  Updated manifest with {len(added)} new route(s)")
else:
    print("\n  Manifest is up to date — no changes needed")
PYEOF

echo "=== generate_routes_manifest DONE ==="
