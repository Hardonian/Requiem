# Getting Started

This guide is the fastest realistic path to a working local development setup.

## 1) Requirements

- Node.js 20.11+
- pnpm 8+
- CMake + C++20-compatible compiler for core build/test flows

## 2) Clone and install

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install --frozen-lockfile
```

## 3) Build

```bash
pnpm build
```

## 4) Run baseline checks

```bash
pnpm doctor
pnpm verify:demo
```

## 5) Use Reach CLI locally

```bash
pnpm rl --help
pnpm rl doctor
```

## 6) Verify core project health

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm verify:determinism
```

## 7) Contribute

- Review [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Follow [DOCS_GOVERNANCE.md](./DOCS_GOVERNANCE.md) for doc additions/updates
- Open PR with command evidence and scope summary

## What works locally vs hosted enterprise context

Local OSS workflows in this repo support development, deterministic checks, and CLI-driven execution/testing.

ReadyLayer Cloud hosted control-plane operation is enterprise/commercial context and not required for OSS local development.
