# Release Captain Runbook: Requiem Support

## Role Overview

The **Release Captain** is the DRI (Directly Responsible Individual) for a specific production release. Their goal is to ensure the **Three Guarantees** are maintained during and after the release.

## 1. Environment Prep

- Ensure Node.js v20.11+ is active.
- Ensure `pnpm` is on current stable.
- Confirm local `build` is clean: `rm -rf build && pnpm run build`.

## 2. Verification Loop

Run the automated suite:
`pnpm run verify:ci`
`pnpm run verify:ratchet`
`npx tsx scripts/docs-truth-gate.ts`

**Wait for CI**
- Check the `CI / verify (push/pull_request)` dashboard on GitHub.
- Do NOT proceed if any gate is fractional or amber.

## 3. Version Bump & Tag

- `pnpm version [major|minor|patch]`
- `git tag -a v$(node -e "console.log(require('./package.json').version)") -m "release: v..."`
- `git push origin v...`

## 4. Release Notes Draft

- Use the template in `private/release/RELEASE_CHECKLIST.md`.
- Ensure `result_digest` status is clearly stated.
- Link to the `verify:ci` run artifact for that version (if public).

## 5. Artifact Verification

After publishing (Internal/Public):
1. Install the new version in a fresh sandbox.
2. Run `pnpm reach run system.echo '{"test":true}'`.
3. Verify that the `Execution Fingerprint` matches the baseline fingerprint from the previous RC.

## 6. Communication

- Post release notes to the `#announcements` channel.
- Update internal roadmap/milestone status.
- Confirm ReadyLayer UI is live and reachable.
