-- Rollback for: 20260926000001_secure_marketplace_bids.sql

DROP INDEX IF EXISTS username_bids_signature_unique_idx;
ALTER TABLE username_bids
  DROP COLUMN IF EXISTS signed_at,
  DROP COLUMN IF EXISTS signature;
