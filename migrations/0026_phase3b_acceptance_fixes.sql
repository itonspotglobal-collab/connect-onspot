-- Acceptance follow-ups: allow signed reversal entries for correction cycles,
-- and guard every mutation of an already-sent Client statement line.

ALTER TABLE talent_credit_memos
  DROP CONSTRAINT IF EXISTS talent_credit_memos_original_invoice_id_corrected_revision_id_key;
DROP INDEX IF EXISTS talent_credit_memos_invoice_revision_unique;
CREATE INDEX IF NOT EXISTS talent_credit_memos_invoice_revision_idx
  ON talent_credit_memos(original_invoice_id, corrected_revision_id);

DROP TRIGGER IF EXISTS client_monthly_invoice_lines_immutable ON client_monthly_invoice_lines;
CREATE TRIGGER client_monthly_invoice_lines_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON client_monthly_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION protect_client_monthly_invoice_lines();