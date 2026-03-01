# Diagnostic Analysis Prompt

## Context
You are analyzing runtime signals to diagnose the root cause of a failure or drift event.

## Input Signals
{{signals}}

## Signal Categories Detected
{{signal_categories}}

## Historical Patterns
{{historical_patterns}}

## Task
1. Analyze the signal categories and their frequencies
2. Identify the root cause from the following taxonomy:
   - prompt_gap: Required inputs missing from prompts
   - skill_gap: No skill registered for signal category
   - schema_gap: Schema validation failure
   - config_gap: Configuration mismatch
   - policy_gap: Policy enforcement gap
   - strategic_misalignment: Runtime behavior diverges from intent
   - economic_misalignment: Resource allocation inconsistent with policy

3. Calculate confidence score based on signal count thresholds:
   - 1 signal: confidence = 30
   - 2-3 signals: confidence = 60
   - 4+ signals: confidence = 90

4. If root cause is identified, propose a patch type:
   - skill_update: Create/update skill file
   - prompt_update: Modify prompt template
   - schema_update: JSON schema modification
   - config_update: Environment/verify config
   - branch_plan: New feature branch
   - rollback_plan: Revert to commit
   - cost_model_update: Cost thresholds
   - fairness_policy_update: Fairness thresholds

## Output Format
```json
{
  "root_cause": "<identified_root_cause>",
  "confidence_score": <0-100>,
  "proposed_patch_type": "<patch_type>",
  "rationale": "<explanation>"
}
```

## Constraints
- Output must be valid JSON
- Confidence scores must be deterministic (based only on signal counts)
- Never propose auto-application of patches
