# Skills Framework

Skills are reusable JSON definitions under `skills/` and indexed by `skills/registry.json`.

## Supported skill categories

- `execution.*` for active orchestration capabilities
- `verification.*` for deterministic validation flows
- `policy.*` for safety/policy enforcement

## CLI

- `rl repo skills list`
- `rl repo skills run <skill-id>`

## Composition

Prompt artifacts in `prompts/skills/*.prompt.json` can call skill capabilities to compose larger execution plans.
