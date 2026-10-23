-- Rollback for: 20260926000000_create_reconciliation_runs.sql

DROP INDEX IF EXISTS reconciliation_runs_completed_at_idx;
DROP TABLE IF EXISTS reconciliation_runs CASCADE;
