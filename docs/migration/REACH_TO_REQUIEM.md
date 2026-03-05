# Reach → Requiem Migration

## Intent

Unify legacy Reach terminology with current Requiem/ReadyLayer architecture while preserving backward compatibility.

## Migration Rules

1. Replace standalone **Reach** references with **Requiem** unless discussing historical artifacts.
2. Replace ambiguous **console** references with **ReadyLayer console**.
3. Replace ambiguous **daemon** references with **Requiem runtime service**.
4. Prefer **Requiem CLI** over generic "CLI" in operator runbooks.

## Mapping Table

| legacy_term | canonical_term |
|---|---|
| Reach | Requiem |
| Reach CLI | Requiem CLI |
| Reach console | ReadyLayer console |
| Reach control plane | ReadyLayer control plane |
| daemon | Requiem runtime service |

## Backward Compatibility

- Binary alias `reach` remains supported.
- Legacy docs remain valid through redirects and terminology map references.
