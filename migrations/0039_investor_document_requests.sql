-- Preserve all existing inquiries. Document leads do not require a firm.
ALTER TABLE public.investor_requests
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS requested_document text;

ALTER TABLE public.investor_requests
  DROP CONSTRAINT IF EXISTS investor_requests_firm_check,
  DROP CONSTRAINT IF EXISTS investor_requests_request_type_check,
  DROP CONSTRAINT IF EXISTS investor_requests_document_check;

ALTER TABLE public.investor_requests
  ADD CONSTRAINT investor_requests_request_type_check
    CHECK (request_type IN ('meeting', 'deck', 'founder', 'valuation')),
  ADD CONSTRAINT investor_requests_firm_check
    CHECK (btrim(firm) <> '' OR
      (source IS NOT DISTINCT FROM 'investors-page' AND requested_document IS NOT NULL)),
  ADD CONSTRAINT investor_requests_document_check
    CHECK (
      (source IS NULL AND requested_document IS NULL AND request_type <> 'valuation')
      OR
      (source IS NOT DISTINCT FROM 'investors-page'
        AND requested_document IS NOT NULL
        AND requested_document IN ('deck', 'valuation')
        AND request_type = requested_document)
    );
