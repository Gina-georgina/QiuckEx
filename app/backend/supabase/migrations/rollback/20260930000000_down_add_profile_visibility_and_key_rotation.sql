-- Rollback for 20260930000000_add_profile_visibility_and_key_rotation.sql
-- Drops the username_key_rotations table and the visibility_level column.

DROP TABLE IF EXISTS public.username_key_rotations;

ALTER TABLE public.profiles
    DROP COLUMN IF EXISTS visibility_level;