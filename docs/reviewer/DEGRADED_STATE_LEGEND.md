# Degraded State Legend

- **A**: authenticated + backend configured + reachable.
- **B**: authenticated + backend configured + unreachable.
- **C**: authenticated + backend missing (`REQUIEM_API_URL` absent).
- **D**: authenticated + no data (empty list/object results).
- **E**: authenticated + engine/runtime unavailable (route returns explicit unavailable/problem semantics).
- **F**: authenticated + forbidden/unauthorized (problem+json 401/403 from route auth checks).
- **G**: unauthenticated access (middleware redirect to `/auth/signin` for page routes).
- **H**: dev verify mode (`REQUIEM_ROUTE_VERIFY_MODE=1` and `NODE_ENV!=production`) with synthetic middleware headers.
- **I**: real auth mode (verify mode disabled; Supabase session required).

Auth validity, backend configuration, backend reachability, and data availability are independent signals and must be interpreted separately.
