# Terminology Map

| Legacy term | Canonical term | Notes |
|---|---|---|
| Reach | Requiem CLI / Requiem platform | Historical naming in older docs and scripts. |
| Requiem | Requiem deterministic kernel | Kernel-specific meaning unless otherwise qualified. |
| ReadyLayer | ReadyLayer control plane | UI/control-plane brand remains valid. |
| kernel | Requiem deterministic kernel | Preferred expanded phrasing in architecture docs. |
| daemon | Requiem runtime service | Use when describing background execution process. |
| control plane | ReadyLayer control plane + CLI ops surface | Control plane can include both web and CLI interfaces. |
| console | ReadyLayer console | Preferred for web interface naming. |

## Canonical Model

`Requiem kernel` + `CAS/WAL primitives` + `Requiem CLI operational interface` + `ReadyLayer control plane`.
