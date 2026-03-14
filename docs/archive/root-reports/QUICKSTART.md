# Quickstart Guide

Get up and running with Requiem and ReadyLayer in less than 5 minutes.

## 1. Environment Setup

Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (>= 20.11)
- [pnpm](https://pnpm.io/) (>= 9.0)
- [CMake](https://cmake.org/) (>= 3.20)
- A C++17 compatible compiler

## 2. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
pnpm install
```

## 3. Build the System

Requiem consists of a native C++ kernel and a TypeScript control plane. Build both with a single command:

```bash
pnpm build
```

**Verification:** Confirm the kernel binary was created:
```bash
./build/requiem version
```
*Expected: A JSON object showing version information and ABI versions.*

## 4. Run the 60-Second Demo

Validate the entire chain of truth — from plan creation to receipt generation and log integrity.

```bash
pnpm verify:demo
```

### Expected Output
The demo script will print a sequence of green checks:
```text
[DR] Checking doctor... OK
[PH] Plan hash: req:plan:v1:[hash]
[PR] Plan run receipt: res:receipt:v1:[hash]
[LV] Log verification: OK (Merkle root: audit:root:v1:[hash])
```

## 5. Launch the Web Console

Start the ReadyLayer dashboard to visualize your agent operations.

```bash
pnpm --filter ready-layer dev
```

Visit [http://localhost:3000](http://localhost:3000). You can toggle between light and dark modes in the sidebar.

## 6. CLI Basics

The `pnpm req` command (proxying to `./build/requiem`) gives you direct access to the kernel's powerful features.

| Command | Description |
| :--- | :--- |
| `pnpm doctor` | System health and dependency check |
| `pnpm req plan list` | List all locally cached execution plans |
| `pnpm req cas stats` | View content-addressable storage metrics |
| `pnpm req log verify` | Verify the integrity of the local event log |

---

## Next Steps
- Read [ARCHITECTURE.md](./docs/ARCHITECTURE.md) to understand the security model.
- Explore [API_CONVENTIONS.md](./docs/API_CONVENTIONS.md) for integration tips.
- Join the community in [CONTRIBUTING.md](./CONTRIBUTING.md).
