import type {OnboardingDb} from "./contractorOnboardingPolicy";

/** Only the audited Admin override service can write these flags; never infer signatures. */
export async function hiringOverrideState(db:OnboardingDb,submissionId:string) {
  const row=(await db.query(`SELECT
    coalesce(bool_or(new_state->>'finalInterviewPassed'='true'),false) AS final_passed,
    coalesce(bool_or(new_state->>'skipContractorAgreement'='true'),false) AS skip_contract,
    coalesce(bool_or(new_state->>'skipMsa'='true'),false) AS skip_msa,
    array_agg(new_state->>'status') FILTER (WHERE action IN ('skip_stage','direct_placement')) AS stages
    FROM admin_hiring_overrides WHERE submission_id=$1 AND reverted_at IS NULL
      AND action<>'revert_override'`,[submissionId])).rows[0];
  return {finalInterviewPassed:row?.final_passed===true,skipContractorAgreement:row?.skip_contract===true,skipMsa:row?.skip_msa===true,
    overriddenStages:(row?.stages??[]) as string[]};
}
