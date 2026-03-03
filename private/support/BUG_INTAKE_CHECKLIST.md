# Bug Intake Checklist: Requiem Support

## Minimum Information Required
- [ ] **Execution Fingerprint**: The 64-character BLAKE3 hash provided by the CLI.
- [ ] **Short ID**: The 8-character identifier for the run.
- [ ] **Version**: Node.js and Requiem (check with `pnpm reach version`).
- [ ] **Platform**: OS (Windows, Linux, macOS) and architecture (x86_64, arm64).
- [ ] **Environment**: Sanitized environment variables? (Check for `env-drift`).

## Core Invariant Check Matrix
| Check | Relevant to |
|-------|-------------|
| **Result Mismatch** | `reach verify <digest>` |
| **Policy Violation** | `reach explain <run_id>` |
| **Tenant Leak** | `reach tenant-check` |
| **Logic Error** | `reach replay <run_id>` |

## Verification Command
Run the following and attach the output:
`pnpm reach doctor --id <run_id> --format=md`
