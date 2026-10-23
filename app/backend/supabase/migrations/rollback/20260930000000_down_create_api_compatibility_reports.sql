-- Rollback migration for 20260930000000_create_api_compatibility_reports.sql
-- Drops the api_compatibility_reports table and its associated objects.

DROP TABLE IF EXISTS public.api_compatibility_reports CASCADE;