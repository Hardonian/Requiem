# Prompt Execution Infrastructure

The prompt system treats prompts as executable infrastructure under `prompts/`.

## Layout

- `prompts/system/` shared system prompts
- `prompts/skills/` prompts wrapping reusable skills
- `prompts/mcp/` prompts used by recipe workflows
- `prompts/review/` review prompts triggered by PR/build events
- `prompts/fix/` auto-fix prompts
- `prompts/marketplace/` distributable prompt packages

## Metadata contract

Every `*.prompt.json` includes:
- `id`, `name`, `description`, `author`, `version`
- `runtime`, `permissions`, `trigger`
- `inputs`, `outputs`
- `safety_level`, `reproducibility_seed`

## CLI

- `rl repo prompt list`
- `rl repo prompt run <id> key=value`
- `rl repo prompt validate`
- `rl repo prompt publish <id>`

## Audit

Execution logs are written to `logs/prompts/` with:
- deterministic `trace_id`
- execution log JSON
- output artifact JSON
- append-only `audit.ndjson`
