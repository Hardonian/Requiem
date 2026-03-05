# YOLO Mode

YOLO mode enables autonomous remediation planning for developers.

## CLI

- `rl repo agent yolo lint`
- `rl repo agent yolo test`
- `rl repo agent yolo fix`

## Guardrails

- stay inside repository boundaries
- do not modify protected files
- do not modify secrets
- do not push to protected branches
- only commit after lint + test pass

Auto-fix commit convention:

`[agent-fix] lint corrections via prompt`
