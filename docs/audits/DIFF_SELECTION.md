# Differentiator Selection Report

## Selected Differentiators (4 of 6)

Based on analysis of the existing SSM implementation and the goal of adding "uncopyable" differentiators with low surface area, we have selected:

| ID | Differentiator | Why Selected | Implementation Complexity |
|----|----------------|--------------|--------------------------|
| A | Tool IO Schema Lock | Extends existing tool registry with strict schema enforcement | Low - builds on existing schema.ts |
| C | Change Budget Governance | Natural extension of drift taxonomy + integrity scores | Low - uses existing DriftCategory |
| D | Audit Narrative Generator | Leverages existing drift + integrity signals | Low - deterministic template generation |
| B | Replay Attestation Bundle | Portable verifiable run capsules | Medium - new export format |

Not Selected:
- **E) Cross-Environment Equivalence**: Requires multi-env infrastructure, higher surface area
- **F) Semantic Rollback Plan**: Requires policy snapshot management not yet implemented

---

## Differentiator A: Deterministic "Semantic Contract" for Tools

### Why It's AI-Native
Traditional CI/CD treats tools as black-box executables. This differentiator treats tool IO as a semantic contract—inputs/outputs are strictly schema-bound and versioned alongside the SSM state.

### Why Hard to Copy
- Requires binding JSON Schema snapshots to semantic state IDs
- Schema drift becomes a first-class citizen in the drift taxonomy
- GitHub Actions has no native concept of "tool schema versioning"

### Minimal Implementation Plan
1. Extend `ToolDefinition` with `inputSchema` and `outputSchema` (JSON Schema)
2. Add schema snapshot hashing (BLAKE3 of canonical schema)
3. Add `reach tool-schema lock` command to bind schemas to current state
4. Add schema drift detection to `classifyDrift()`
5. Store schema refs in `SemanticStateDescriptor`

### Expected Proof Steps
```bash
reach tool-schema lock system.echo --state <state-id>
reach tool-schema verify system.echo --input <test-input.json>
reach state diff <state-a> <state-b>  # shows schema_drift if tool changed
```

---

## Differentiator C: "Change Budget" Governance

### Why It's AI-Native
CI/CD gates on tests passing. This gates on semantic drift budgets—allowing only certain categories of change without re-approval.

### Why Hard to Copy
- Requires understanding of drift taxonomy (ModelDrift, PromptDrift, etc.)
- Integrates with SSM integrity scores
- Needs policy-aware budget enforcement

### Minimal Implementation Plan
1. Define `ChangeBudget` interface with category thresholds
2. Add budget rules to policy snapshots
3. Add `reach budget check <from> <to>` command
4. Return PASS/FAIL with breakdown of which categories exceeded budget
5. Integrate into transition creation (warn/block on budget breach)

### Expected Proof Steps
```bash
reach budget define --model-drift=critical --policy-drift=major
reach budget check <state-a> <state-b>  # returns exit 1 if budget exceeded
```

---

## Differentiator D: Deterministic "Audit Narrative" Generator

### Why It's AI-Native
Generates compliance-ready audit trails from structured signals—not from logs, but from semantic understanding of what changed and why.

### Why Hard to Copy
- Requires drift taxonomy + integrity signals
- Deterministic template rendering (no LLM hallucination)
- Policy-grade output suitable for compliance tickets

### Minimal Implementation Plan
1. Create `generateAuditNarrative()` function
2. Template inputs: drift classification, integrity breakdown, transition lineage
3. Output: structured markdown with deterministic sections
4. Add `reach audit report <state|transition>` command
5. Add `--format json|markdown` option

### Expected Proof Steps
```bash
reach audit report <state-id>
reach audit report <state-id> --format json
# Output includes: drift summary, integrity assessment, lineage verification
```

---

## Differentiator B: Replay Attestation Bundle (Capsule)

### Why It's AI-Native
Exports a cryptographically-bound "capsule" of a semantic run that can be verified offline—proving integrity without network access.

### Why Hard to Copy
- Requires content-derived IDs (BLAKE3)
- Must include policy snapshot refs, context refs, drift lineage
- Offline verification without network

### Minimal Implementation Plan
1. Define `ReplayAttestationCapsule` interface
2. Include: semantic descriptor, policy ref, context ref, drift breakdown, transition slice
3. Add `reach capsule export <state-id>` command
4. Add `reach capsule verify <capsule-file>` command
5. Use checksums for integrity (extend with signing later)

### Expected Proof Steps
```bash
reach capsule export <state-id> --output /tmp/capsule.json
reach capsule verify /tmp/capsule.json  # returns exit 0 if valid
```

---

## Implementation Order

1. **Audit Narrative (D)** - Least complex, builds on existing signals
2. **Change Budget (C)** - Extends drift taxonomy
3. **Tool Schema Lock (A)** - Extends tool registry
4. **Capsule (B)** - Most complex, combines all above

---

## OSS vs Enterprise Boundaries

| Differentiator | OSS | Enterprise |
|----------------|-----|------------|
| Tool Schema Lock | ✓ Full | N/A |
| Change Budget | ✓ Check only | Policy enforcement UI |
| Audit Narrative | ✓ Basic | ✓ Advanced (signing) |
| Capsule | ✓ Verify only | ✓ Full + Cloud storage |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Schema drift breaks existing states | Add schema versioning, grandfather existing |
| Budget rules too complex | Start with 4 drift categories only |
| Audit output format changes | Version the narrative format |
| Capsule verification fails cross-platform | Use canonical JSON + stable hash |
