#!/bin/bash
set -euo pipefail

JSON_OUTPUT=false
if [[ "${1:-}" == "--json" ]]; then
  JSON_OUTPUT=true
fi

REQUIRED_NODE="20.11.0"
REQUIRED_PNPM="8.15.0"
REQUIRED_CMAKE="3.20.0"
REQUIRED_GCC="11.0.0"
REQUIRED_CLANG="14.0.0"

ENGINE_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/build/requiem"

passed=0
failed=0
warnings=0
check_results=()

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

record_result() {
  check_results+=("$1|$2|$3|$4")
}

log() {
  local level="$1"
  local message="$2"
  if [[ "$JSON_OUTPUT" == true ]]; then
    return
  fi

  case "$level" in
    INFO) echo -e "${GREEN}[INFO]${NC} $message" ;;
    WARN) echo -e "${YELLOW}[WARN]${NC} $message" ;;
    ERROR) echo -e "${RED}[ERROR]${NC} $message" ;;
    *) echo "$message" ;;
  esac
}

extract_version() {
  local raw="$1"
  echo "$raw" | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1
}

version_ge() {
  local current="$1"
  local required="$2"
  [[ "$(printf '%s\n' "$required" "$current" | sort -V | head -n1)" == "$required" ]]
}

check_tool_with_version() {
  local cmd="$1"
  local label="$2"
  local required="$3"
  local remediation="$4"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    ((failed+=1))
    record_result false "$label" "Missing from PATH." "$remediation"
    log ERROR "$label missing from PATH. $remediation"
    return
  fi

  local version_raw version
  version_raw="$($cmd --version 2>&1 | head -1 || true)"
  version="$(extract_version "$version_raw")"

  if [[ -z "$version" ]]; then
    ((warnings+=1))
    record_result true "$label" "Found, but version could not be parsed from: $version_raw" ""
    log WARN "$label found but version could not be parsed ($version_raw)."
    return
  fi

  if version_ge "$version" "$required"; then
    ((passed+=1))
    record_result true "$label" "Version $version satisfies >= $required." ""
    log INFO "$label version OK: $version (>= $required)"
  else
    ((failed+=1))
    record_result false "$label" "Version $version is below required $required." "$remediation"
    log ERROR "$label version too old: $version (requires >= $required). $remediation"
  fi
}

check_compiler() {
  local remediation="Install a C++20 compiler and rerun: pnpm run doctor"

  if command -v g++ >/dev/null 2>&1; then
    check_tool_with_version "g++" "GCC/G++" "$REQUIRED_GCC" "$remediation"
    return
  fi

  if command -v clang++ >/dev/null 2>&1; then
    check_tool_with_version "clang++" "Clang" "$REQUIRED_CLANG" "$remediation"
    return
  fi

  ((failed+=1))
  record_result false "C++ compiler" "No supported compiler found (g++ or clang++)." "$remediation"
  log ERROR "No supported C++ compiler found (g++ >= $REQUIRED_GCC or clang++ >= $REQUIRED_CLANG). $remediation"
}

check_engine_binary() {
  if [[ -f "$ENGINE_PATH" ]]; then
    ((passed+=1))
    record_result true "Engine binary" "Found at $ENGINE_PATH." ""
    log INFO "Requiem engine binary found: $ENGINE_PATH"
    return
  fi

  ((warnings+=1))
  record_result true "Engine binary" "Missing at $ENGINE_PATH." "Run: pnpm run build:engine"
  log WARN "Engine binary missing at $ENGINE_PATH."
  log INFO "Run: pnpm run build:engine"
  log INFO "If build fails, confirm CMake and a supported C++ toolchain are installed."
}

if [[ "$JSON_OUTPUT" == false ]]; then
  echo "====================================="
  echo "Requiem Environment Doctor"
  echo "====================================="
  echo ""
fi

log INFO "Checking required toolchain..."
check_tool_with_version "node" "Node.js" "$REQUIRED_NODE" "Install Node.js >= $REQUIRED_NODE and rerun: pnpm install --frozen-lockfile"
check_tool_with_version "pnpm" "pnpm" "$REQUIRED_PNPM" "Install pnpm >= $REQUIRED_PNPM (packageManager: pnpm@8.15.0) and rerun: pnpm install --frozen-lockfile"
check_tool_with_version "cmake" "CMake" "$REQUIRED_CMAKE" "Install CMake >= $REQUIRED_CMAKE and rerun: pnpm run build:engine"
check_compiler
log INFO "Checking local engine build state..."
check_engine_binary

if [[ "$JSON_OUTPUT" == true ]]; then
  printf '{"passed":%d,"failed":%d,"warnings":%d,"results":[' "$passed" "$failed" "$warnings"
  for i in "${!check_results[@]}"; do
    IFS='|' read -r ok name message remediation <<< "${check_results[$i]}"
    if [[ "$i" -gt 0 ]]; then
      printf ','
    fi
    printf '{"ok":%s,"check":"%s","message":"%s","remediation":"%s"}' \
      "$ok" \
      "$(echo "$name" | sed 's/"/\\"/g')" \
      "$(echo "$message" | sed 's/"/\\"/g')" \
      "$(echo "$remediation" | sed 's/"/\\"/g')"
  done
  printf ']}'
  exit $failed
fi

echo ""
echo "====================================="
echo "Summary: $passed passed, $failed failed, $warnings warnings"
echo "====================================="

if [[ $failed -eq 0 ]]; then
  log INFO "Doctor found no blocking prerequisites."
  exit 0
fi

log ERROR "Doctor found blocking prerequisites."
log INFO "Resolve the errors above, then rerun: pnpm run doctor"
exit 1
