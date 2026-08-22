-- Lightweight client shortlists share job_submissions with the hiring pipeline,
-- but must remain distinguishable from applications and formal invitations.
ALTER TABLE job_submissions
  ADD COLUMN IF NOT EXISTS workflow_type text NOT NULL DEFAULT 'application';

UPDATE job_submissions
   SET workflow_type = 'client_invitation'
 WHERE workflow_type = 'application'
   AND initiated_by = 'client'
   AND (
     status IN ('invited', 'declined')
     OR combined_invite_reveal = true
     OR EXISTS (
       SELECT 1 FROM interviews i WHERE i.submission_id = job_submissions.id
     )
   );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'job_submissions'::regclass
       AND conname = 'job_submissions_workflow_type_check'
  ) THEN
    ALTER TABLE job_submissions
      ADD CONSTRAINT job_submissions_workflow_type_check
      CHECK (workflow_type IN ('application', 'client_shortlist', 'client_invitation'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS job_submissions_active_shortlist_unique
  ON job_submissions (client_id, job_id, talent_id)
 WHERE workflow_type = 'client_shortlist' AND status = 'shortlisted';