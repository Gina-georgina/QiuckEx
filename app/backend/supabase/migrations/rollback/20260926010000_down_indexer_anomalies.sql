-- Rollback for: 20260926010000_indexer_anomalies.sql

DROP INDEX IF EXISTS indexer_anomalies_type_idx;
DROP INDEX IF EXISTS indexer_anomalies_contract_detected_idx;
DROP TABLE IF EXISTS public.indexer_anomalies CASCADE;
