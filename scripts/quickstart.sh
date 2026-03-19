#!/usr/bin/env bash
set -euo pipefail

REAL_MODE=0
for arg in "$@"; do
  case "$arg" in
    --real) REAL_MODE=1 ;;
    --help|-h)
      cat <<'USAGE'
Usage: bash scripts/quickstart.sh [--real]

Default mode:
  * clean-room bootstrap preflight
  * install/deploy contract verification
  * local first-customer API boot + smoke proof

--real mode adds:
  * full build
  * verify:release gate
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

echo "== Requiem quickstart =="
node scripts/bootstrap-preflight.mjs
pnpm run verify:deploy-readiness

if [[ "$REAL_MODE" -eq 1 ]]; then
  pnpm run build
  pnpm run verify:release
else
  pnpm run verify:first-customer
fi
