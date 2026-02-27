#!/usr/bin/env bash
# scripts/verify_prompt_lock.sh
# Phase 2: Prompt lock CI check.
#
# If prompts/system.lock.md was modified in the PR/push, the PR description
# (or the topmost commit message footer) MUST contain:
#   Prompt-Lock-SHA256: <sha256 of prompts/system.lock.md>
#
# If no prompt change is detected, the check passes trivially.
#
# Inputs (environment):
#   GITHUB_EVENT_PATH  — set by GitHub Actions; path to event JSON
#   GITHUB_BASE_REF    — base branch for the PR (set by Actions)
#   PR_BODY            — override PR body text (for local testing)
#
# Exit 0: check passed (no prompt change, or hash matched)
# Exit 1: prompt modified but hash missing or wrong in PR footer

set -euo pipefail

LOCK_FILE="prompts/system.lock.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== verify:prompt_lock ==="

if [ ! -f "${REPO_ROOT}/${LOCK_FILE}" ]; then
  echo "SKIP: ${LOCK_FILE} not found — no prompt lock enforced yet"
  exit 0
fi

# Compute actual SHA-256 of lock file
ACTUAL_SHA=$(sha256sum "${REPO_ROOT}/${LOCK_FILE}" | awk '{print $1}')
echo "  ${LOCK_FILE} sha256: ${ACTUAL_SHA}"

# Detect if lock file was modified in this push/PR
LOCK_MODIFIED=false

# Method 1: GitHub Actions PR context
if [ -n "${GITHUB_BASE_REF:-}" ]; then
  if git diff --name-only "origin/${GITHUB_BASE_REF}...HEAD" 2>/dev/null | grep -q "^${LOCK_FILE}$"; then
    LOCK_MODIFIED=true
    echo "  Detected: ${LOCK_FILE} modified in PR vs origin/${GITHUB_BASE_REF}"
  fi
fi

# Method 2: Last commit touched the file
if [ "$LOCK_MODIFIED" = "false" ]; then
  if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "^${LOCK_FILE}$"; then
    LOCK_MODIFIED=true
    echo "  Detected: ${LOCK_FILE} modified in last commit"
  fi
fi

if [ "$LOCK_MODIFIED" = "false" ]; then
  echo "  No prompt lock change detected — check passes trivially"
  echo "=== verify:prompt_lock PASSED (no change) ==="
  exit 0
fi

echo "  Prompt lock modified — checking PR footer for Prompt-Lock-SHA256..."

# Extract PR body from environment or GitHub event
BODY="${PR_BODY:-}"
if [ -z "$BODY" ] && [ -n "${GITHUB_EVENT_PATH:-}" ] && [ -f "${GITHUB_EVENT_PATH}" ]; then
  BODY=$(python3 -c "
import json, sys
with open('${GITHUB_EVENT_PATH}') as f:
    ev = json.load(f)
body = ev.get('pull_request', {}).get('body', '') or ''
print(body)
" 2>/dev/null || true)
fi

# Fall back to last commit message
if [ -z "$BODY" ]; then
  BODY=$(git log -1 --pretty=%B 2>/dev/null || true)
fi

if [ -z "$BODY" ]; then
  echo "FAIL: Could not read PR body or commit message to check for Prompt-Lock-SHA256"
  echo "  Add to PR description: Prompt-Lock-SHA256: ${ACTUAL_SHA}"
  exit 1
fi

# Extract the hash from footer line "Prompt-Lock-SHA256: <hex>"
FOOTER_SHA=$(echo "$BODY" | grep -i "^Prompt-Lock-SHA256:" | head -1 | awk '{print $2}' | tr -d '[:space:]' || true)

if [ -z "$FOOTER_SHA" ]; then
  echo "FAIL: Prompt-Lock-SHA256 footer missing from PR description / commit message"
  echo "  Add to PR description footer: Prompt-Lock-SHA256: ${ACTUAL_SHA}"
  echo "=== verify:prompt_lock FAILED ==="
  exit 1
fi

if [ "$FOOTER_SHA" != "$ACTUAL_SHA" ]; then
  echo "FAIL: Prompt-Lock-SHA256 mismatch"
  echo "  Footer says:  ${FOOTER_SHA}"
  echo "  Actual sha256: ${ACTUAL_SHA}"
  echo "  Update PR description: Prompt-Lock-SHA256: ${ACTUAL_SHA}"
  echo "=== verify:prompt_lock FAILED ==="
  exit 1
fi

echo "  SHA256 matched: ${ACTUAL_SHA}"
echo "=== verify:prompt_lock PASSED ==="
