# Release Checklist: Requiem / Zeo

## 🚀 Pre-Release Verification
- [ ] **Determinism Check**: `pnpm run verify:ci` passed with 0 drift on 200x repeat cycle.
- [ ] **Engine Baseline**: `pnpm run verify:cpp` passed.
- [ ] **ReadyLayer UI**: `pnpm run build:web` passed.
- [ ] **Isolation boundaries**: `pnpm run verify:tenant-isolation` passed.
- [ ] **Security check**: `pnpm run audit` passed.
- [ ] **CI Pass**: All GitHub Actions green.

## 📄 Documentation Sync
- [ ] **Truth Gate**: `npx tsx scripts/docs-truth-gate.ts` passed.
- [ ] **Claims Linter**: `npx tsx scripts/claims-linter.ts` passed.
- [ ] **README Update**: Version bumped in `README.md` examples.
- [ ] **CHANGELOG**: Updated with `VERSIONING_POLICY.md` compliant notes.

## 📦 Packaging
- [ ] **Version Bump**: `pnpm version [major|minor|patch]` in packages/cli, packages/ai, and ready-layer.
- [ ] **SBOM Generation**: `pnpm run verify:sbom` updated.
- [ ] **NPM Publish**: `pnpm -r publish --access public` (Dry run first).

## 📢 Post-Release
- [ ] **Git Tag**: Create and push tag `vX.Y.Z`.
- [ ] **GitHub Release**: Create release from tag with generated notes.
- [ ] **Announcement**: Internal/External announcement in [Communication Channel].
