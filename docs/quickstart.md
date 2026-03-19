# Quickstart

This is the current copy-pasteable operator path for the repository as shipped.

## 1) Clean-room bootstrap preflight

```bash
node scripts/bootstrap-preflight.mjs
```

This checks Node, corepack, pnpm, lockfile presence, and npm registry reachability before the first install.

## 2) Install dependencies

```bash
pnpm install --frozen-lockfile
```

If install fails because the npm registry is unreachable, fix outbound access (or configure an internal mirror) before continuing.

## 3) Verify deploy/operator contract

```bash
pnpm run verify:deploy-readiness
```

## 4) Prove the local first-customer API path

```bash
pnpm run verify:first-customer
```

That command boots ReadyLayer locally in `local-single-runtime` mode, enforces strict API bearer auth, and runs the canonical API smoke flow.

## 5) Full release gate

```bash
pnpm run verify:release
```

## Optional: shell wrapper

```bash
bash scripts/quickstart.sh
```

Use `--real` to add the full build and release gate:

```bash
bash scripts/quickstart.sh --real
```
