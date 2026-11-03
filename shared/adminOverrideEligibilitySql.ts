// Deliberately separate from normal client/talent hiring eligibility.
// Like FORMAL_PIPELINE_PREDICATE, consumers prefix the first term with js.
export const ADMIN_OVERRIDE_ELIGIBILITY_PREDICATE = `status NOT IN ('rejected','withdrawn','declined')
  AND EXISTS (SELECT 1 FROM users override_talent
    WHERE override_talent.id=js.talent_id AND override_talent.role='talent')
  AND EXISTS (SELECT 1 FROM jobs override_job
    WHERE override_job.id=js.job_id AND override_job.client_id=js.client_id)` as const;

// Downstream Admin preparation may continue an already-recorded exception.
// A rejected/reverted audit or a later broken account/ownership link is not enough.
export const AUDITED_ADMIN_OVERRIDE_ELIGIBILITY_PREDICATE = `${ADMIN_OVERRIDE_ELIGIBILITY_PREDICATE}
  AND EXISTS (SELECT 1 FROM admin_hiring_overrides eligibility_override
    JOIN users override_admin ON override_admin.id=eligibility_override.actor_id AND override_admin.role='admin'
    WHERE eligibility_override.submission_id=js.id AND eligibility_override.reverted_at IS NULL
      AND eligibility_override.action IN ('skip_stage','waive_deposit','skip_agreements','direct_placement'))` as const;
