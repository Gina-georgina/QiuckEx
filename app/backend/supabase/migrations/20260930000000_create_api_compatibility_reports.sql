-- Migration: Create api_compatibility_reports table
-- Mirrors the contract-registry pattern for storing API compatibility reports
-- and per-network overrides.

-- Main table for API compatibility reports
CREATE TABLE IF NOT EXISTS api_compatibility_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network TEXT NOT NULL,
    report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Overrides table for per-network compatibility report overrides
CREATE TABLE IF NOT EXISTS api_compatibility_report_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network TEXT NOT NULL,
    override JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes on network and created_at for the main reports table
CREATE INDEX IF NOT EXISTS idx_api_compatibility_reports_network
    ON api_compatibility_reports (network);

CREATE INDEX IF NOT EXISTS idx_api_compatibility_reports_created_at
    ON api_compatibility_reports (created_at DESC);

-- Indexes on network and created_at for the overrides table
CREATE INDEX IF NOT EXISTS idx_api_compatibility_report_overrides_network
    ON api_compatibility_report_overrides (network);

CREATE INDEX IF NOT EXISTS idx_api_compatibility_report_overrides_created_at
    ON api_compatibility_report_overrides (created_at DESC);

-- Trigger to keep updated_at current on the main reports table
CREATE OR REPLACE FUNCTION set_api_compatibility_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_api_compatibility_reports_updated_at ON api_compatibility_reports;
CREATE TRIGGER trg_api_compatibility_reports_updated_at
    BEFORE UPDATE ON api_compatibility_reports
    FOR EACH ROW
    EXECUTE FUNCTION set_api_compatibility_reports_updated_at();

-- Trigger to keep updated_at current on the overrides table
CREATE OR REPLACE FUNCTION set_api_compatibility_report_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_api_compatibility_report_overrides_updated_at ON api_compatibility_report_overrides;
CREATE TRIGGER trg_api_compatibility_report_overrides_updated_at
    BEFORE UPDATE ON api_compatibility_report_overrides
    FOR EACH ROW
    EXECUTE FUNCTION set_api_compatibility_report_overrides_updated_at();