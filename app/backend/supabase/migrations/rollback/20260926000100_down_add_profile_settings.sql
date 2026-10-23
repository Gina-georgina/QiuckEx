-- Rollback for: 20260926000100_add_profile_settings.sql

DROP INDEX IF EXISTS profile_idempotency_keys_created_at_idx;
DROP INDEX IF EXISTS profile_idempotency_keys_username_idx;
DROP TABLE IF EXISTS profile_idempotency_keys CASCADE;
DROP FUNCTION IF EXISTS update_profile_with_version(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP TRIGGER IF EXISTS usernames_set_updated_at ON usernames;
DROP FUNCTION IF EXISTS set_usernames_updated_at();

ALTER TABLE usernames
  DROP CONSTRAINT IF EXISTS usernames_profile_version_positive,
  DROP CONSTRAINT IF EXISTS usernames_profile_bio_length,
  DROP CONSTRAINT IF EXISTS usernames_profile_color_format;

ALTER TABLE usernames
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS profile_version,
  DROP COLUMN IF EXISTS github_handle,
  DROP COLUMN IF EXISTS discord_handle,
  DROP COLUMN IF EXISTS twitter_handle,
  DROP COLUMN IF EXISTS bio,
  DROP COLUMN IF EXISTS avatar_url,
  DROP COLUMN IF EXISTS profile_primary_color;
