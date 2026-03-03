# Contributing to Requiem

> **Mission:** Increase structural coherence. Reduce accidental complexity.

We welcome contributions that improve the reliability, performance, and provability of the Requiem engine. Before you start, please read our [Architecture Guide](./docs/ARCHITECTURE.md).

---

## The Antigravity Principle

Every modification to this repository must answer one question:
**Does this reduce entropy or increase it?**

We prioritize:
1. **Determinism**: No hidden randomness.
2. **Minimal Diffs**: Modify only what is required.
3. **No Silent Failures**: All errors must be explicit and structured.
4. **Performance**: No unnecessary dependencies or bundle bloat.

---

## Development Workflow

### 1. Setup
```bash
pnpm install
pnpm build
```

### 2. Branching
Create a feature branch from `main`. Use descriptive names: `feat/cas-v3` or `fix/merkle-root-leak`.

### 3. Verification
Before opening a PR, your branch **must** pass the full verification suite:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm doctor
```

### 4. PR Guidelines
- **No Placeholders**: Do not leave `TODO` or placeholder comments.
- **Audit Compliance**: If you add a security-critical feature, update [docs/THEATRE_AUDIT.md](./docs/THEATRE_AUDIT.md).
- **Atomic Commits**: Group related changes into single, well-described commits.

---

## Coding Standards

- **TypeScript**: Strict mode enabled. Use functional patterns where possible.
- **C++**: C++17. Follow the existing style (see `.clang-format`).
- **CSS**: Vanilla CSS or Tailwind primitives only. No ad-hoc utility classes.

---

## License

By contributing, you agree that your contributions will be licensed under the project's [Apache-2.0 License](./LICENSE).

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?


- **Check if the bug is already reported** in the [issues](https://github.com/reachhq/requiem/issues).
- **Use the Bug Report template** when creating a new issue.
- **Provide a reproduction** if possible. Use `requiem doctor` to collect environment info.

### Suggesting Enhancements

- **Check if the feature has already been suggested**.
- **Use the Feature Request template**.
- **Describe the use case** and how it fits into Requiem's focus on determinism and performance.

### Pull Requests

1. **Fork the repository**.
2. **Create a branch** for your fix or feature (e.g., `fix/determinism-drift` or `feat/cli-colors`).
3. **Follow the coding style** defined in `.editorconfig`.
4. **Ensure all tests pass** by running `npm run verify`.
5. **Update documentation** if relevant.
6. **Submit a Merge Request** against the `main` branch.

## Development Workflow

### Requirements

- CMake 3.20+
- C++20 compatible compiler (GCC 11+, Clang 14+, MSVC 2022+)
- Node.js 18+ (for UI components)
- pnpm or npm

### Building

```bash
# Build C++ engine
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j

# Build UI packages
npm run build:ui
```

### Verification

Before submitting a PR, ensure all checks pass:

```bash
npm run verify
```

This runs:

- C++ build and unit tests
- UI typechecks and linting
- Determinism and contract validation

## Security

Please report security vulnerabilities to [security@reach.com](mailto:security@reach.com) instead of opening a public issue. See [SECURITY.md](SECURITY.md) for more details.
