# SSM CLI Hardening Report

**Date:** 2026-03-02  
**Scope:** `reach state` command family

---

## Summary

The CLI has been hardened with consistent error handling, exit codes, and output formats.

---

## Exit Codes

| Code | Meaning                                          |
| ---- | ------------------------------------------------ |
| 0    | Success                                          |
| 1    | Error (invalid arguments, state not found, etc.) |

All commands follow this pattern:

```typescript
try {
  // ... command logic
  process.exit(0);
} catch (error) {
  handleError(error, commandName, { json, minimal });
}
```

---

## Output Formats

All commands support:

- `--json` - Machine-readable JSON output
- `--minimal` - Compact human-readable output
- Default - Pretty-printed table/box format

### JSON Output Structure

Success:

```json
{
  "success": true,
  ...command specific fields
}
```

Error:

```json
{
  "success": false,
  "error": "error message",
  "command": "state list"
}
```

---

## Error Handling

All errors go through `handleError()`:

- No stack traces leaked to user
- Consistent error format
- Secrets redaction (inherited from RequiemError)

---

## Command Reference

| Command                  | Exit 0             | Exit 1              | JSON | Minimal |
| ------------------------ | ------------------ | ------------------- | ---- | ------- |
| `state list`             | States listed      | Invalid filter      | ✅   | ✅      |
| `state show`             | State shown        | Not found           | ✅   | ✅      |
| `state diff`             | Diff shown         | State not found     | ✅   | ✅      |
| `state graph`            | DOT output         | -                   | ✅   | ✅      |
| `state export`           | Bundle exported    | -                   | ✅   | ✅      |
| `state import`           | Bundle imported    | Invalid file/bundle | ✅   | ✅      |
| `state genesis`          | State created      | Invalid descriptor  | ✅   | ✅      |
| `state transition`       | Transition created | State not found     | ✅   | ✅      |
| `state simulate upgrade` | Results shown      | -                   | ✅   | ✅      |

---

## Safety Features

1. **No shell interpolation** - All inputs treated as literals
2. **No secret logging** - Error handler uses RequiemError sanitization
3. **Graceful degradation** - Missing config/env handled without crash
4. **Prefix matching** - `show` and `diff` accept ID prefixes (first 8+ chars)

---

## Deterministic Outputs

- `state diff` - Drift classification is deterministic
- `state graph` - Node/edge ordering consistent (alphabetical by ID)
- `state export` - JSON keys sorted, timestamps ISO 8601

---

## Environment Variables

| Variable            | Purpose                               |
| ------------------- | ------------------------------------- |
| `REQUIEM_STATE_DIR` | Override default `.reach/state/` path |

---

## Doctor Integration

The `reach doctor` command should check:

- State directory permissions
- Schema validity of stored states
- Basic integrity posture

These checks are stubbed and should be implemented in `packages/cli/src/commands/doctor.ts`.
