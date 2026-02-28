# Cost Accounting

The Requiem cost accounting system provides a detailed, auditable record of every AI operation, enabling precise cost tracking, budgeting, and performance analysis.

## Data Model

All cost and usage data is stored in the `ai_cost_records` table.

**Schema (`ai_cost_records`):**

| Column | Type | Description |
| --- | --- | --- |
| `id` | TEXT | Unique identifier for the cost record. |
| `traceId` | TEXT | The trace ID for the entire operation, linking multiple AI calls. |
| `tenantId` | TEXT | The ID of the tenant that initiated the operation. |
| `actorId` | TEXT | The ID of the user or service principal that initiated the operation. |
| `provider` | TEXT | The AI provider (e.g., `openai`, `anthropic`). |
| `model` | TEXT | The specific model used (e.g., `gpt-4-turbo`, `claude-3-opus`). |
| `inputTokens` | INTEGER | The number of tokens in the input prompt. |
| `outputTokens` | INTEGER | The number of tokens in the generated output. |
| `costCents` | REAL | The calculated cost of the operation in USD cents. |
| `latencyMs` | INTEGER | The duration of the AI call in milliseconds. |
| `createdAt` | TEXT | The ISO 8601 timestamp of when the record was created. |

## Cost Calculation

Cost is calculated based on the provider's pricing for the specific model used. The formula is typically:

```
cost = (inputTokens / 1,000,000 * inputPrice) + (outputTokens / 1,000,000 * outputPrice)
```

The result is stored in cents to avoid floating-point inaccuracies.

## Data Recording

The `recordCost` function in `packages/ai/src/telemetry/cost.ts` is the single entry point for recording cost data. It is automatically called by the LLM instrumentation layer, ensuring that every AI call is tracked.
