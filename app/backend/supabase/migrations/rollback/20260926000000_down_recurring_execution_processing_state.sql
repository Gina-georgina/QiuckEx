-- Rollback for: 20260926000000_recurring_execution_processing_state.sql

DROP FUNCTION IF EXISTS record_recurring_payment_success(UUID, TEXT);
DROP INDEX IF EXISTS recurring_executions_processing_idx;

ALTER TABLE recurring_payment_executions
  DROP CONSTRAINT IF EXISTS recurring_payment_executions_status_check;

ALTER TABLE recurring_payment_links
  DROP COLUMN IF EXISTS payer_public_key;

DROP INDEX IF EXISTS jobs_type_idempotency_key_idx;
ALTER TABLE jobs
  DROP COLUMN IF EXISTS idempotency_key;
