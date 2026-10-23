ALTER TABLE usernames
  ADD COLUMN IF NOT EXISTS profile_primary_color TEXT NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS twitter_handle TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discord_handle TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS github_handle TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE usernames
  ADD CONSTRAINT usernames_profile_color_format
    CHECK (profile_primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT usernames_profile_bio_length
    CHECK (char_length(bio) <= 160),
  ADD CONSTRAINT usernames_profile_version_positive
    CHECK (profile_version > 0);

-- Keep updated_at fresh on every row modification.
CREATE OR REPLACE FUNCTION set_usernames_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS usernames_set_updated_at ON usernames;
CREATE TRIGGER usernames_set_updated_at
  BEFORE UPDATE ON usernames
  FOR EACH ROW
  EXECUTE FUNCTION set_usernames_updated_at();

-- Atomic optimistic-concurrency update: increments profile_version only when the
-- caller's expected version matches the stored version. Returns the new version,
-- or NULL when the row was concurrently modified (version mismatch).
CREATE OR REPLACE FUNCTION update_profile_with_version(
  p_username TEXT,
  p_expected_version INTEGER,
  p_profile_primary_color TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_twitter_handle TEXT DEFAULT NULL,
  p_discord_handle TEXT DEFAULT NULL,
  p_github_handle TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_version INTEGER;
BEGIN
  UPDATE usernames
  SET
    profile_primary_color = COALESCE(p_profile_primary_color, profile_primary_color),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    bio = COALESCE(p_bio, bio),
    twitter_handle = COALESCE(p_twitter_handle, twitter_handle),
    discord_handle = COALESCE(p_discord_handle, discord_handle),
    github_handle = COALESCE(p_github_handle, github_handle),
    profile_version = profile_version + 1
  WHERE username = p_username
    AND profile_version = p_expected_version
  RETURNING profile_version INTO v_new_version;

  RETURN v_new_version;
END;
$$ LANGUAGE plpgsql;

-- Idempotency keys for profile mutations. A unique index on the key ensures a
-- retried request with the same key cannot apply the same change twice.
CREATE TABLE IF NOT EXISTS profile_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_idempotency_keys_username_idx
  ON profile_idempotency_keys (username);

CREATE INDEX IF NOT EXISTS profile_idempotency_keys_created_at_idx
  ON profile_idempotency_keys (created_at);

-- Rollback migration:
--
-- DROP INDEX IF EXISTS profile_idempotency_keys_created_at_idx;
-- DROP INDEX IF EXISTS profile_idempotency_keys_username_idx;
-- DROP TABLE IF EXISTS profile_idempotency_keys;
-- DROP FUNCTION IF EXISTS update_profile_with_version(TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
-- DROP TRIGGER IF EXISTS usernames_set_updated_at ON usernames;
-- DROP FUNCTION IF EXISTS set_usernames_updated_at();
-- ALTER TABLE usernames
--   DROP CONSTRAINT IF EXISTS usernames_profile_version_positive,
--   DROP CONSTRAINT IF EXISTS usernames_profile_bio_length,
--   DROP CONSTRAINT IF EXISTS usernames_profile_color_format;
-- ALTER TABLE usernames
--   DROP COLUMN IF EXISTS updated_at,
--   DROP COLUMN IF EXISTS profile_version,
--   DROP COLUMN IF EXISTS github_handle,
--   DROP COLUMN IF EXISTS discord_handle,
--   DROP COLUMN IF EXISTS twitter_handle,
--   DROP COLUMN IF EXISTS bio,
--   DROP COLUMN IF EXISTS avatar_url,
--   DROP COLUMN IF EXISTS profile_primary_color;