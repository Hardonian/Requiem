# Requiem Operations: Private Repository

This directory contains internal-only operational, support, release, procurement, and media assets for the **Requiem** Provable AI Runtime.

## Directory Structure

- **`/private/context/`**: Core assumptions and product naming conventions.
- **`/private/tools/`**: Internal truth-gate policies and CI automation definitions.
- **`/private/support/`**: Triage playbooks, incident templates, and bug intake checklists.
- **`/private/release/`**: Versioning policies, changelog guidelines, and release runbooks.
- **`/private/procurement/`**: Vendor one-pagers, data residency statements, and accessibility templates.
- **`/private/media/`**: Demo scripts, voiceover tracks, and recording runbooks.

## Anti-Drift Automation

We use the following scripts to maintain synchronization between documentation and code:
- `scripts/docs-truth-gate.ts`: Verifies `README.md` command lists against the `reach` CLI.
- `scripts/claims-linter.ts`: Flags aspirational or unverified claims in public-facing docs.

## Public Resources (Mirrored in Root)
- `SUPPORT.md`: Public-facing support instructions.
- `.github/ISSUE_TEMPLATE/`: Standardized bug and feature intake forms.
- `.github/PULL_REQUEST_TEMPLATE.md`: Mandatory verification gate for all contributions.

**Maintaining the Bar**: Every modification must answer: "Does this reduce entropy or increase it?"
