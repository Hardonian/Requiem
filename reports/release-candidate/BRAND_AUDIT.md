# Brand Audit (Release Candidate)

## Canonical Naming Model

| Canonical name | Surface | Notes |
| --- | --- | --- |
| **Requiem** | Repository identity, runtime/kernel, core contracts | Root package is `requiem`; runtime docs and contracts use Requiem naming. |
| **ReadyLayer** | Web app/control plane UX | Next.js app copy and docs routes primarily use ReadyLayer naming. |
| **Reach CLI** | Operator/developer command interface | Package and CLI scripts still use `@requiem/cli` with Reach/req aliases. |

## Legacy / Compatibility Aliases

- `req`, `reach`, and `rl` remain valid command aliases for compatibility.
- Mixed repository title in README (`Requiem (Repository) / ReadyLayer (Product)`) is intentional, but should remain paired with the naming table.

## Conflicts Found

1. Some UI metadata still uses `Requiem` while neighboring pages use `ReadyLayer`.
2. CLI docs include both `req` and `rq` examples; only aliases defined in package manifests should be documented as canonical.

## Close-out Actions Applied

- Added route and release artifacts to make product surface auditable in one place.
- Kept dual-brand model explicit rather than silently renaming surfaces.
- Enforced verifier allowlist semantics for non-tenant status route to prevent false-negative policy failures in RC checks.

## Deferred (Non-blocking)

- Full pass to normalize all metadata titles (`Pricing | Requiem` vs `Support | ReadyLayer`) can be handled in a dedicated copy-only PR.
