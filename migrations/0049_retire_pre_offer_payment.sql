-- Preserve all historical financial records. No application is rebilled.
INSERT INTO platform_settings(key,value,updated_at)
VALUES('HIRING_PRE_OFFER_PAYMENT_REQUIRED','false',now())
ON CONFLICT(key) DO UPDATE SET value='false',updated_at=now();

-- Keep the trigger's independent identity protection, not the retired fee gate.
CREATE OR REPLACE FUNCTION enforce_hiring_pre_offer_payment() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.submission_id IS DISTINCT FROM OLD.submission_id THEN
    RAISE EXCEPTION 'Offer submission identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
