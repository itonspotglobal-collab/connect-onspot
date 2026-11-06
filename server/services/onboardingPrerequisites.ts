import type {PoolClient} from "pg";
import {queueHiringLifecycleEvent} from "./hiringLifecycleEvents";
export async function onboardingPrerequisites(db:Pick<PoolClient,"query">) {
  const r=(await db.query(`SELECT EXISTS(SELECT 1 FROM manual_wise_config WHERE active AND revoked_at IS NULL
    AND config_status='active' AND deposit_funding_confirmed AND currency='USD') AS wise,
    (EXISTS(SELECT 1 FROM msa_documents WHERE active AND effective_at<=now())
      OR EXISTS(SELECT 1 FROM contract_templates WHERE kind='msa' AND status='active')) AS msa`)).rows[0];
  return {canManage:true,wiseReady:!!r.wise,msaReady:!!r.msa,wiseUrl:"/admin/ledger#manual-wise-admin",msaUrl:"/admin/msa-documents"};
}
export async function enqueueOnboardingSetupAlerts(db:Pick<PoolClient,"query">) {
  const setup=await onboardingPrerequisites(db);
  if(setup.wiseReady&&setup.msaReady)return 0;
  const count=Number((await db.query(`SELECT count(*) AS total FROM job_submissions js JOIN offers o ON o.submission_id=js.id
    WHERE js.status IN('offer_accepted','contract_sent','contract_signed') AND o.status IN('accepted','offer_accepted')`)).rows[0].total);
  if(!count)return 0;
  const day=(await db.query("SELECT current_date::text AS day")).rows[0].day;
  return Number(await queueHiringLifecycleEvent(db,`onboarding-setup:${day}`,"onboarding_setup_alert",
    {count,reason:[...(!setup.wiseReady?["Clients can't pay deposits — add payment instructions"]:[]),
      ...(!setup.msaReady?["New engagements cannot be activated until an MSA is uploaded"]:[])].join(". ")}));
}
