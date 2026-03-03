# ReadyLayer CLI (`rl`)

Ergonomic operator console for the Requiem ecosystem.

## Installation

```bash
npm install -g @requiem/cli
```

This provides both `requiem`/`reach` and the new `rl` command.

## Quick Start

```bash
# Check system status
rl status

# Run diagnostics
rl doctor

# List available AI models
rl models list

# Add a prompt pack
rl prompt add my-prompt ./prompts/review.txt

# Run a prompt
rl prompt run my-prompt file=src/main.ts

# Execute a full run with artifacts
rl run start my-prompt file=src/main.ts

# Inspect run artifacts
rl run inspect run_abc123

# View execution graph
rl graph run run_abc123
```

## Commands

### Core Commands

#### `rl status`
Show system health and ready state.

```bash
rl status              # Human-readable output
rl status --json       # JSON output for scripting
```

Output includes:
- Database connectivity
- Provider configuration
- Mode settings
- Overall health status

#### `rl doctor`
Validate environment and print fixes.

```bash
rl doctor              # Run all checks
rl doctor --fix        # Show suggested fixes
rl doctor --json       # JSON output
```

Checks include:
- Node.js version compatibility
- Database connectivity
- Provider API keys
- Configuration completeness

#### `rl env`
Show environment configuration.

```bash
rl env                 # Show all environment info
rl env --json          # JSON output
```

### Model & Provider Commands

#### `rl models list`
List all configured providers and their models.

```bash
rl models list                    # List all providers
rl models show anthropic          # Show specific provider
rl models defaults                # Show default provider settings
rl models enable local           # Enable a provider
rl models disable openai         # Disable a provider
```

Each provider includes:
- Available models
- Throttle settings (RPM/TPM)
- Cost per 1K tokens
- API key status

### Mode Commands

Configure operator behavior with mode settings:

```bash
rl mode show                       # Show current mode
rl mode set intensity aggressive   # Set intensity level
rl mode set thinking deep          # Set thinking mode
rl mode set tool-policy ask        # Set tool policy
rl mode set max-iter 20            # Set max iterations
rl mode set timeout 600            # Set timeout in seconds
```

**Intensity levels:**
- `minimal` - Reduced API calls, basic analysis
- `normal` - Balanced operation
- `aggressive` - Maximum analysis depth

**Thinking modes:**
- `fast` - Quick responses, minimal reflection
- `balanced` - Standard reasoning
- `deep` - Extended chain-of-thought

**Tool policies:**
- `deny_all` - No tool execution
- `ask` - Prompt before each tool use
- `allow_registered` - Allow known tools
- `allow_all` - Execute all tool requests

### Prompt Commands

Manage prompt packs with deterministic hash-based IDs:

```bash
rl prompt list                     # List all prompts
rl prompt list --tag review        # Filter by tag
rl prompt get my-prompt            # Get prompt content
rl prompt add my-prompt ./file.txt # Add new prompt
rl prompt run my-prompt var=value  # Execute prompt
rl prompt delete <hash>            # Delete prompt
```

Prompts support variable substitution:

```
# prompt content
Review this code: {{file}}
Focus on: {{focus}}
```

```bash
rl prompt run my-prompt file=src.ts focus=security
```

### Run Commands

Execute and manage runs with full traceability:

```bash
rl run list                        # List recent runs
rl run list --limit 20             # Paginate results
rl run start my-prompt var=value   # Start new run
rl run replay run_abc123           # Replay a run
rl run inspect run_abc123          # Inspect run details
```

Each run receives:
- Unique `run_id`
- Trace ID for grouping related runs
- Artifact directory with outputs
- Manifest with hashes for verification

### Graph Commands

Visualize execution lineage:

```bash
rl graph repo                      # Repository activity graph
rl graph run run_abc123            # Single run graph
rl graph trace trace_xyz789        # Trace execution graph
```

Outputs DOT format for Graphviz:

```bash
rl graph run run_abc123 | dot -Tpng -o run.png
```

## Deterministic Serialization

All exports use deterministic serialization for reproducibility:

- **Stable sorting** - Keys sorted alphabetically
- **Seeded randomness** - Reproducible pseudo-random operations
- **Normalized timestamps** - ISO 8601 UTC format
- **Content hashing** - SHA-256 for verification

## Artifact Export

Runs automatically export artifacts:

```
~/.requiem/artifacts/
  └── run_abc123/
      ├── output.txt         # Rendered output
      ├── metadata.json      # Run metadata
      └── manifest.json      # Verification manifest
```

Manifest includes:
- File hashes (SHA-256)
- Run ID and trace ID
- Timestamp
- File sizes

## Environment Variables

Key environment variables:

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `RL_DEBUG` | Enable debug logging |
| `NODE_ENV` | Set to `development` for verbose output |

## Error Handling

All errors include:
- Error code (e.g., `E_PROMPT_NOT_FOUND`)
- Trace ID for support
- Actionable fix suggestion

```
Error: Prompt not found: my-prompt
Reference: ERR-ABC12345
Run 'rl doctor' for diagnostic information.
```

## Graceful Degradation

The CLI continues to function even when optional dependencies are missing:

- Missing database → In-memory fallback
- Missing API keys → Skip provider
- Missing artifacts → Continue without export

## License

MIT
