import type { PoolClient } from "pg";
import { isDepositFirst, OnboardingError } from "./contractorOnboardingPolicy";

export async function onboardingStatus(db:Pick<PoolClient,"query">,id:string,actorId:string) {
  const s=(await db.query(`SELECT js.*,u.role AS actor_role FROM job_submissions js JOIN users u ON u.id=$2
    WHERE js.id=$1 AND (u.role='admin' OR js.client_id=u.id OR js.talent_id=u.id)`,[id,actorId])).rows[0];
  if(!s)throw new OnboardingError(404,"APPLICATION_NOT_FOUND","Application not found.");
  const depositFirst=await isDepositFirst(db,id);
  const interviews=(await db.query("SELECT interview_type,status,outcome FROM interviews WHERE submission_id=$1",[id])).rows;
  const final=interviews.some(i=>i.interview_type==="final"&&i.status==="completed"&&["advance","passed"].includes(String(i.outcome).trim().toLowerCase()));
  const shortlisted=["shortlisted","interviewing"].includes(s.status)||!!(await db.query(
    "SELECT 1 FROM job_application_status_history WHERE application_id=$1 AND new_status='shortlisted' LIMIT 1",[id])).rows.length;
  const offer=(await db.query(`SELECT id,status FROM offers WHERE submission_id=$1
    ORDER BY CASE WHEN status IN ('accepted','offer_accepted') THEN 0 ELSE 1 END,created_at DESC LIMIT 1`,[id])).rows[0];
  const contract=(await db.query("SELECT id,status,onspot_signed_at,talent_signed_at FROM hiring_contracts WHERE submission_id=$1 AND status NOT IN ('void','voided') ORDER BY created_at DESC LIMIT 1",[id])).rows[0];
  const deposit=(await db.query(`SELECT d.*,s.status AS proof_status FROM security_deposits d
    LEFT JOIN manual_wise_obligations o ON o.deposit_id=d.id
    LEFT JOIN LATERAL(SELECT status FROM manual_wise_submissions WHERE obligation_id=o.id ORDER BY created_at DESC LIMIT 1)s ON true
    WHERE (d.offer_id=$1 OR d.hiring_contract_id=$2) ORDER BY d.created_at DESC LIMIT 1`,[offer?.id??null,contract?.id??null])).rows[0];
  const msa=(await db.query("SELECT id,version,sha256 FROM msa_documents WHERE active AND effective_at<=now()")).rows[0];
  const msaSigned=!!msa&&!!(await db.query("SELECT 1 FROM client_msa_signatures WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3 AND msa_version=$4",
    [s.client_id,msa.id,msa.sha256,msa.version])).rows.length;
  const conditions={depositHeld:deposit?.status==="held",contractSigned:contract?.status==="signed",msaSigned};
  const missing=depositFirst?[
    ...(!conditions.depositHeld?["Deposit payment must be independently verified"]:[]),
    ...(!conditions.contractSigned?["Contractor Agreement must be fully signed"]:[]),
    ...(!msa?["OnSpot must upload and activate the current MSA"]:!msaSigned?["Client must sign the current MSA"]:[]),
  ]:[];
  const accepted=offer&&["accepted","offer_accepted"].includes(offer.status);
  const flags=[true,shortlisted,interviews.length>0,final,!!accepted,!!deposit,conditions.depositHeld,
    conditions.contractSigned&&(!depositFirst||msaSigned),s.status==="hired"];
  const labels=["Application","Shortlisted","Interview","Final interview","Offer","Invoice","Payment verified","Agreements","Active"];
  const keys=["application","shortlisted","interview","final_interview","offer","invoice","payment_verified","agreements","active"];
  const actors=["Talent","Client","Client / Talent","Client / Admin","Talent","Client","Super Admin","Client / Talent / OnSpot","OnSpot"];
  const current=s.status==="hired"?-1:accepted
    ?(!deposit?5:!conditions.depositHeld?6:!conditions.contractSigned||!msaSigned?7:8)
    :final?4:interviews.length?3:flags.findIndex(done=>!done);
  let nextActor=current<0?"None":actors[current];
  if(accepted&&!conditions.depositHeld)nextActor=deposit?.proof_status==="verification_pending"?"Super Admin":"Client";
  if(conditions.depositHeld&&!conditions.contractSigned)nextActor=contract?.status==="sent"?"Talent / OnSpot":"OnSpot";
  if(conditions.contractSigned&&!msaSigned)nextActor=msa?"Client":"Super Admin";
  return {policy:depositFirst?"deposit_first":"legacy",submissionId:id,status:s.status,
    shortlistSatisfied:shortlisted,finalInterviewPassed:final,
    canScheduleInterview:depositFirst?["shortlisted","interviewing"].includes(s.status):["new","under_review","reviewed","shortlisted","interviewing"].includes(s.status),
    canSendOffer:(!depositFirst||final)&&["under_review","reviewed","shortlisted","interviewing","offer_declined"].includes(s.status),
    defaultInterviewType:interviews.some(i=>i.status==="completed")?"final":"initial",
    offerId:offer?.id??null,deposit:deposit?(s.actor_role==="talent"
      ?{status:conditions.depositHeld?"held":"pending",paymentStatus:conditions.depositHeld?"paid":"awaiting_payment",invoiceUrl:null}
      :{id:deposit.id,status:deposit.status,paymentStatus:deposit.status==="held"?"paid":deposit.proof_status??"awaiting_payment",
        invoiceUrl:`/client/payments/deposit/${deposit.id}`}):null,
    contract:contract?{id:contract.id,status:contract.status,url:`/contracts?id=${contract.id}`}:null,
    msa:{version:msa?.version??null,signed:msaSigned,available:!!msa,url:"/client/msa"},
    conditions,canPrepareContract:!!accepted&&(!depositFirst||conditions.depositHeld)&&(!contract||["void","voided"].includes(contract.status)),
    missing,nextActor,stages:keys.map((key,i)=>({key,label:labels[i],complete:flags[i],current:i===current,actor:actors[i]}))};
}
