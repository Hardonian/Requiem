# Security

- Never log environment **values** in policy/report paths.
- Policy output includes only key names and counts.
- Workspace-relative path confinement protects against `..` escapes.
- Structured error codes avoid raw request-body dumping in error paths.
