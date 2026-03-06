# Blockers Closed

## Closed blocker 1: Broken enterprise CTA route
- **Problem:** Pricing/Enterprise CTAs pointed to `/enterprise/request-demo` but no page existed.
- **Impact:** Direct 404 from high-intent conversion path.
- **Fix:** Added `ready-layer/src/app/enterprise/request-demo/page.tsx` with actionable flow and links to support/pricing.

## Closed blocker 2: Dead docs links in active UX flows
- **Problem:** `/docs/connecting-nodes` and `/docs/reference/semantic-state-machine` were linked but unimplemented.
- **Impact:** Onboarding and ops pages produced broken-route experience.
- **Fix:** Updated links to live `/docs` route from executions and semantic-ledger views.

## Closed blocker 3: Library route drift
- **Problem:** Library page linked to multiple nonexistent `/docs/*` paths.
- **Impact:** Docs trust erosion and repeated 404s.
- **Fix:** Repointed all library cards to implemented app routes (`/docs`, `/console/*`, `/status`, `/security`, `/support`, `/api/openapi.json`).

## Closed blocker 4: Public claim mismatch (license)
- **Problem:** Landing page claimed “MIT Licensed” while repository license is Apache-2.0.
- **Impact:** Credibility and legal-message inconsistency.
- **Fix:** Updated badge text to “Apache-2.0 Licensed”.

## Closed blocker 5: README CLI naming inconsistency
- **Problem:** CLI section mixed `req` and `rq` commands.
- **Impact:** First-run operator confusion.
- **Fix:** Normalized CLI examples and narrative to `rq`.
