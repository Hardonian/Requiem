# Evaluation

This document outlines the evaluation harness for AI agents and skills in Requiem, ensuring that changes to models or prompts do not cause regressions in behavior.

## Overview

The evaluation suite is designed to verify stability across:

*   **Determinism**: Ensuring same-input consistency.
*   **Safety**: Testing policy-gate enforcement.
*   **Quality**: Measuring decision accuracy via goldens.

## Test categories

### 1. Determinism Tests
Verify that identical inputs produce identical outputs with < 0.01 variance.

### 2. Quality Tests
Evaluate agent response quality using `llm_judge` or `exact_match`.

### 3. Safety Tests
Verify safety boundaries using adversarial datasets.

---
**Status**: ARCHITECTURE CLARIFIED.
