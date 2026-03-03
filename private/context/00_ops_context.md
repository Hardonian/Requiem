# Operations Context: Requiem / Zeo

## Product Naming Conventions

- **Official Name**: Requiem
- **Descriptor**: Provable AI Runtime. Every AI decision. Provable. Replayable. Enforced.
- **Provider/Org**: Zeo
- **Core Primitive**: Semantic State Machine (SSM)
- **UI Component**: ReadyLayer
- **Verification Suite**: Microfracture Suite

## CLI Entrypoint(s)

- `reach`: Main command-line interface. Prefixed with `pnpm reach`.
- `pnpm run verify`: Core verification gate.
- `pnpm run verify:ci`: Extended CI verification gate.

## Documentation Locations

- `README.md`: Primary public entrypoint.
- `docs/`: Comprehensive technical documentation.
- `docs/audits/`: Formal verification and differentiation proofs.
- `private/`: Internal operations, legal, and procurement documents.

## Explicit Assumptions

1. **Platform**: Developed and run on Node.js (v20+), with a Native Engine (C++).
2. **Determinism**: The project asserts that identical inputs produce identical BLAKE3 result digests. All operational documentation must reflect this as a verified invariant, not a hope.
3. **Internal Storage**: All documents in `/private/` are considered internal-only and should not be bundled in public releases or linked from the public README.
4. **Tooling**: Uses `pnpm` as the primary package manager. Scripts are largely TypeScript (`.ts` or `.tsx`) or Shell (`.sh`).
5. **Security**: Security reports are redirected to `SECURITY.md`. Public issue templates are used for bugs and features.
