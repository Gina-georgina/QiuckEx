-- Migration: Add profile visibility and key rotation support
-- Created at: 2026-09-30

-- Add visibility_level column to usernames table
ALTER TABLE usernames
    ADD COLUMN IF NOT EXISTS visibility_level TEXT NOT NULL DEFAULT 'public';

ALTER TABLE usernames
    DROP CONSTRAINT IF EXISTS usernames_visibility_level_check;

ALTER TABLE usernames
    ADD CONSTRAINT usernames_visibility_level_check
    CHECK (visibility_level IN ('public', 'unlisted', 'private'));

-- Create username_key_rotations table
CREATE TABLE IF NOT EXISTS username_key_rotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    old_public_key TEXT NOT NULL,
    new_public_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'announced',
    announced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_at TIMESTAMPTZ,
    grace_ends_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    nonce TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT username_key_rotations_status_check
        CHECK (status IN ('announced', 'effective', 'revoked', 'expired')),
    CONSTRAINT username_key_rotations_username_nonce_key
        UNIQUE (username, nonce),
    CONSTRAINT username_key_rotations_idempotency_key_key
        UNIQUE (idempotency_key)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_username_key_rotations_status
    ON username_key_rotations (status);

CREATE INDEX IF NOT EXISTS idx_username_key_rotations_grace_ends_at
    ON username_key_rotations (grace_ends_at);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION set_username_key_rotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_username_key_rotations_updated_at ON username_key_rotations;

CREATE TRIGGER trg_username_key_rotations_updated_at
    BEFORE UPDATE ON username_key_rotations
    FOR EACH ROW
    EXECUTE FUNCTION set_username_key_rotations_updated_at();