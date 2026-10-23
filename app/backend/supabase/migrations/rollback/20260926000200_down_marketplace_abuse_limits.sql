-- Rollback for: 20260926000200_marketplace_abuse_limits.sql

DROP TRIGGER IF EXISTS username_bids_pending_limit ON username_bids;
DROP FUNCTION IF EXISTS enforce_marketplace_pending_bid_limit();

DROP TRIGGER IF EXISTS username_marketplace_active_limit ON username_marketplace;
DROP FUNCTION IF EXISTS enforce_marketplace_active_listing_limit();
