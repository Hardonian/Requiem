# CONFIG IMMUTABILITY

Config immutability contract:

1. Load once at process startup.
2. Freeze the resulting object (`Object.freeze`).
3. Reject runtime mutation attempts.
4. Record config hash in receipts / proof artifacts.
5. Require process restart for config changes.

This pass centralizes deterministic hashing primitives in the truth spine for stable config hashes.
