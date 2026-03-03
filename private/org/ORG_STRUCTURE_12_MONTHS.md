# Organization Structure & Hiring Plan: Requiem

**Projected 12-Month Vision**

## 1. Core Team (The "Foundry")
The Foundry is responsible for the native engine, security invariants, and core performance.

- **CTO / Chief Architect**: Vision, TLA+ Specs, Invariant enforcement.
- **Principal Engine Engineer**: C++, Sandbox, BLAKE3 performance.
- **Security Lead**: Incident response, Threat modeling, SOC2 audits.

## 2. Product & Experience (The "ReadyLayer" Team)
Responsible for the Dashboard, CLI UX, and developer workflows.

- **VP of Product**: Roadmap, ICP alignment, Enterprise requirements.
- **Lead Fullstack Engineer**: Next.js, API design, Control Plane.
- **Senior UI/UX Designer**: Data visualization for the Semantic Ledger.

## 3. Growth & Success (The "Provability" Team)
Building the community, supporting customers, and proving the value.

- **Head of Growth**: GTM strategy, Sales enablement.
- **DevRel Engineer**: Documentation, Samples, Ecosystem (Reach).
- **Customer Success Engineer**: Enterprise onboarding, PoC delivery.

## 4. Role Definition: Principal Engine Engineer
- **Mission**: Ensure 100% determinism and 0% security bypass in the runtime.
- **Key Skills**: Modern C++ (20+), Linux Namespaces/Cgroups, Hashing (BLAKE3), Formal Methods (TLA+).
- **Invariants**: 100% of code must be CI-verified; 0% tolerance for "flaky" tests.

## 5. Role Definition: Fullstack Engineer (Control Plane)
- **Mission**: Build the "Bloomberg Terminal for AI."
- **Key Skills**: TypeScript, Next.js, PostgreSQL (RLS), Merkle Chain visualization.
- **Invariants**: Design tokens are the source of truth; Accessibility (A11y) is non-negotiable.
