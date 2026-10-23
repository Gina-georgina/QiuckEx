-- Rollback for: 20260926000002_add_receipt_payload_and_raw_event_archive.sql

DROP FUNCTION IF EXISTS archive_replayed_soroban_events(TIMESTAMPTZ, INTEGER);
DROP TABLE IF EXISTS unparsed_soroban_events_archive CASCADE;

ALTER TABLE transaction_receipts
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS receipt_data;
