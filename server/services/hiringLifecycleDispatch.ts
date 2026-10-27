import { query, pool } from "../db";
import { buildAppUrl, buildClientApplicationUrl, buildTalentApplicationsUrl } from "../lib/appUrl";
import { renderApplicantEmail, type EmailVariableContext } from "./emailVariableResolver";
import { isEmailServiceConfigured, sendApplicantEmail } from "./microsoftGraphEmailService";
import { REVEAL_STATUS_ORDER, revealedStatusesForThreshold } from "../../shared/submissionStatuses";
import { isDepositFirst } from "./contractorOnboardingPolicy";
import { preparePaidAgreements } from "./paidAgreementService";
import { ClientMsaService } from "./clientMsaService";
import { notifyClientOfTalentHired } from "./applicationNotificationService";
import { sendTalentHiredEmail } from "./emailCompanionService";

/**
 * Transactional outbox consumer. Call after COMMIT; failures are retained for
 * retry. Recipient-specific keys separately deduplicate bell and email work.
 * No receipt bytes, bank details or provider response bodies are logged.
 */
export async function dispatchHiringLifecycleEvents(): Promise<void> {
  try {
    const attempted:string[]=[];
    for(let batch=0;batch<3;batch++) {
    const events = (await query(`UPDATE hiring_lifecycle_events SET status='processing',
        attempted_at=now(),attempts=attempts+1
      WHERE event_key IN (SELECT event_key FROM hiring_lifecycle_events
         WHERE (status IN ('pending','failed') OR
           (status='processing' AND attempted_at<now()-interval '10 minutes'))
           AND NOT(event_key=ANY($1::text[]))
         ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END,created_at LIMIT 30 FOR UPDATE SKIP LOCKED)
       RETURNING *`,[attempted])).rows;
    if(!events.length)break;
    for (const event of events) {
      attempted.push(event.event_key);
      try {
        await deliverEvent(event);
        await query("UPDATE hiring_lifecycle_events SET status='sent' WHERE event_key=$1",[event.event_key]);
      } catch {
        await query("UPDATE hiring_lifecycle_events SET status='failed' WHERE event_key=$1",[event.event_key]);
        console.warn("[hiring-lifecycle] event delivery deferred",{type:event.event_type});
      }
    }
    }
  } catch { console.warn("[hiring-lifecycle] outbox unavailable; no business transaction reversed"); }
}

async function notify(event:any,user:any,category:string,type:string,title:string,message:string,url:string,context:EmailVariableContext,skipBell=false) {
  if (!user?.id) throw new Error("Recipient unavailable");
  const key=`${event.event_key}:${category}:${user.id}`;
  if(!skipBell)await query(`INSERT INTO notifications(user_id,type,title,message,related_id,related_type,event_key)
    VALUES($1,$2,$3,$4,$5,'url',$6) ON CONFLICT(event_key) DO NOTHING`,
    [user.id,type,title,message,url,key]);
  const template=(await query(`SELECT id,subject,body_html FROM applicant_email_templates
    WHERE category=$1 AND is_published=true AND is_archived=false
    ORDER BY is_default DESC,updated_at DESC LIMIT 1`,[category])).rows[0];
  if (!template || !user.email || !isEmailServiceConfigured()) throw new Error("Email configuration unavailable");
  const rendered=renderApplicantEmail({subject:template.subject,bodyHtml:template.body_html},{...context,portalUrl:buildAppUrl(url)});
  if (rendered.unresolvedKeys.length) throw new Error("Template variables unresolved");
  // Unlike legacy fail-open claims, failure to persist a claim prevents sending.
  const claimed=(await query(`INSERT INTO email_notification_deliveries
    (event_key,event_type,recipient_email,recipient_user_id,sender_email,template_category,
      template_id,related_type,related_id,status,attempted_at,subject,body_html)
    VALUES($1,$2,$3,$4,'hiretalent@onspotglobal.com',$2,$5,'hiring_lifecycle',$6,'processing',now(),$7,$8)
    ON CONFLICT(event_key) DO UPDATE SET status='processing',attempted_at=now()
      WHERE email_notification_deliveries.status='failed'
    RETURNING id`,[key,category,user.email,user.id,template.id,event.event_key,rendered.subject,rendered.bodyHtml])).rows;
  if (!claimed.length) {
    const old=(await query("SELECT status FROM email_notification_deliveries WHERE event_key=$1",[key])).rows[0];
    if (old?.status!=="sent") throw new Error("Delivery requires reconciliation");
    return;
  }
  let success=false;
  try {
    const result=await sendApplicantEmail({to:user.email,subject:rendered.subject,bodyHtml:rendered.bodyHtml,senderEmail:"hiretalent@onspotglobal.com"});
    success=result.success;
  } catch { /* Persist safe failure below, never provider bodies. */ }
  await query(`UPDATE email_notification_deliveries SET status=$2,
    sent_at=CASE WHEN $2='sent' THEN now() ELSE NULL END,
    error=CASE WHEN $2='failed' THEN 'Provider send failed' ELSE NULL END WHERE event_key=$1`,
    [key,success?"sent":"failed"]);
  if (!success) throw new Error("Email send failed");
}

