# Contributing to Requiem

First off, thank you for considering contributing to Requiem! It's people like you that make Requiem such a powerful tool for the community.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs

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
