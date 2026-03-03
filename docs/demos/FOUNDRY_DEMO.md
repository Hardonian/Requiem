# Foundry Demo

```bash
node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry bootstrap
node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry report --last 1
node scripts/run-tsx.mjs packages/cli/src/cli.ts foundry export --dataset core_vectors --format json
```

Expected outcome:
- datasets created in `.requiem/foundry/`
- runs persisted with trace IDs
- report artifacts written to `artifacts/foundry/`