async function deliverEvent(event:any) {
  const p=event.payload;
  if(event.event_type==="agreements_recheck") {
    await preparePaidAgreements(pool,p);
    return;
  }
  if(event.event_type==="msa_signed") {
    await new ClientMsaService(pool).activateClient(p.clientId);
    return;
  }
  // Persisted business work comes before any optional provider transport.
  const agreements=event.event_type==="deposit_verified"?await preparePaidAgreements(pool,p):null;
  if(agreements&&!agreements.eligible)return;
  const client = p.payerId
    ? (await query("SELECT id,email,first_name,last_name FROM users WHERE id=$1",[p.payerId])).rows[0] : null;
  const contextRow=p.submissionId ? (await query(`SELECT js.client_id,js.talent_id,j.title AS job_title,
      o.proposed_start_date::text AS proposed_start_date,d.id AS deposit_id,d.amount,d.currency
    FROM job_submissions js JOIN jobs j ON j.id=js.job_id
    LEFT JOIN hiring_contracts hc ON hc.submission_id=js.id AND hc.status NOT IN ('void','voided')
    LEFT JOIN offers o ON o.id=coalesce($3::uuid,hc.offer_id,(SELECT id FROM offers WHERE submission_id=js.id AND status IN ('accepted','offer_accepted') ORDER BY created_at DESC LIMIT 1))
    LEFT JOIN security_deposits d ON d.hiring_contract_id=hc.id OR d.offer_id=o.id
    WHERE js.id=$1 AND ($2::text IS NULL OR hc.id::text=$2)
    ORDER BY hc.created_at DESC LIMIT 1`,[p.submissionId,p.contractId??null,p.offerId??null])).rows[0] : null;
  let row=contextRow;
  if (!row && p.submissionId) row=(await query(`SELECT js.client_id,js.talent_id,j.title AS job_title
    FROM job_submissions js JOIN jobs j ON j.id=js.job_id WHERE js.id=$1`,[p.submissionId])).rows[0];
  const owner=client ?? (row ? (await query("SELECT id,email,first_name,last_name FROM users WHERE id=$1",[row.client_id])).rows[0] : null);
  const talent=row ? (await query("SELECT id,email,first_name,last_name FROM users WHERE id=$1",[row.talent_id])).rows[0] : null;
  // Do not bypass name reveal through invoices or companion emails.
  const threshold=(await query("SELECT value FROM platform_settings WHERE key='name_reveal_threshold'")).rows[0]?.value??"hired";
  const applicationStatus=p.submissionId?(await query("SELECT status FROM job_submissions WHERE id=$1",[p.submissionId])).rows[0]?.status:null;
  const normalizedThreshold=threshold==="submitted"?"new":threshold;
  const name=applicationStatus && REVEAL_STATUS_ORDER.some(status=>status===normalizedThreshold)
    && revealedStatusesForThreshold(normalizedThreshold).has(applicationStatus)
    ? [talent?.first_name,talent?.last_name].filter(Boolean).join(" ") || "Talent" : "Talent";
  const ctx:EmailVariableContext={
    logoUrl:buildAppUrl("/new-onspot.png"),
    talentName:name,jobTitle:row?.job_title || await obligationJob(p) || "your payment",
    clientName:[owner?.first_name,owner?.last_name].filter(Boolean).join(" ") || "Client",
    paymentAmount:`${p.currency??row?.currency??""} ${p.amount??row?.amount??""}`.trim(),
    paymentReference:p.reference??"",rejectionReason:p.reason??"",
    startDate:row?.proposed_start_date ? new Date(row.proposed_start_date).toISOString().slice(0,10) : undefined,
  };
  const invoiceUrl=`/client/payments/${p.category??"deposit"}/${encodeURIComponent(p.obligationId??p.depositId??row?.deposit_id??"")}`;
  if(event.event_type==="offer_accepted") {
    if(await isDepositFirst({query} as any,p.submissionId))return; // new invoice event combines acceptance + payment next step
    const path=new URL(buildClientApplicationUrl({applicationId:p.submissionId})).pathname+new URL(buildClientApplicationUrl({applicationId:p.submissionId})).search;
    await notify(event,owner,"hiring_offer_accepted","offer_accepted","Offer accepted",`${name} accepted your offer for ${ctx.jobTitle}. Next: sign the contract.`,path,ctx);
  } else if(event.event_type==="deposit_issued") {
    if(await isDepositFirst({query} as any,p.submissionId))await Promise.all([
      notify(event,owner,"hiring_acceptance_invoice","monthly_client_invoice","Offer accepted — deposit invoice ready",
        `${name} accepted your offer for ${ctx.jobTitle}. Your deposit invoice is ready.`,invoiceUrl,ctx),
      notify(event,talent,"hiring_talent_accepted","job_application_status_changed","Offer accepted",
        "Next, OnSpot will send your agreement once the Client's deposit is confirmed.",new URL(buildTalentApplicationsUrl()).pathname,ctx),
    ]);
    else await notify(event,owner,"hiring_deposit_invoice","monthly_client_invoice","Deposit invoice ready",`Your deposit invoice for ${ctx.jobTitle} is ready.`,invoiceUrl,ctx);
  } else if(event.event_type==="deposit_verified") {
    const admins=(await query("SELECT id,email FROM users WHERE role='admin' AND admin_sub_role IS NULL")).rows;
    await Promise.all(admins.map(admin=>notify(event,admin,"hiring_agreements_ready","hiring_payment_review",
      "Payment verified — prepare Contractor Agreement",`Prepare and send the Contractor Agreement for ${name} / ${ctx.jobTitle}.`,
      `/contracts?id=${agreements!.contractId}`,ctx)));
  } else if(event.event_type==="msa_required") {
    await notify(event,owner,"hiring_msa_required","monthly_client_invoice","Please review and sign the OnSpot Master Services Agreement",
      "Your verified payment allows agreement preparation. Review and sign the current MSA.","/client/msa",ctx);
  } else if(event.event_type==="msa_missing") {
    const admins=(await query("SELECT id,email FROM users WHERE role='admin' AND admin_sub_role IS NULL")).rows;
    await Promise.all(admins.map(admin=>notify(event,admin,"hiring_msa_missing","hiring_payment_review",
      "Activation blocked — current MSA missing",`Upload and activate the approved MSA before activating ${ctx.jobTitle}.`,"/admin/msa-documents",ctx)));
  } else if(event.event_type==="proof_submitted") {
    const admins=(await query("SELECT id,email FROM users WHERE role='admin' AND admin_sub_role IS NULL")).rows;
    await Promise.all([
      notify(event,owner,"hiring_payment_received","monthly_client_invoice","Payment received — verifying","Validation can take up to 24 hours.",invoiceUrl,ctx),
      ...admins.map(admin=>notify(event,admin,"hiring_payment_review","hiring_payment_review",
        "Payment submitted for verification",`${ctx.clientName} · ${ctx.jobTitle} · ${ctx.paymentAmount} · ${ctx.paymentReference}`,"/admin/ledger",ctx)),
    ]);
  } else if(event.event_type==="proof_rejected") {
    await notify(event,owner,"hiring_payment_rejected","monthly_client_invoice","Payment proof rejected",p.reason,invoiceUrl,ctx);
  } else if(event.event_type==="engagement_active") {
    if (!ctx.startDate) throw new Error("Accepted offer start date required");
    // Reuse the existing submission-keyed Hired delivery claims. The new
    // activation emails are separate editable messages, not duplicate bells.
    await notifyClientOfTalentHired({submissionId:p.submissionId,clientUserId:owner?.id,talentName:name,jobTitle:ctx.jobTitle});
    if(talent?.email)await sendTalentHiredEmail({submissionId:p.submissionId,talentUserId:talent.id,
      recipientEmail:talent.email,applicantName:name,jobTitle:ctx.jobTitle,companyName:"OnSpot"});
    await Promise.all([
      notify(event,owner,"hiring_client_active","talent_hired","Your engagement is now active",`${ctx.jobTitle} starts on ${ctx.startDate}.`,"/dashboard",ctx,true),
      notify(event,talent,"hiring_talent_active","job_application_status_changed","Your engagement is now active",`${ctx.jobTitle} starts on ${ctx.startDate}.`,new URL(buildTalentApplicationsUrl()).pathname,ctx),
    ]);
  }
}

