-- REVIEW DRAFT ONLY. Intentionally outside migrations/: the normal runner
-- cannot discover or apply this file. No production execution is authorized.
-- If approved, promote as a separate forward migration, not a historical edit.
-- The runner must own the transaction and ledger insertion.

DO $review$
DECLARE current_definition text; reference_definition text; invalid_count bigint;
BEGIN
  LOCK TABLE public.hiring_contracts IN ACCESS EXCLUSIVE MODE;
  SELECT pg_get_constraintdef(oid, false) INTO current_definition
  FROM pg_constraint
  WHERE conrelid = 'public.hiring_contracts'::regclass
    AND conname = 'hiring_contracts_termination_snapshot_check'
    AND contype = 'c';
  IF current_definition IS NULL THEN
    RAISE EXCEPTION 'review draft: expected existing termination CHECK is missing';
  END IF;

  CREATE TEMP TABLE _termination_check_review_reference
    (LIKE public.hiring_contracts) ON COMMIT DROP;
  ALTER TABLE _termination_check_review_reference
    ADD CONSTRAINT _termination_check_original CHECK (
      (effective_end_date IS NULL AND termination_reason IS NULL
        AND terminated_by IS NULL AND terminated_at IS NULL)
      OR
      (effective_end_date IS NOT NULL AND billing_mode IN ('tracked', 'guaranteed')
        AND termination_reason IS NOT NULL AND btrim(termination_reason) <> ''
        AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL
        AND (effective_start_date IS NULL OR effective_end_date >= effective_start_date))
    );
  SELECT pg_get_constraintdef(oid, false) INTO reference_definition
  FROM pg_constraint
  WHERE conrelid = 'pg_temp._termination_check_review_reference'::regclass
    AND conname = '_termination_check_original';
  IF regexp_replace(current_definition, ' NOT VALID$', '') <> reference_definition THEN
    RAISE EXCEPTION 'review draft: unexpected existing termination CHECK; manual review required';
  END IF;

  SELECT count(*) INTO invalid_count FROM public.hiring_contracts
  WHERE (
    (effective_end_date IS NULL AND termination_reason IS NULL
      AND terminated_by IS NULL AND terminated_at IS NULL)
    OR
    (effective_end_date IS NOT NULL
      AND billing_mode IS NOT NULL AND billing_mode IN ('tracked', 'guaranteed')
      AND termination_reason IS NOT NULL AND btrim(termination_reason) <> ''
      AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL
      AND (effective_start_date IS NULL OR effective_end_date >= effective_start_date))
  ) IS NOT TRUE;
  IF invalid_count <> 0 THEN
    RAISE EXCEPTION
      'review draft: % termination snapshots require explicit repair; no automatic data edits',
      invalid_count;
  END IF;

  ALTER TABLE public.hiring_contracts
    ADD CONSTRAINT hiring_contracts_termination_snapshot_check_reviewed CHECK (
      (effective_end_date IS NULL AND termination_reason IS NULL
        AND terminated_by IS NULL AND terminated_at IS NULL)
      OR
      (effective_end_date IS NOT NULL
        AND billing_mode IS NOT NULL AND billing_mode IN ('tracked', 'guaranteed')
        AND termination_reason IS NOT NULL AND btrim(termination_reason) <> ''
        AND terminated_by IS NOT NULL AND terminated_at IS NOT NULL
        AND (effective_start_date IS NULL OR effective_end_date >= effective_start_date))
    ) NOT VALID;
  ALTER TABLE public.hiring_contracts
    VALIDATE CONSTRAINT hiring_contracts_termination_snapshot_check_reviewed;
  ALTER TABLE public.hiring_contracts
    DROP CONSTRAINT hiring_contracts_termination_snapshot_check;
  ALTER TABLE public.hiring_contracts
    RENAME CONSTRAINT hiring_contracts_termination_snapshot_check_reviewed
    TO hiring_contracts_termination_snapshot_check;
  DROP TABLE pg_temp._termination_check_review_reference;
END
$review$;