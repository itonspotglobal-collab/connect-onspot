import { FORMAL_PIPELINE_PREDICATE } from "./formalPipelineGuard";

/** Historical terminated hires remain readable; offers/unsigned contracts do not. */
export const TIMESHEET_HIRE_SQL = `hc.status IN ('signed', 'terminated')
  AND hc.talent_signed_at IS NOT NULL AND hc.onspot_signed_at IS NOT NULL
  AND js.${FORMAL_PIPELINE_PREDICATE}`;

/** Workspaces are Client-account memberships, not Talent workforce memberships. */
export const TIMESHEET_CONTEXT_SQL = `j.title AS job_title, js.job_id, js.talent_id, js.client_id,
  hc.billing_mode, hc.status AS contract_status,
  COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', talent.first_name, talent.last_name)), ''),
    (SELECT NULLIF(BTRIM(CONCAT_WS(' ', p.first_name, p.last_name)), '') FROM profiles p WHERE p.user_id = js.talent_id),
    NULLIF(BTRIM(js.applicant_name), ''), 'Talent') AS talent_name,
  COALESCE((SELECT NULLIF(BTRIM(p.profile_picture), '') FROM profiles p WHERE p.user_id = js.talent_id),
    NULLIF(BTRIM(talent.profile_image_url), '')) AS talent_avatar,
  COALESCE(NULLIF(BTRIM(client.company), ''), NULLIF(BTRIM(CONCAT_WS(' ', client.first_name, client.last_name)), '')) AS client_name,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name) ORDER BY o.name, o.id)
    FROM organizations o JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = js.client_id AND om.status = 'active'), '[]'::jsonb) AS organizations`;

export function timesheetDisplayContext(row: any) {
  return {
    hiringContractId: row.hiring_contract_id ?? row.id, jobId: row.job_id,
    jobTitle: row.job_title, talentId: row.talent_id, talentName: row.talent_name,
    talentAvatar: row.talent_avatar ?? null, clientId: row.client_id, clientName: row.client_name ?? null,
    organizations: Array.isArray(row.organizations) ? row.organizations : [],
    billingMode: row.billing_mode, contractStatus: row.contract_status,
  };
}
