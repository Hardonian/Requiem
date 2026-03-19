-- Close durable idempotency crash windows by turning stale pending requests into
-- an explicit operator-visible recovery state instead of leaving them wedged.

ALTER TABLE request_idempotency
    DROP CONSTRAINT IF EXISTS request_idempotency_status_check;

ALTER TABLE request_idempotency
    ADD COLUMN IF NOT EXISTS recovery_reason TEXT;

ALTER TABLE request_idempotency
    ADD CONSTRAINT request_idempotency_status_check
    CHECK (status IN ('pending', 'completed', 'recovery_required'));

COMMENT ON COLUMN request_idempotency.recovery_reason IS 'Operator-visible reason explaining why an idempotency key was blocked for manual recovery.';
