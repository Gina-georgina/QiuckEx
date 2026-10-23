-- Rollback for: 20260926020000_payment_identity_settlement_constraints.sql

DO $$
BEGIN
  IF to_regclass('public.payment_records') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS payment_records_settlement_state_immutable ON public.payment_records;
  DROP FUNCTION IF EXISTS public.enforce_payment_settlement_state();

  ALTER TABLE public.payment_records
    DROP CONSTRAINT IF EXISTS payment_records_settlement_state_check;
  ALTER TABLE public.payment_records
    DROP COLUMN IF EXISTS settlement_state;

  DROP TRIGGER IF EXISTS payment_records_identity_immutable ON public.payment_records;
  DROP FUNCTION IF EXISTS public.prevent_payment_identity_update();
END $$;
