import type {Pool,PoolClient} from "pg";
import {AdminHiringOverrideService} from "./adminHiringOverrideService";
import {ManualWiseService} from "./manualWiseService";
import {lockOnboarding,OnboardingError} from "./contractorOnboardingPolicy";
import {queueHiringLifecycleEvent,tryActivateEngagement} from "./hiringLifecycleEvents";
import {depositArrangement} from "./depositArrangementState";
import {contractBlobProvider,pdfHash,validateContractPdf,type ContractBlobProvider} from "./contractBlobStore";
import {inspectWiseFile} from "./manualWiseFiles";
const fail=(s:number,c:string,m:string):never=>{throw new OnboardingError(s,c,m);};
export class DepositBillingService {
  auth:AdminHiringOverrideService;
  constructor(private pool:Pool,private afterCommit?:()=>Promise<void>,private blobs:ContractBlobProvider=contractBlobProvider) {
    this.auth=new AdminHiringOverrideService(pool);
  }
  async authorize(actor:string){await this.auth.capabilities(actor);}
  private async canonical(db:Pick<PoolClient,"query">,id:string) {
    const link=(await db.query("SELECT canonical_submission_id FROM onboarding_submission_links WHERE submission_id=$1",[id])).rows[0];
    return link?.canonical_submission_id??id;
  }
  async status(actor:string,id:string) {
    await this.authorize(actor);id=await this.canonical(this.pool,id);
    const deposit=(await this.pool.query(`SELECT d.*, '/client/payments/deposit/'||d.id AS "invoiceUrl"
      FROM security_deposits d JOIN offers o ON o.id=d.offer_id WHERE d.submission_id=$1 AND o.status IN('accepted','offer_accepted')
      ORDER BY d.created_at DESC LIMIT 1`,[id])).rows[0]??null;
    if(deposit) {
      const evidence=(await this.pool.query("SELECT id,receipt_object_key FROM external_deposit_payments WHERE deposit_id=$1",[deposit.id])).rows[0];
      deposit.receiptUrl=evidence?.receipt_object_key?`/api/admin/deposit-receipts/${deposit.id}`:null;
    }
    return {canManage:true,submissionId:id,deposit,waiver:await depositArrangement(this.pool,id)};
  }
  private async audit(db:PoolClient,actor:string,s:any,action:string,reason:string,previous:any,next:any) {
    await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
      VALUES($1,$2,$2,$3,$4)`,[s.id,s.status,`Super Admin deposit action: ${action}: ${reason}`,actor]);
    await db.query(`INSERT INTO admin_hiring_overrides(actor_id,submission_id,client_id,talent_id,action,previous_state,new_state,reason,notify_parties)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)`,[actor,s.id,s.client_id,s.talent_id,action,JSON.stringify(previous),JSON.stringify(next),reason]);
    await db.query("INSERT INTO manual_wise_audit(actor_id,event,details) VALUES($1,$2,$3)",[actor,action,JSON.stringify({submissionId:s.id,...next})]);
  }
  async act(actor:string,id:string,action:string,input:any,file?:any) {
    await this.authorize(actor); // before uploading or consuming private storage
    if(!["record_payment","defer","waive","resend_invoice"].includes(action))fail(404,"ACTION_NOT_FOUND","Unknown deposit action.");
    const reason=typeof input?.reason==="string"?input.reason.trim():"";
    if(reason.length<10||reason.length>2000)fail(422,"REASON_REQUIRED","A written reason of 10–2000 characters is required.");
    let receipt:{key:string;contentType:string;filename:string}|undefined,keep=false;
    if(file) {
      let contentType:string;
      try{contentType=await inspectWiseFile(file.buffer);}catch(e:any){fail(422,"INVALID_RECEIPT",e.message);}
      const key=await this.blobs.save(file.buffer);
      receipt={key,contentType:contentType!,filename:String(file.originalname??"receipt").replace(/[\r\n]/g,"").slice(0,180)};
      if(pdfHash(await this.blobs.read(key))!==pdfHash(file.buffer)){await this.blobs.remove(key);throw new Error("Private receipt integrity failure");}
    }
    const db=await this.pool.connect();
    try {
      await db.query("BEGIN");await this.auth.authorize(db,actor);
      id=await this.canonical(db,id);await lockOnboarding(db,id);
      const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if(!s)fail(404,"APPLICATION_NOT_FOUND","Application not found.");
      const offer=(await db.query(`SELECT * FROM offers WHERE submission_id=$1 AND status IN('accepted','offer_accepted')
        ORDER BY accepted_at DESC NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE`,[id])).rows[0];
      if(!offer||["rejected","withdrawn","declined"].includes(s.status))fail(409,"ACCEPTED_OFFER_REQUIRED","An eligible accepted offer is required.");
      await db.query("SELECT id FROM hiring_contracts WHERE offer_id=$1 ORDER BY id FOR UPDATE",[offer.id]);
      const d=(await db.query("SELECT * FROM security_deposits WHERE offer_id=$1 FOR UPDATE",[offer.id])).rows[0];
      if(!d)fail(409,"DEPOSIT_MISSING","Run the missing-deposit dry-run repair first.");
      let result:any={depositId:d.id,action};
      let changed=true;
      if(action==="record_payment") {
        result=await new ManualWiseService(this.pool).recordExternalDeposit(db,actor,d.id,{
          amount:String(input.amount),currency:input.currency,receivedAt:input.receivedAt,reference:input.reference,
          method:input.method,reason,independentlyVerified:input.independentlyVerified===true||input.independentlyVerified==="true"},receipt);
        changed=!result.replay;keep=changed&&!!receipt;
      } else if(action==="resend_invoice") {
        if(d.status!=="pending")fail(409,"INVOICE_NOT_OPEN","Only an open deposit invoice can send a payment-required email.");
        if(!/^[a-f0-9-]{36}$/i.test(input.requestId??""))fail(422,"REQUEST_ID_REQUIRED","A resend request identifier is required.");
        changed=await queueHiringLifecycleEvent(db,`deposit-resend:${d.id}:${input.requestId}`,"deposit_invoice_resend",
          {submissionId:id,depositId:d.id,payerId:s.client_id,amount:d.amount,currency:d.currency});
      } else {
        const prior=await depositArrangement(db,id);
        const note=typeof input.arrangementNote==="string"?input.arrangementNote.trim():"";
        if(action==="waive"&&(note.length<10||note.length>2000))fail(422,"ARRANGEMENT_REQUIRED","Describe the special arrangement in 10–2000 characters.");
        let due:string|null=null;
        if(action==="defer") {
          if(typeof input.dueDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)||
            !Number.isFinite(Date.parse(input.dueDate))||new Date(input.dueDate).toISOString().slice(0,10)!==input.dueDate)
            fail(422,"DUE_DATE_REQUIRED","Choose a valid agreed invoice due date.");
          due=`${input.dueDate}T23:59:59Z`;
          if(Date.parse(due)<=Date.now())fail(422,"FUTURE_DUE_DATE_REQUIRED","Choose a future due date.");
        }
        const type=action==="defer"?"defer":"waive";
        if(prior?.waiver_type===type&&prior.reason===reason&&
          (type==="waive"?prior.arrangement_note===note:new Date(prior.deposit_due_at).toISOString()===new Date(due!).toISOString())) {
          changed=false;result={...result,waiverId:prior.id,replay:true};
        } else {
          if(d.status!=="pending")fail(409,"PENDING_DEPOSIT_REQUIRED","Only pending deposits can be deferred or waived; settled funds remain unchanged.");
          if(prior)await db.query(`UPDATE hiring_payment_waivers SET revoked_at=now(),revoked_by=$2,
            revoke_reason='Replaced by a newly approved deposit arrangement' WHERE id=$1`,[prior.id,actor]);
          const w=(await db.query(`INSERT INTO hiring_payment_waivers(submission_id,client_id,job_id,talent_id,waiver_type,reason,
            arrangement_note,granted_by,scope,deposit_id,deposit_due_at,locked_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'deposit',$9,$10,now()) RETURNING id`,
            [id,s.client_id,s.job_id,s.talent_id,type,reason,note||null,actor,d.id,due])).rows[0];
          result={...result,waiverId:w.id,dueDate:due};
          if(action==="waive") {
            await db.query(`UPDATE security_deposits SET status='waived',waived_by=$2,waived_at=now(),waiver_reason=$3,updated_at=now() WHERE id=$1`,[d.id,actor,note]);
            await db.query(`UPDATE manual_wise_obligations SET cancelled_at=now(),cancellation_reason=$2
              WHERE deposit_id=$1 AND cancelled_at IS NULL`,[d.id,`Deposit waived — ${note}`]);
            await queueHiringLifecycleEvent(db,`deposit-waived:${d.id}`,"deposit_verified",{depositId:d.id,submissionId:id,offerId:offer.id,actorId:actor,waived:true});
          } else await queueHiringLifecycleEvent(db,`deposit-deferred-agreements:${w.id}`,"agreements_recheck",
            {depositId:d.id,submissionId:id,offerId:offer.id,actorId:actor,deferred:true});
        }
      }
      if(changed) {
        await this.audit(db,actor,s,`deposit_${action}`,reason,{status:d.status},result);
        if(action!=="resend_invoice")await queueHiringLifecycleEvent(db,`deposit-action:${action}:${result.id??result.waiverId}`,"deposit_arrangement",
          {submissionId:id,depositId:d.id,action,amount:d.amount,currency:d.currency,dueDate:result.dueDate??null,payerId:s.client_id});
      }
      await tryActivateEngagement(db,id,actor);
      await db.query("COMMIT");
      void this.afterCommit?.().catch(()=>{});
      return result;
    }catch(e){keep=false;await db.query("ROLLBACK").catch(()=>{});throw e;}
    finally {db.release();if(receipt&&!keep)await this.blobs.remove(receipt.key).catch(()=>{});}
  }
  async recordOfflineMsa(actor:string,id:string,input:any,file:any) {
    await this.authorize(actor);
    const reason=typeof input.reason==="string"?input.reason.trim():"";
    if(reason.length<10||reason.length>2000||typeof input.signerName!=="string"||!input.signerName.trim()||
      input.signerName.length>200||typeof input.signerEmail!=="string"||input.signerEmail.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.signerEmail)||
      typeof input.signedAt!=="string"||!Number.isFinite(Date.parse(input.signedAt))||Date.parse(input.signedAt)>Date.now())
      fail(422,"MSA_EVIDENCE_REQUIRED","Provide the signer, email, actual past signature date and a 10–2000 character attestation reason.");
    if(!file)fail(422,"SIGNED_PDF_REQUIRED","Upload the signed MSA PDF.");
    const meta=await validateContractPdf(file);
    const key=await this.blobs.save(file.buffer);let keep=false;
    const db=await this.pool.connect();
    try{
      if(pdfHash(await this.blobs.read(key))!==meta.sha256)throw new Error("Private signed MSA integrity failure");
      await db.query("BEGIN");await this.auth.authorize(db,actor);id=await this.canonical(db,id);
      await lockOnboarding(db,id);
      const s=(await db.query("SELECT * FROM job_submissions WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if(!s)fail(404,"APPLICATION_NOT_FOUND","Application not found.");
      const doc=(await db.query("SELECT * FROM msa_documents WHERE id=$1 AND active AND effective_at<=now() FOR SHARE",[input.documentId])).rows[0];
      if(!doc)fail(409,"ACTIVE_MSA_REQUIRED","Upload and activate the approved canonical MSA version first. An uploaded signed copy cannot invent or activate a version.");
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`client-msa-offline:${s.client_id}:${doc.id}`]);
      const prior=(await db.query("SELECT * FROM client_msa_offline_evidence WHERE client_id=$1 AND document_id=$2",[s.client_id,doc.id])).rows[0];
      if(prior) {
        if(prior.sha256!==meta.sha256||prior.signer_email!==input.signerEmail.trim()||prior.signer_name!==input.signerName.trim()||
          new Date(prior.signed_at).getTime()!==Date.parse(input.signedAt))fail(409,"MSA_EVIDENCE_EXISTS","Different offline evidence already exists for this Client/version; retain it for review.");
        await db.query("COMMIT");return {id:prior.id,replay:true};
      }
      const evidence=(await db.query(`INSERT INTO client_msa_offline_evidence(client_id,document_id,document_sha256,msa_version,
        object_key,sha256,filename,signer_name,signer_email,signed_at,recorded_by,reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [s.client_id,doc.id,doc.sha256,doc.version,key,meta.sha256,meta.filename,input.signerName.trim(),input.signerEmail.trim(),input.signedAt,actor,reason])).rows[0];
      await this.audit(db,actor,s,"msa_recorded_offline",reason,{msaSigned:false},{evidenceId:evidence.id,msaVersion:doc.version,documentId:doc.id});
      const affected=(await db.query("SELECT id FROM job_submissions WHERE client_id=$1 AND status IN('offer_accepted','contract_sent','contract_signed') ORDER BY id",[s.client_id])).rows;
      for(const row of affected)if(row.id===id)await tryActivateEngagement(db,id,actor);
      // Other engagements are rechecked asynchronously to avoid reversed application-lock ordering.
      await queueHiringLifecycleEvent(db,`offline-msa-recheck:${evidence.id}`,"msa_signed",{clientId:s.client_id});
      await db.query("COMMIT");keep=true;void this.afterCommit?.().catch(()=>{});
      return {id:evidence.id,recorded:true};
    }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}
    finally{db.release();if(!keep)await this.blobs.remove(key).catch(()=>{});}
  }
  async offlinePdf(actor:string,evidenceId:string) {
    const a=(await this.pool.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[actor])).rows[0];
    const e=(await this.pool.query("SELECT * FROM client_msa_offline_evidence WHERE id=$1",[evidenceId])).rows[0];
    if(!e||!a||!((a.role==="admin"&&a.admin_sub_role===null)||(a.role==="client"&&e.client_id===actor)))fail(404,"EVIDENCE_NOT_FOUND","Signed MSA evidence not found.");
    const bytes=await this.blobs.read(e.object_key);
    if(pdfHash(bytes)!==e.sha256)throw new Error("Stored MSA evidence failed integrity validation");
    return {bytes,filename:e.filename};
  }
  async externalReceipt(actor:string,depositId:string) {
    await this.authorize(actor);
    const e=(await this.pool.query("SELECT * FROM external_deposit_payments WHERE deposit_id=$1 AND receipt_object_key IS NOT NULL",[depositId])).rows[0];
    if(!e)fail(404,"RECEIPT_NOT_FOUND","No private external receipt was attached.");
    return {bytes:await this.blobs.read(e.receipt_object_key),contentType:e.receipt_content_type,filename:e.receipt_filename};
  }
}
