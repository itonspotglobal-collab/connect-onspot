// Pure SQL contract shared by route guards and isolated financial services.
// Consumers prefix the first term with js.; every joined submission uses js.
export const FORMAL_PIPELINE_PREDICATE = `workflow_type IN ('client_invitation', 'application')
  AND js.status NOT IN ('rejected', 'withdrawn', 'declined')
  AND EXISTS (
    SELECT 1 FROM jobs hiring_job
     WHERE hiring_job.id = js.job_id AND hiring_job.client_id = js.client_id
       AND hiring_job.created_via <> 'search_scaffold'
       AND EXISTS (SELECT 1 FROM users hiring_owner
                    WHERE hiring_owner.id = hiring_job.client_id AND hiring_owner.role IN ('client', 'admin'))
        AND EXISTS (SELECT 1 FROM users hiring_talent
                     WHERE hiring_talent.id = js.talent_id AND hiring_talent.role = 'talent')
       AND (
         js.workflow_type = 'client_invitation'
         OR (
           js.initiated_by = 'talent' AND js.registration_status = 'linked'
           AND hiring_job.approval_status = 'approved'
           AND hiring_job.status <> 'draft'
         )
       )
  )` as const;
