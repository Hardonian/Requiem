#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
BUILD_DIR="$ROOT_DIR/build"
CACHE_FILE="$BUILD_DIR/CMakeCache.txt"

normalize_path() {
  local path="$1"
  if [[ "$path" =~ ^([A-Za-z]):/(.*)$ ]]; then
    local drive="${BASH_REMATCH[1],,}"
    local rest="${BASH_REMATCH[2]}"
    path="/mnt/${drive}/${rest}"
  fi
  realpath -m "$path"
}

if [[ -f "$CACHE_FILE" ]]; then
  cache_home="$(grep -E '^CMAKE_HOME_DIRECTORY:INTERNAL=' "$CACHE_FILE" | cut -d= -f2- || true)"
  if [[ -n "$cache_home" ]]; then
    cache_home_norm="$(normalize_path "$cache_home")"
    root_norm="$(normalize_path "$ROOT_DIR")"
    if [[ "$cache_home_norm" != "$root_norm" ]]; then
      echo "[cmake-build] Detected stale CMake cache path ($cache_home); cleaning build cache."
      rm -rf "$BUILD_DIR/CMakeCache.txt" "$BUILD_DIR/CMakeFiles"
    fi
  fi
fi

cmake -S "$ROOT_DIR" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" -j
