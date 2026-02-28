#!/bin/bash
#
# Requiem Environment Doctor
# Validates all required dependencies for building and running Requiem
#

set -e

ERR_MISSING_DEP=1
ERR_VERSION_MISMATCH=2
ERR_ENGINE_NOT_BUILT=3

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_passed=0
check_failed=0

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
  local cmd=$1
  local name=$2
  
  if command -v "$cmd" &> /dev/null; then
    log_info "$name found: $(which $cmd)"
    ((check_passed++))
    return 0
  else
    log_error "$name not found in PATH"
    ((check_failed++))
    return 1
  fi
}

check_version() {
  local cmd=$1
  local min_version=$2
  local version_flag=${3:---version}
  local name=$4
  
  local current_version
  current_version=$($cmd $version_flag 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
  
  if [ -z "$current_version" ]; then
    log_warn "Could not determine $name version"
    return 1
  fi
  
  # Simple version comparison (assumes X.Y or X.Y.Z format)
  if [ "$(printf '%s\n' "$min_version" "$current_version" | sort -V | head -n1)" = "$min_version" ]; then
    log_info "$name version OK: $current_version (>= $min_version)"
    ((check_passed++))
    return 0
  else
    log_error "$name version too old: $current_version (requires >= $min_version)"
    ((check_failed++))
    return 1
  fi
}

check_header() {
  local header=$1
  local name=$2
  
  # Check for OpenSSL headers in common locations
  if [ -f "/usr/include/$header" ] || [ -f "/usr/local/include/$header" ] || [ -f "/opt/homebrew/include/$header" ]; then
    log_info "$name headers found"
    ((check_passed++))
    return 0
  else
    log_error "$name headers not found (looked for $header)"
    ((check_failed++))
    return 1
  fi
}

check_library() {
  local lib=$1
  local name=$2
  
  if [ -f "/usr/lib/lib$lib.so" ] || [ -f "/usr/local/lib/lib$lib.so" ] || [ -f "/opt/homebrew/lib/lib$lib.dylib" ] || [ -f "/usr/lib/x86_64-linux-gnu/lib$lib.so" ]; then
    log_info "$name library found"
    ((check_passed++))
    return 0
  else
    log_error "$name library not found (looked for lib$lib)"
    ((check_failed++))
    return 1
  fi
}

echo "====================================="
echo "Requiem Environment Doctor"
echo "====================================="
echo ""

# Check Node.js
log_info "Checking Node.js..."
if check_command "node" "Node.js"; then
  check_version "node" "18.0.0" "--version" "Node.js"
fi
echo ""

# Check pnpm
log_info "Checking pnpm..."
if check_command "pnpm" "pnpm"; then
  check_version "pnpm" "8.0.0" "--version" "pnpm"
fi
echo ""

# Check CMake
log_info "Checking CMake..."
if check_command "cmake" "CMake"; then
  check_version "cmake" "3.20.0" "--version" "CMake"
fi
echo ""

# Check C++ compiler
log_info "Checking C++ compiler..."
if check_command "g++" "GCC/G++"; then
  check_version "g++" "11.0.0" "--version" "GCC"
elif check_command "clang++" "Clang"; then
  check_version "clang++" "13.0.0" "--version" "Clang"
else
  log_error "No C++ compiler found (need g++ >= 11 or clang++ >= 13)"
  ((check_failed++))
fi
echo ""

# Check OpenSSL headers
log_info "Checking OpenSSL..."
check_header "openssl/ssl.h" "OpenSSL"
check_header "openssl/evp.h" "OpenSSL EVP"
echo ""

# Check zstd
log_info "Checking zstd..."
check_library "zstd" "zstd"
echo ""

# Check for optional but recommended tools
log_info "Checking optional tools..."
if command -v "git" &> /dev/null; then
  log_info "Git found: $(git --version)"
else
  log_warn "Git not found (recommended for development)"
fi

if command -v "python3" &> /dev/null; then
  log_info "Python 3 found: $(python3 --version)"
else
  log_warn "Python 3 not found (recommended for some scripts)"
fi
echo ""

# Check if engine binary exists
echo "====================================="
log_info "Checking Requiem engine binary..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_PATH="$SCRIPT_DIR/../build/requiem"

if [ -f "$ENGINE_PATH" ]; then
  log_info "Requiem engine binary found: $ENGINE_PATH"
  ((check_passed++))
else
  log_warn "Requiem engine binary not found at $ENGINE_PATH"
  log_info "Run 'npm run build' to build the engine"
fi
echo ""

# Summary
echo "====================================="
echo "Summary: $check_passed passed, $check_failed failed"
echo "====================================="

if [ $check_failed -eq 0 ]; then
  log_info "All required dependencies are satisfied!"
  exit 0
else
  log_error "Some required dependencies are missing or incorrect versions"
  log_info "Please install missing dependencies before proceeding"
  exit $ERR_MISSING_DEP
fi