async function obligationJob(p:any):Promise<string|undefined> {
  if(p.category==="deposit")return (await query(`SELECT j.title FROM security_deposits d LEFT JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
    JOIN job_submissions js ON js.id=coalesce(d.submission_id,hc.submission_id) JOIN jobs j ON j.id=js.job_id WHERE d.id=$1`,[p.obligationId])).rows[0]?.title;
  if(p.category==="hiring_invoice")return (await query(`SELECT j.title FROM hiring_pre_offer_invoices i
    JOIN job_submissions js ON js.id=i.submission_id JOIN jobs j ON j.id=js.job_id WHERE i.id=$1`,[p.obligationId])).rows[0]?.title;
  if(p.category==="monthly_invoice")return (await query(`SELECT string_agg(DISTINCT j.title,', ') AS title
    FROM client_monthly_invoice_lines l JOIN talent_invoices ti ON ti.id=l.talent_invoice_id
    JOIN hiring_contracts hc ON hc.id=ti.hiring_contract_id
    JOIN job_submissions js ON js.id=hc.submission_id JOIN jobs j ON j.id=js.job_id
    WHERE l.client_monthly_invoice_id=$1`,[p.obligationId])).rows[0]?.title;
  if(!["deposit","replenishment","invoice"].includes(p.category)) return;
  const table=p.category==="deposit"?"security_deposits":p.category==="invoice"?"invoices":"security_deposit_replenishments";
  return (await query(`SELECT j.title FROM ${table} d JOIN hiring_contracts hc ON hc.id=d.hiring_contract_id
    JOIN job_submissions js ON js.id=hc.submission_id JOIN jobs j ON j.id=js.job_id WHERE d.id=$1`,[p.obligationId])).rows[0]?.title;
}
