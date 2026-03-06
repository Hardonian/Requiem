# Setup Review and Fix Models

## Minimum readiness checklist
1. Enable provider at org/workspace/project scope.
2. Add API key/secret reference in active scope.
3. Configure review model route.
4. Configure fixer model route.
5. Bind repository/worktree for patch apply.
6. Grant permissions:
   - `review:trigger`
   - `fixer:trigger`
   - `patch:apply`

Use the readiness API response (`reasons`, `next_actions`) to resolve blockers.
