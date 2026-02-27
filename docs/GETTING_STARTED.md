# Getting Started with Requiem

Requiem is a native C++ runtime for deterministic process execution. This guide will walk you through building the engine and running your first deterministic command.

## Prerequisites

Ensure you have the following installed:
- **CMake** (3.20+)
- **C++20 Compiler** (GCC 11+, Clang 14+, or MSVC 2022+)
- **Node.js** (18+ for UI components)

## 1. Build the Engine

Clone the repository and build the C++ core:

```bash
git clone https://github.com/reachhq/requiem.git
cd requiem
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
```

## 2. Verify Installation

Run the health check to ensure the engine and its vendored BLAKE3 implementation are working correctly:

```bash
./build/requiem health
```

You should see a JSON output indicating `hash_primitive: "blake3"` and `hash_backend: "vendored"`.

## 3. Run Your First Command

Create a simple request file `request.json`:

```json
{
  "command": "/bin/echo",
  "argv": ["Hello, Requiem!"],
  "policy": {
    "deterministic": true,
    "deny_network": true
  }
}
```

Execute the command through Requiem:

```bash
./build/requiem exec run --request request.json --out result.json
```

## 4. Inspect the Result

Check `result.json`. It contains the command output, execution metadata, and a cryptographic digest of the result:

```bash
cat result.json
```

## Next Steps

- Explore the [Architecture Guide](ARCHITECTURE.md) to understand how Requiem ensures determinism.
- Check out the [Security considerations](SECURITY.md) for sandbox details.
- Learn about [Content-Addressable Storage (CAS)](CAS.md).
