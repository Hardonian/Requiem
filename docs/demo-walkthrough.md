# Demo Walkthrough

This walkthrough is for technical screen-share demos and self-guided evaluations.

## 1) Start system

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm doctor
```

## 2) Run demo workflow

```bash
pnpm verify:demo
```

## 3) Inspect execution artifacts

```bash
cat demo_artifacts/demo-summary.json
cat demo_artifacts/demo-receipt.json
```

## 4) Inspect proof/evidence artifacts

```bash
pnpm evidence
```

## 5) Replay execution

```bash
pnpm verify:replay
```

## 6) Verify deterministic/proof boundaries

```bash
pnpm verify:determinism
pnpm verify:policy
```

## 7) Why this matters

A successful run shows that execution, replay, and artifact verification are connected by scripts and contracts in this repository, not by screenshots or narrative-only claims.
