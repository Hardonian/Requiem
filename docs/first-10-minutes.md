# First 10 Minutes

Goal: get one successful end-to-end run with inspectable artifacts.

## Minute 0-2: install + build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Minute 2-3: environment check

```bash
pnpm doctor
```

If `doctor` reports optional integrations unavailable, continue unless it marks a hard failure.

## Minute 3-6: execute demo

```bash
pnpm verify:demo
```

Inspect artifacts:

```bash
cat demo_artifacts/demo-summary.json
cat demo_artifacts/demo-receipt.json
```

## Minute 6-8: replay + determinism

```bash
pnpm verify:determinism
pnpm verify:replay
```

## Minute 8-10: evidence bundle

```bash
pnpm evidence
```

Review generated benchmark/evidence output before making any external claim.
