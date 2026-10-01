-- Acceptance follow-ups: allow signed reversal entries for correction cycles,
-- and guard every mutation of an already-sent Client statement line.

SELECT pg_temp.drop_obsolete_unique_pair(
  'public.talent_credit_memos',
  ARRAY['original_invoice_id', 'corrected_revision_id']::text[]
);
SELECT pg_temp.reconcile_index(
  'public.talent_credit_memos',
  'talent_credit_memos_invoice_revision_idx',
  'CREATE INDEX talent_credit_memos_invoice_revision_idx ON talent_credit_memos(original_invoice_id, corrected_revision_id);'
);

SELECT pg_temp.reconcile_trigger(
  'public.client_monthly_invoice_lines',
  'client_monthly_invoice_lines_immutable',
  $trigger_ddl$CREATE TRIGGER client_monthly_invoice_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON client_monthly_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION protect_client_monthly_invoice_lines();$trigger_ddl$,
  ARRAY[27]::smallint[],
  true
);