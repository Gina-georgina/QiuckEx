-- Rollback for: 20260926000000_soroban_event_dead_letter.sql

DROP FUNCTION IF EXISTS record_unparsed_soroban_replay_failure(TEXT, TEXT, INTEGER);

ALTER TABLE unparsed_soroban_events
  DROP CONSTRAINT IF EXISTS unparsed_soroban_events_status_check;
