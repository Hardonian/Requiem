# Getting Started

## 1) Install

```bash
pnpm install --frozen-lockfile
```

## 2) Build

```bash
pnpm run build
```

## 3) Secretless verification (OSS path)

```bash
pnpm run verify:routes
pnpm --filter ready-layer test -- --run ready-layer/tests/auth-mode.test.ts ready-layer/tests/mcp-route-degraded.test.ts
```

## 4) Full verification

```bash
pnpm run doctor
pnpm run verify:ci
```
