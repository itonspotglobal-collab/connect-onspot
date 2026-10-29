-- Grandfather only applications already in flight at the original 0044 cutover.
-- No application, offer, contract, invoice or deposit status is changed.
ALTER TABLE contractor_onboarding_cohorts ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE contractor_onboarding_cohorts ADD COLUMN IF NOT EXISTS migrated_at timestamptz;
DO $$
DECLARE cutover timestamptz;
BEGIN
  IF to_regclass('public.app_schema_migrations') IS NULL THEN RETURN; END IF;
  SELECT applied_at INTO cutover FROM app_schema_migrations WHERE id='0044_contractor_onboarding';
  IF cutover IS NULL THEN RETURN; END IF;
  UPDATE contractor_onboarding_cohorts c
  SET workflow_version=1,
      reason='Grandfathered: interview or in-flight hiring stage predates the 0044 cutover',
      migrated_at=now()
  WHERE c.workflow_version=2 AND c.captured_at<=cutover
    AND c.captured_status NOT IN ('offer_accepted','contract_sent','contract_signed','hired')
    AND (c.captured_status IN ('interviewing','offer_extended','offer_declined')
      OR EXISTS(SELECT 1 FROM interviews i WHERE i.submission_id=c.submission_id
        AND i.created_at AT TIME ZONE 'UTC'<cutover))
    AND NOT EXISTS(SELECT 1 FROM offers o WHERE o.submission_id=c.submission_id
      AND (o.status IN ('accepted','offer_accepted') OR o.accepted_at IS NOT NULL))
    AND NOT EXISTS(SELECT 1 FROM security_deposits d WHERE d.submission_id=c.submission_id AND d.offer_id IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM hiring_contracts hc WHERE hc.submission_id=c.submission_id);
END $$;
