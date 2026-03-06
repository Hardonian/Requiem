# Known Tradeoffs (RC1)

1. **Manifest parity is not strict-fail yet**  
   `verify-routes` logs filesystem/API manifest count mismatch but does not block release.

2. **Warning-only hardening hints**  
   Route verifier warns on some API routes that may lack explicit localized error handling patterns.

3. **Rate-limit assertion is conditional**  
   Runtime route probe skips strict 429 assertion when limiter does not trigger in burst mode.

4. **Brand copy is still mixed across some page metadata**  
   Product model is dual-brand by design (Requiem + ReadyLayer), but some page-title consistency work remains.
