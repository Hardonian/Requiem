# Policy Engine Architecture

Policy evaluation runs before execution and on replay diff checks. All policy failures must return Problem+JSON with trace_id at API boundaries.
