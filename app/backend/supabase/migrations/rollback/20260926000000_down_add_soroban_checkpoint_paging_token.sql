-- Rollback for: 20260926000000_add_soroban_checkpoint_paging_token.sql

ALTER TABLE indexer_checkpoints
  DROP COLUMN IF EXISTS paging_token;
