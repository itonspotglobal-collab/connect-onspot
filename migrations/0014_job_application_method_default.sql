-- Client-created jobs use OnSpot's built-in application form unless an
-- external application method is explicitly configured with a real URL.

ALTER TABLE jobs
  ALTER COLUMN application_method SET DEFAULT 'built_in_form';

UPDATE jobs
   SET application_method = 'built_in_form',
       apply_link = NULL,
       updated_at = NOW()
 WHERE is_client_submitted = TRUE
   AND (
        application_method IS NULL
        OR application_method = ''
        OR application_method = 'external_link'
   )
   AND (
        apply_link IS NULL
        OR btrim(apply_link) = ''
        OR apply_link ILIKE '%leadconnectorhq.com%'
   );