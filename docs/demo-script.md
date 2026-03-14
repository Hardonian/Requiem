# Live Demo Script (Terminal + Screenshare)

## Setup (before audience joins)

1. Start in clean repo checkout.
2. Confirm toolchain:

```bash
node -v
pnpm -v
```

3. Pre-warm dependencies/build (optional for live speed):

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Demo flow (5-8 minutes)

1. **Doctor check**

```bash
pnpm doctor
```

Explain: this validates local capability and degraded/optional paths.

2. **Run demo**

```bash
pnpm verify:demo
```

Explain: generates a deterministic execution result + receipt artifacts.

3. **Show artifacts**

```bash
cat demo_artifacts/demo-summary.json
cat demo_artifacts/demo-receipt.json
```

4. **Replay and determinism checks**

```bash
pnpm verify:replay
pnpm verify:determinism
```

5. **Evidence bundle**

```bash
pnpm evidence
```

## Close statement

Only claim what was shown live. If any command fails, switch to troubleshooting doc instead of bypassing checks.
