-- No start-date or calculation changes. Preserve executed-contract immutability,
-- extending only first activation to the audited deposit waiver/offline-MSA paths.
CREATE OR REPLACE FUNCTION prevent_signed_contract_billing_start_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('signed','terminated') THEN
  IF NEW.effective_start_date IS DISTINCT FROM OLD.effective_start_date THEN
   RAISE EXCEPTION 'executed contract billing start is immutable';
  END IF;
  IF NEW.billing_activated_at IS DISTINCT FROM OLD.billing_activated_at THEN
   IF OLD.status='signed' AND NEW.status='signed'
      AND OLD.billing_activated_at IS NULL AND NEW.billing_activated_at=now()
      AND OLD.onspot_signed_at IS NOT NULL AND OLD.talent_signed_at IS NOT NULL
      AND EXISTS (
       SELECT 1 FROM job_submissions js
       JOIN contractor_onboarding_cohorts c ON c.submission_id=js.id AND c.workflow_version=2
       JOIN offers o ON o.id=OLD.offer_id AND o.submission_id=js.id AND o.status IN ('accepted','offer_accepted')
       JOIN security_deposits d ON d.hiring_contract_id=OLD.id AND d.offer_id=o.id AND d.submission_id=js.id
       JOIN msa_documents md ON md.active AND md.effective_at<=now()
       WHERE js.id=OLD.submission_id AND js.status='hired'
        AND (d.status='held' OR (d.status='waived' AND EXISTS (
          SELECT 1 FROM hiring_payment_waivers w JOIN users a ON a.id=w.granted_by
          WHERE w.deposit_id=d.id AND w.submission_id=js.id AND w.scope='deposit'
            AND w.waiver_type='waive' AND w.revoked_at IS NULL
            AND length(btrim(w.arrangement_note))>=10 AND a.role='admin' AND a.admin_sub_role IS NULL)))
        AND (EXISTS(SELECT 1 FROM client_msa_signatures s
          WHERE s.client_id=js.client_id AND s.document_id=md.id AND s.msa_version=md.version AND s.document_sha256=md.sha256)
          OR EXISTS(SELECT 1 FROM client_msa_offline_evidence e JOIN users a ON a.id=e.recorded_by
          WHERE e.client_id=js.client_id AND e.document_id=md.id AND e.msa_version=md.version
            AND e.document_sha256=md.sha256 AND a.role='admin' AND a.admin_sub_role IS NULL))
      ) THEN RETURN NEW;
   END IF;
   RAISE EXCEPTION 'executed contract billing start is immutable';
  END IF;
 END IF;
 RETURN NEW;
END $$;
