# Adapter Development

Adapter templates are provided in:

- `adapters/http`
- `adapters/filesystem`
- `adapters/script`
- `adapters/llm_mock`

Each template captures required guarantees:

- deterministic invocation
- input capture
- output capture
- response hashing
- proofpack inclusion

## Plugin Integration

Plugins can provide adapter modules through `plugins/<name>/plugin.json`.

Supported lifecycle commands:

- `requiem plugin:list`
- `requiem plugin:install <path>`
- `requiem plugin:enable <name>`

When enabled, plugin adapters are available to workflow `adapter` nodes.
