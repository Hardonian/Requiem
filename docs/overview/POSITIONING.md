# Requiem / ReadyLayer Positioning

## What it is

Requiem is an open-source deterministic execution engine for AI and automation workloads. It provides a C++ kernel, content-addressed storage (CAS), append-only logging, and replay tooling so teams can verify what happened in a run.

ReadyLayer is the web console and control plane for operating Requiem environments. It focuses on observability, route/API safety checks, and governance workflows.

Reach CLI is the developer interface for local verification, replay, and CI-friendly checks.

## What it is not

- Not a general-purpose LLM model host.
- Not a no-code workflow builder.
- Not a replacement for your primary OLTP database.
- Not a guarantee of deterministic behavior outside the runtime boundaries tested in this repository.

## Who it is for

- Platform engineers responsible for production AI reliability.
- Security/compliance teams that need verifiable execution trails.
- Teams migrating from best-effort agent orchestration to replayable, policy-gated execution.

## Product boundaries

| Layer | Scope |
| --- | --- |
| Requiem OSS engine | Deterministic runtime, CAS, replay primitives, audit/event log |
| ReadyLayer console | Operator UI, diagnostics, route health, governance visibility |
| Reach CLI | Developer tooling for verification, replay, and local operations |

## Claims policy

All external claims must map to executable checks or tests in this repository. If a claim is not currently backed by tests or verify scripts, wording must be explicitly scoped as exploratory.
