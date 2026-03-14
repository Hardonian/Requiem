# Governance

This document defines how project direction, review decisions, and documentation authority are handled.

## Maintainer responsibilities

Maintainers are responsible for:

- Preserving deterministic and boundary guarantees.
- Reviewing technical and documentation changes for correctness.
- Keeping canonical docs current and archiving superseded docs.
- Enforcing contribution standards and code of conduct.

## Decision-making model

- Default model: maintainer consensus after technical review.
- If consensus is blocked, the designated repository owners make the final call.
- Architecture-impacting changes should include explicit rationale in PRs.

## Review process

Expected review checks:

1. Scope and boundary correctness.
2. Verification evidence (commands and outputs).
3. Test and doc updates where behavior changed.
4. No private/sensitive information introduced in public docs.

## Project direction signals

Project direction is reflected by:

- [ROADMAP.md](./ROADMAP.md)
- [CHANGELOG.md](./CHANGELOG.md)
- Accepted PRs with clear rationale

## Documentation canon policy

Canonical project documentation is defined by [docs/DOCS_GOVERNANCE.md](./docs/DOCS_GOVERNANCE.md).

When docs conflict:

- Prefer canonical docs listed in `docs/README.md`.
- Move superseded material to `docs/archive/` and record it in `docs/ARCHIVE_INDEX.md`.

## Archiving and outdated docs

- Archive docs when they are historically useful but no longer current.
- Delete only when content is duplicated and no longer useful.
- Update links when moving docs so users are not sent to dead paths.

## Conduct and security

- Community conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security reporting process: [SECURITY.md](./SECURITY.md)
