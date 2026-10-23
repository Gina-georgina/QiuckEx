-- Rollback for: 20260925000000_governance_asset_listing_and_privacy.sql

DROP INDEX IF EXISTS idx_privacy_deletion_requests_live_subject;
DROP INDEX IF EXISTS idx_privacy_deletion_requests_created;
DROP TABLE IF EXISTS privacy_deletion_requests CASCADE;

DROP INDEX IF EXISTS idx_privacy_deletion_challenges_expiry;
DROP TABLE IF EXISTS privacy_deletion_challenges CASCADE;

DROP INDEX IF EXISTS idx_asset_listing_decisions_asset;
DROP TABLE IF EXISTS asset_listing_decisions CASCADE;

DROP INDEX IF EXISTS idx_asset_listing_evidence_expiry;
DROP TABLE IF EXISTS asset_listing_evidence CASCADE;

DROP INDEX IF EXISTS idx_verified_assets_listing_status;
ALTER TABLE verified_assets
  DROP COLUMN IF EXISTS suspended_at,
  DROP COLUMN IF EXISTS delisted_at,
  DROP COLUMN IF EXISTS listing_tier,
  DROP COLUMN IF EXISTS listing_status;
