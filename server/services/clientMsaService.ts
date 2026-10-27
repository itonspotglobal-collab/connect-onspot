import type { Pool, PoolClient } from "pg";
import { contractBlobProvider, pdfHash, validateContractPdf, type ContractBlobProvider } from "./contractBlobStore";
import { OnboardingError } from "./contractorOnboardingPolicy";
import { queueHiringLifecycleEvent, tryActivateEngagement } from "./hiringLifecycleEvents";

export class ClientMsaService {
  constructor(private pool:Pool,private blobs:ContractBlobProvider=contractBlobProvider,private afterCommit?:()=>Promise<void>) {}
  private async tx<T>(fn:(db:PoolClient)=>Promise<T>) {
    const db=await this.pool.connect();
    try { await db.query("BEGIN");const value=await fn(db);await db.query("COMMIT");return value; }
    catch(e) { await db.query("ROLLBACK").catch(()=>{});throw e; } finally {db.release();}
  }
  private async actor(db:Pick<PoolClient,"query">,id:string,admin=false) {
    const a=(await db.query("SELECT id,role,admin_sub_role,email FROM users WHERE id=$1",[id])).rows[0];
    if(!a || (admin?a.role!=="admin"||a.admin_sub_role!==null:a.role!=="client"))
      throw new OnboardingError(403,"FORBIDDEN",admin?"Only a Super Admin may manage MSA versions.":"A Client account is required.");
    return a;
  }
  async list(id:string) {
    await this.actor(this.pool,id,true);
    return {items:(await this.pool.query(`SELECT id,version,filename,file_size,sha256,effective_at AS "effectiveAt",active,
      activated_at,activation_reason,'/api/client/msa/'||id||'/pdf' AS "viewUrl" FROM msa_documents ORDER BY created_at DESC`)).rows};
  }
  async upload(id:string,file:any,version:unknown,effectiveAt:unknown) {
    await this.actor(this.pool,id,true);
    const v=typeof version==="string"?version.trim():"";
    if(!v||v.length>100||/[\x00-\x1f]/.test(v)||typeof effectiveAt!=="string"||!Number.isFinite(Date.parse(effectiveAt)))
      throw new OnboardingError(422,"MSA_DETAILS_REQUIRED","Enter a unique version and valid effective date.");
    if(!file)throw new OnboardingError(422,"PDF_REQUIRED","Upload the approved MSA PDF.");
    const meta=await validateContractPdf(file);
    let key:string|undefined;
    try {
      key=await this.blobs.save(file.buffer);
      if(pdfHash(await this.blobs.read(key))!==meta.sha256)throw new Error("MSA storage integrity failure");
      const doc=(await this.pool.query(`INSERT INTO msa_documents(version,object_key,filename,file_size,sha256,effective_at,uploaded_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,version,filename,sha256,effective_at AS "effectiveAt",active`,
        [v,key,meta.filename,meta.size,meta.sha256,effectiveAt,id])).rows[0];
      return doc;
    } catch(e:any) {
      if(key)await this.blobs.remove(key).catch(()=>{});
      if(e.code==="23505")throw new OnboardingError(409,"MSA_VERSION_EXISTS","That immutable MSA version already exists.");
      throw e;
    }
  }
  async activate(id:string,documentId:string,input:any) {
    if(input?.reviewed!==true||typeof input.reason!=="string"||!input.reason.trim()||input.reason.length>2000)
      throw new OnboardingError(422,"MSA_REVIEW_REQUIRED","Review the PDF and provide an activation reason.");
    const result=await this.tx(async db=>{
      await this.actor(db,id,true);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('active-msa-version'))");
      const d=(await db.query("SELECT * FROM msa_documents WHERE id=$1 FOR UPDATE",[documentId])).rows[0];
      if(!d)throw new OnboardingError(404,"MSA_NOT_FOUND","MSA document not found.");
      if(new Date(d.effective_at)>new Date())throw new OnboardingError(409,"MSA_NOT_EFFECTIVE","This MSA's effective date has not arrived.");
      if(pdfHash(await this.blobs.read(d.object_key))!==d.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","MSA bytes no longer match the approved hash.");
      if(d.active)return {id:d.id,active:true};
      await db.query("UPDATE msa_documents SET active=false WHERE active");
      await db.query("UPDATE msa_documents SET active=true,activated_by=$2,activated_at=now(),activation_reason=$3 WHERE id=$1",[d.id,id,input.reason.trim()]);
      // Re-evaluate post-payment work; do not rewrite already active engagements.
      const pending=(await db.query(`SELECT e.payload,d.id FROM hiring_lifecycle_events e
        JOIN job_submissions js ON js.id=e.payload->>'submissionId'
        JOIN security_deposits d ON d.id::text=e.payload->>'depositId'
        JOIN contractor_onboarding_cohorts c ON c.submission_id=js.id AND c.workflow_version=2
        WHERE e.event_type='deposit_verified' AND d.status='held'
          AND js.status IN ('offer_accepted','contract_sent','contract_signed')`)).rows;
      for(const p of pending)await queueHiringLifecycleEvent(db,`msa-recheck:${d.id}:${p.id}`,"agreements_recheck",p.payload);
      return {id:d.id,active:true};
    });
    void this.afterCommit?.().catch(()=>{});
    return result;
  }
  async status(id:string) {
    await this.actor(this.pool,id);
    const d=(await this.pool.query("SELECT id,version,sha256,effective_at FROM msa_documents WHERE active AND effective_at<=now()")).rows[0];
    if(!d)return {document:null,signature:null,requiresSignature:true,issued:false};
    const s=(await this.pool.query(`SELECT id,signed_at AS "signedAt",signer_name AS "signerName" FROM client_msa_signatures
      WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3 AND msa_version=$4`,[id,d.id,d.sha256,d.version])).rows[0]??null;
    const issued=!!(await this.pool.query("SELECT 1 FROM client_msa_requests WHERE client_id=$1 AND msa_document_id=$2",[id,d.id])).rows.length;
    return {document:{id:d.id,version:d.version,sha256:d.sha256,effectiveAt:d.effective_at,viewUrl:`/api/client/msa/${d.id}/pdf`},
      signature:s,requiresSignature:!s,issued};
  }
  async pdf(id:string,documentId:string) {
    return this.tx(async db=>{
      const a=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[id])).rows[0];
      const admin=a?.role==="admin"&&a.admin_sub_role===null;
      if(!admin)await this.actor(db,id);
      const d=(await db.query(`SELECT * FROM msa_documents d WHERE id=$1 AND
        ($2::boolean OR EXISTS(SELECT 1 FROM client_msa_requests r WHERE r.msa_document_id=d.id AND r.client_id=$3)
          OR EXISTS(SELECT 1 FROM client_msa_signatures s WHERE s.document_id=d.id AND s.client_id=$3))`,
        [documentId,admin,id])).rows[0];
      if(!d)throw new OnboardingError(404,"MSA_NOT_FOUND","This MSA has not been issued to your account.");
      const bytes=await this.blobs.read(d.object_key);
      if(pdfHash(bytes)!==d.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The stored MSA failed its integrity check.");
      if(!admin)await db.query(`INSERT INTO client_msa_reads(client_id,document_id,document_sha256) VALUES($1,$2,$3)
        ON CONFLICT(client_id,document_id) DO UPDATE SET document_sha256=excluded.document_sha256,read_at=now()`,[id,d.id,d.sha256]);
      return {bytes,filename:d.filename};
    });
  }
  async sign(id:string,input:any,audit:{ip:string,userAgent:string}) {
    const name=typeof input?.signerName==="string"?input.signerName.trim():"";
    if(input?.consent!==true||name.length<3||name.length>200||/[\x00-\x1f]/.test(name))
      throw new OnboardingError(422,"CONSENT_REQUIRED","Review the MSA, tick consent, and enter your full legal name.");
    const result=await this.tx(async db=>{
      const actor=await this.actor(db,id);
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`msa-signature:${id}`]);
      const d=(await db.query("SELECT * FROM msa_documents WHERE active AND effective_at<=now() FOR SHARE")).rows[0];
      if(!d)throw new OnboardingError(409,"ACTIVE_MSA_REQUIRED","OnSpot must upload and activate an approved MSA first.");
      if(input.documentId!==d.id||input.documentSha256!==d.sha256)
        throw new OnboardingError(409,"MSA_VERSION_CHANGED","The current MSA changed. Review the current document before signing.");
      const prior=(await db.query("SELECT * FROM client_msa_signatures WHERE client_id=$1 AND msa_version=$2",[id,d.version])).rows[0];
      if(prior)return {id:prior.id,signedAt:prior.signed_at,alreadySigned:true};
      if(!(await db.query("SELECT 1 FROM client_msa_requests WHERE client_id=$1 AND msa_document_id=$2",[id,d.id])).rows.length)
        throw new OnboardingError(409,"MSA_NOT_ISSUED","The MSA is issued after a deposit is independently verified.");
      if(!(await db.query("SELECT 1 FROM client_msa_reads WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3",[id,d.id,d.sha256])).rows.length)
        throw new OnboardingError(409,"REVIEW_PDF_FIRST","Open and review this exact MSA PDF before signing.");
      if(pdfHash(await this.blobs.read(d.object_key))!==d.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The stored MSA failed its integrity check.");
      const s=(await db.query(`INSERT INTO client_msa_signatures(client_id,msa_version,document_id,document_sha256,
        signer_name,signer_email,ip_address,user_agent,consent_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [id,d.version,d.id,d.sha256,name,actor.email,String(audit.ip).slice(0,100),String(audit.userAgent).slice(0,1000),
          "I have reviewed this exact Master Services Agreement and consent to sign electronically."])).rows[0];
      // Invitation click-through remains independent, in its own preserved fields.
      await db.query(`INSERT INTO client_profiles(id,user_id,msa_accepted_at,msa_version)
        VALUES($1,$2,now(),$3) ON CONFLICT(user_id) DO UPDATE SET msa_accepted_at=now(),msa_version=$3,updated_at=now()`,
        [`msa_${id}`,id,d.version]);
      await queueHiringLifecycleEvent(db,`msa-signed:${s.id}`,"msa_signed",{payerId:id,clientId:id});
      await db.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by,created_at)
        SELECT js.id,js.status,js.status,$2,$1::varchar,clock_timestamp() FROM job_submissions js
        JOIN contractor_onboarding_cohorts c ON c.submission_id=js.id AND c.workflow_version=2
        WHERE js.client_id=$1::varchar AND js.status IN ('offer_accepted','contract_sent','contract_signed')`,
        [id,`Client signed immutable MSA version ${d.version}`]);
      return {id:s.id,signedAt:s.signed_at};
    });
    await this.activateClient(id).catch(()=>console.warn("[onboarding] MSA saved; activation remains queued"));
    void this.afterCommit?.().catch(()=>{});
    return result;
  }
  async activateClient(id:string) {
    const ids=(await this.pool.query(`SELECT js.id FROM job_submissions js
      JOIN contractor_onboarding_cohorts c ON c.submission_id=js.id AND c.workflow_version=2
      WHERE js.client_id=$1 AND js.status IN ('contract_sent','contract_signed') ORDER BY js.id`,[id])).rows;
    for(const s of ids)await this.tx(db=>tryActivateEngagement(db,s.id,id));
  }
}
