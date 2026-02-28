# Evaluation Harness

> Agent quality evaluation framework - to be populated during Phase 8.

## Overview

The evaluation harness provides automated testing of agent quality, determinism, and safety. It enables:
- Regression testing of agent behaviors
- Determinism verification
- Safety boundary testing
- Performance benchmarking

## Test Categories

### Determinism Tests

Verify that identical inputs produce identical outputs:

```typescript
interface DeterminismTest {
  name: string;
  input: TestInput;
  expectedOutput: TestOutput;
  maxVariance: number;
}
```

### Quality Tests

Evaluate agent response quality:

```typescript
interface QualityTest {
  name: string;
  prompt: string;
  expectedCriteria: QualityCriteria;
  scoringMethod: 'llm_judge' | 'exact_match' | 'regex';
}
```

### Safety Tests

Verify safety boundaries:

```typescript
interface SafetyTest {
  name: string;
  adversarialInput: string;
  expectedBehavior: 'block' | 'sanitize' | 'allow';
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

## Test Datasets

*(To be populated during Phase 8)*

### Decision Quality Dataset

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| basic_decision | junction data | correct decision |
| edge_case | boundary conditions | appropriate handling |
| ambiguous | unclear input | safe default |

### Safety Dataset

| Test Case | Adversarial Input | Expected Behavior |
|-----------|-------------------|-------------------|
| injection | SQL/command injection | block |
| prompt_leak | system prompt extraction | sanitize |
| resource_exhaust | excessive requests | rate limit |

## Evaluation Metrics

### Quality Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| accuracy | Correct decisions / total | >95% |
| latency | Response time p95 | <500ms |
| determinism | Output variance | <0.01 |

### Safety Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| block_rate | Adversarial inputs blocked | 100% |
| false_positive | Legitimate requests blocked | <1% |
| pii_leaks | PII in outputs | 0 |

## Running Evaluation

### CLI Command

```bash
# Run all evaluations
pnpm run verify:agent-quality

# Run specific category
pnpm run verify:agent-quality -- --category determinism

# Run with coverage
pnpm run verify:agent-quality -- --coverage
```

### CI Integration

```yaml
# .github/workflows/eval.yml
name: Agent Quality
on: [push, pull_request]
jobs:
  evaluate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm run verify:agent-quality
```

## Reporting

### Metrics Dashboard

Results are stored in:
- `artifacts/eval/metrics.json` - Raw metrics
- `artifacts/eval/report.html` - HTML report

### Baseline Comparison

Each run compares against baseline:
- If regression >5%: FAIL
- If regression >1%: WARNING
- If regression <1%: PASS

---

**Status**: Initial scaffold - to be populated during implementation phases.
