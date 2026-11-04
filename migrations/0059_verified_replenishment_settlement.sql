-- Keep replenishments append-only except for the existing manual Wise
-- unpaid -> independently verified paid transition. No historical row changes.
CREATE OR REPLACE FUNCTION public.protect_security_deposit_replenishments()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status = 'unpaid'
      AND OLD.verified_at IS NULL
      AND NEW.payment_status = 'paid'
      AND NEW.verified_at IS NOT NULL
      AND NEW.verified_at <= now()
      AND length(btrim(NEW.reference)) > 0
      AND (to_jsonb(NEW) - ARRAY['payment_status','verified_at','reference'])
        = (to_jsonb(OLD) - ARRAY['payment_status','verified_at','reference'])
      AND EXISTS (
        SELECT 1
        FROM public.manual_wise_obligations o
        JOIN public.manual_wise_submissions s ON s.obligation_id = o.id
        JOIN public.users verifier ON verifier.id = s.verified_by
        WHERE o.category = 'replenishment' AND o.replenishment_id = NEW.id
          AND s.status = 'paid'
          AND verifier.role = 'admin' AND verifier.admin_sub_role IS NULL
          AND s.verified_at = NEW.verified_at
          AND s.amount = NEW.amount AND s.verified_amount = NEW.amount
          AND s.currency = NEW.currency AND s.verified_currency = NEW.currency
          AND s.verified_recipient = s.recipient
          AND s.settled_at IS NOT NULL AND s.settled_at <= now()
          AND s.verified_reference = NEW.reference
      )
    THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'security deposit replenishments are immutable except for independently verified settlement';
END;
$$;
