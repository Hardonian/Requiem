#!/usr/bin/env bash
# verify_secrets.sh - Scan for potential secrets in logs and test outputs
set -euo pipefail

echo "Scanning for potential secrets..."

# Patterns that might indicate secrets
patterns=(
  "password\s*[=:]\s*[^\s\"']+"
  "secret\s*[=:]\s*[^\s\"']+"
  "token\s*[=:]\s*[^\s\"']+"
  "api[_-]?key\s*[=:]\s*[^\s\"']+"
  "private[_-]?key\s*[=:]\s*[^\s\"']+"
  "Authorization:\s*Bearer\s+[^\s\"']+"
  "AWS_ACCESS_KEY_ID"
  "AWS_SECRET_ACCESS_KEY"
)

found=0
for pattern in "${patterns[@]}"; do
  if grep -riE "$pattern" --include="*.log" --include="*.txt" --include="*.json" . 2>/dev/null | grep -v "verify_secrets" | head -5; then
    found=1
    echo "WARNING: Potential secret pattern found: $pattern"
  fi
done

# Check test outputs specifically for environment variable values
# (env keys are OK, values should be redacted)
if [ -d "build" ]; then
  if grep -r "PATH=/usr" build/*.json 2>/dev/null || grep -r "HOME=/" build/*.json 2>/dev/null; then
    echo "WARNING: Environment values may be leaking in build outputs"
    found=1
  fi
fi

if [ $found -eq 1 ]; then
  echo "SECRET CHECK: FAILED - Review output above"
  exit 1
else
  echo "SECRET CHECK: PASSED - No obvious secrets found"
fi
