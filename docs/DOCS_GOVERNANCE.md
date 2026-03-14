# Documentation Governance

This file defines how docs are authored, maintained, archived, and removed.

## Documentation classes

1. **Canonical docs**
   - Current source of truth for developers/operators.
   - Linked from `README.md` and `docs/README.md`.

2. **Archived docs**
   - Historically useful but superseded.
   - Stored under `docs/archive/` and indexed in `docs/ARCHIVE_INDEX.md`.

3. **Internal planning docs**
   - Draft strategy, brainstorming, migration scratchpads, or non-public operational planning.
   - Should not be committed as canonical public docs.

## Canonical criteria

A canonical doc must be:

- Current and technically accurate.
- Maintained by active owners/maintainers.
- Linked from canonical navigation points.
- Free of speculative marketing or unsupported claims.

## When to archive

Archive a doc when:

- A newer canonical doc replaces it.
- It is historical evidence of previous decisions.
- It still has reference value but is no longer current truth.

## When to delete

Delete only when:

- It is redundant with no unique historical value.
- It is temporary/generated noise with no durable reference use.
- It contains accidental sensitive content that should not remain in working tree (note: git history still exists unless rewritten).

## Naming conventions

- Canonical docs: descriptive uppercase snake case, e.g. `ARCHITECTURE_OVERVIEW.md`.
- Archived docs: preserve original filename inside grouped archive folders.
- Avoid creating duplicate docs with near-identical scopes.

## Duplicate avoidance rule

Before creating a new doc:

1. Check `docs/README.md` and `docs/ARCHIVE_INDEX.md`.
2. If scope already exists, extend the existing canonical file.
3. Only create new docs when scope is distinct and durable.

## Public vs internal policy

- Public docs: durable project truth and operator/developer guidance.
- Internal/private docs: planning and sensitive operational details in ignored paths.
- Do not publish customer-sensitive, credential, or private-operational data.

## Contributor workflow for docs changes

1. Decide whether change is canonical update vs archive move.
2. Update links in README/docs index.
3. If archiving, add entry to `docs/ARCHIVE_INDEX.md`.
4. Keep claims anchored to repository-provable facts.
