import type { Pool, PoolClient } from "pg";
import { contractBlobProvider, executedContractPdf, pdfHash, validateContractPdf, type ContractBlobProvider } from "./contractBlobStore";
import { OnboardingError } from "./contractorOnboardingPolicy";
import { queueHiringLifecycleEvent, tryActivateEngagement } from "./hiringLifecycleEvents";
import {msaSignatureExists} from "./depositArrangementState";
import {currentClientMsa} from "./currentClientMsa";
import {signatureEvidence,signerProfile} from "./signatureEvidence";

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
      activated_at,activation_reason,'/api/client/msa/'||id||'/pdf' AS "viewUrl" FROM msa_documents d
      WHERE NOT EXISTS(SELECT 1 FROM client_msa_documents c WHERE c.document_id=d.id) ORDER BY created_at DESC`)).rows};
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
      if((await db.query("SELECT 1 FROM client_msa_documents WHERE document_id=$1",[d.id])).rows.length)
        throw new OnboardingError(409,"PERSONALIZED_MSA","Issue personalized MSAs through their Client preparation flow.");
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
        WHERE e.event_type='deposit_verified' AND d.status IN ('held','waived')
          AND js.status IN ('offer_accepted','contract_sent','contract_signed')`)).rows;
      for(const p of pending)await queueHiringLifecycleEvent(db,`msa-recheck:${d.id}:${p.id}`,"agreements_recheck",p.payload);
      return {id:d.id,active:true};
    });
    void this.afterCommit?.().catch(()=>{});
    return result;
  }
  async status(id:string) {
    await this.actor(this.pool,id);
    const profile=await signerProfile(this.pool,id,"client");
    const d=await currentClientMsa(this.pool,id);
    const history=(await this.pool.query(`SELECT d.id,d.version,d.sha256,d.effective_at AS "effectiveAt",
      s.signed_at AS "signedAt",s.signer_name AS "signerName",s.signer_title AS "signerTitle",c.document_id IS NOT NULL AS personalized,
      COALESCE(c.status,CASE WHEN d.active THEN 'active' ELSE 'historical' END) AS status,
      '/api/client/msa/'||d.id||'/pdf' AS "viewUrl",
      CASE WHEN EXISTS(SELECT 1 FROM client_msa_executed_copies ec WHERE ec.document_id=d.id AND ec.client_id=$1)
        THEN '/api/client/msa/'||d.id||'/executed' ELSE NULL END AS "executedUrl" FROM msa_documents d
      LEFT JOIN client_msa_documents c ON c.document_id=d.id
      LEFT JOIN client_msa_signatures s ON s.document_id=d.id AND s.client_id=$1 AND s.document_sha256=d.sha256
      WHERE (c.document_id IS NULL OR (c.client_id=$1 AND c.status IN ('issued','superseded'))) AND ((c.client_id=$1 AND c.status IN ('issued','superseded'))
        OR s.id IS NOT NULL OR EXISTS(SELECT 1 FROM client_msa_requests r WHERE r.msa_document_id=d.id AND r.client_id=$1)
        OR EXISTS(SELECT 1 FROM client_msa_offline_evidence e WHERE e.document_id=d.id AND e.client_id=$1))
      ORDER BY d.created_at DESC LIMIT 100`,[id])).rows;
    if(!d)return {document:null,signature:null,requiresSignature:true,issued:false,history,countersignature:null,countersignatureBlocksActivation:false,personalized:false,signerProfile:profile};
    const s=(await this.pool.query(`SELECT id,signed_at AS "signedAt",signer_name AS "signerName",'platform' AS source,signer_title AS "signerTitle",signature_png IS NOT NULL AS "hasDrawnSignature"
      FROM client_msa_signatures WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3 AND msa_version=$4
      UNION ALL SELECT id,signed_at,signer_name,'offline' AS source,NULL,false FROM client_msa_offline_evidence
      WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3 AND msa_version=$4 LIMIT 1`,[id,d.id,d.sha256,d.version])).rows[0]??null;
    const issued=!!(await this.pool.query("SELECT 1 FROM client_msa_requests WHERE client_id=$1 AND msa_document_id=$2",[id,d.id])).rows.length;
    const countersignature=(await this.pool.query(`SELECT legal_name AS "legalName",signed_at AS "signedAt",signer_title AS "signerTitle",signature_png IS NOT NULL AS "hasDrawnSignature"
      FROM client_msa_countersignatures WHERE document_id=$1 AND document_sha256=$2`,[d.id,d.sha256])).rows[0]??null;
    const personalized=!!(await this.pool.query("SELECT 1 FROM client_msa_documents WHERE document_id=$1 AND client_id=$2",[d.id,id])).rows.length;
    const executed=!!(await this.pool.query("SELECT 1 FROM client_msa_executed_copies WHERE document_id=$1 AND client_id=$2",[d.id,id])).rows.length;
    return {document:{id:d.id,version:d.version,sha256:d.sha256,effectiveAt:d.effective_at,viewUrl:`/api/client/msa/${d.id}/pdf`,executedUrl:executed?`/api/client/msa/${d.id}/executed`:null},
      signature:s,requiresSignature:!s,issued,history,countersignature,personalized,countersignatureBlocksActivation:false,signerProfile:profile};
  }
  async pdf(id:string,documentId:string) {
    return this.tx(async db=>{
      const a=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[id])).rows[0];
      const admin=a?.role==="admin"&&a.admin_sub_role===null;
      if(!admin)await this.actor(db,id);
      const d=(await db.query(`SELECT * FROM msa_documents d WHERE id=$1 AND
        ($2::boolean OR ((NOT EXISTS(SELECT 1 FROM client_msa_documents p WHERE p.document_id=d.id)
              OR EXISTS(SELECT 1 FROM client_msa_documents p WHERE p.document_id=d.id AND p.client_id=$3 AND p.status IN ('issued','superseded')))
          AND (EXISTS(SELECT 1 FROM client_msa_requests r WHERE r.msa_document_id=d.id AND r.client_id=$3)
          OR EXISTS(SELECT 1 FROM client_msa_signatures s WHERE s.document_id=d.id AND s.client_id=$3)
          OR EXISTS(SELECT 1 FROM client_msa_offline_evidence e WHERE e.document_id=d.id AND e.client_id=$3))))`,
        [documentId,admin,id])).rows[0];
      if(!d)throw new OnboardingError(404,"MSA_NOT_FOUND","This MSA has not been issued to your account.");
      const bytes=await this.blobs.read(d.object_key);
      if(pdfHash(bytes)!==d.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The stored MSA failed its integrity check.");
      if(!admin)await db.query(`INSERT INTO client_msa_reads(client_id,document_id,document_sha256) VALUES($1,$2,$3)
        ON CONFLICT(client_id,document_id) DO UPDATE SET document_sha256=excluded.document_sha256,read_at=now()`,[id,d.id,d.sha256]);
      else await db.query(`INSERT INTO msa_document_reviews(document_id,user_id,sha256) VALUES($1,$2,$3)
        ON CONFLICT(document_id,user_id) DO UPDATE SET sha256=excluded.sha256,reviewed_at=now()`,[d.id,id,d.sha256]);
      return {bytes,filename:d.filename};
    });
  }
  async sign(id:string,input:any,audit:{ip:string,userAgent:string}) {
    const name=typeof input?.signerName==="string"?input.signerName.trim():"";
    if(input?.consent!==true||name.length<3||name.length>200||/[\x00-\x1f]/.test(name))
      throw new OnboardingError(422,"CONSENT_REQUIRED","Review the MSA, tick consent, and enter your full legal name.");
    const result=await this.tx(async db=>{
      const actor=await this.actor(db,id);
      const evidence=await signatureEvidence(input);
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`msa-signature:${id}`]);
      const d=await currentClientMsa(db,id);
      if(!d)throw new OnboardingError(409,"ACTIVE_MSA_REQUIRED","OnSpot must upload and activate an approved MSA first.");
      if(input.documentId!==d.id||input.documentSha256!==d.sha256)
        throw new OnboardingError(409,"MSA_VERSION_CHANGED","The current MSA changed. Review the current document before signing.");
      const prior=(await db.query("SELECT * FROM client_msa_signatures WHERE client_id=$1 AND msa_version=$2 AND document_id=$3 AND document_sha256=$4",[id,d.version,d.id,d.sha256])).rows[0];
      if(prior)return {id:prior.id,signedAt:prior.signed_at,alreadySigned:true};
      if(!(await db.query("SELECT 1 FROM client_msa_requests WHERE client_id=$1 AND msa_document_id=$2",[id,d.id])).rows.length)
        throw new OnboardingError(409,"MSA_NOT_ISSUED","The MSA is issued after a deposit is independently verified.");
      if(!(await db.query("SELECT 1 FROM client_msa_reads WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3",[id,d.id,d.sha256])).rows.length)
        throw new OnboardingError(409,"REVIEW_PDF_FIRST","Open and review this exact MSA PDF before signing.");
      if(pdfHash(await this.blobs.read(d.object_key))!==d.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The stored MSA failed its integrity check.");
      const s=(await db.query(`INSERT INTO client_msa_signatures(client_id,msa_version,document_id,document_sha256,
        signer_name,signer_email,ip_address,user_agent,consent_text,signer_title,signature_png) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [id,d.version,d.id,d.sha256,name,actor.email,String(audit.ip).slice(0,100),String(audit.userAgent).slice(0,1000),
          "I have reviewed this exact Master Services Agreement and consent to sign electronically.",evidence.title,evidence.png])).rows[0];
      // Invitation click-through remains independent, in its own preserved fields.
      await db.query(`INSERT INTO client_profiles(id,user_id,msa_accepted_at,msa_version)
        VALUES($1,$2,now(),$3) ON CONFLICT(user_id) DO UPDATE SET msa_accepted_at=now(),msa_version=$3,updated_at=now()`,
        [`msa_${id}`,id,d.version]);
      await queueHiringLifecycleEvent(db,`msa-signed:${s.id}`,"msa_signed",{payerId:id,clientId:id});
      const personal=(await db.query("SELECT submission_id,draft_id FROM client_msa_documents WHERE document_id=$1 AND client_id=$2",[d.id,id])).rows[0];
      if(personal) {
        await db.query(`INSERT INTO client_msa_document_events(client_id,document_id,draft_id,actor_id,action)
          VALUES($1,$2,$3,$1,'client_signed')`,[id,d.id,personal.draft_id]);
        await queueHiringLifecycleEvent(db,`msa-countersign-required:${d.id}`,"msa_countersign_required",
          {submissionId:personal.submission_id,msaDocumentId:d.id,clientId:id,payerId:id});
      }
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
  async countersign(id:string,documentId:string,input:any,audit:{ip:string,userAgent:string}) {
    const name=typeof input?.legalName==="string"?input.legalName.trim():"";
    if(input?.consent!==true||name.length<3||name.length>200||/[\x00-\x1f]/.test(name))
      throw new OnboardingError(422,"CONSENT_REQUIRED","Review the MSA, enter your full legal name, and confirm consent.");
    let executedKey:string|undefined;
    let result:any;
    try {result=await this.tx(async db=>{
      await this.actor(db,id,true);
      const evidence=await signatureEvidence(input);
      const identity=(await db.query("SELECT client_id FROM client_msa_documents WHERE document_id=$1",[documentId])).rows[0];
      if(!identity)throw new OnboardingError(404,"MSA_NOT_FOUND","Personalized MSA not found.");
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`msa-signature:${identity.client_id}`]);
      const doc=(await db.query(`SELECT d.*,c.draft_id,c.status,c.submission_id FROM msa_documents d JOIN client_msa_documents c ON c.document_id=d.id WHERE d.id=$1 FOR UPDATE OF c`,[documentId])).rows[0];
      if(doc.status!=="issued"||doc.sha256!==input.documentSha256)throw new OnboardingError(409,"MSA_VERSION_CHANGED","Review the current issued MSA.");
      if(!(await db.query("SELECT 1 FROM client_msa_signatures WHERE document_id=$1 AND client_id=$2 AND document_sha256=$3 AND msa_version=$4",
        [doc.id,identity.client_id,doc.sha256,doc.version])).rows.length)throw new OnboardingError(409,"CLIENT_SIGNATURE_REQUIRED","The Client must sign this exact MSA first.");
      const prior=(await db.query("SELECT * FROM client_msa_countersignatures WHERE document_id=$1",[doc.id])).rows[0];
      if(prior&&(await db.query("SELECT 1 FROM client_msa_executed_copies WHERE document_id=$1 AND client_id=$2",[doc.id,identity.client_id])).rows.length)
        return {id:prior.id,legalName:prior.legal_name,signedAt:prior.signed_at,alreadySigned:true,countersignatureBlocksActivation:false};
      if(!(await db.query("SELECT 1 FROM msa_document_reviews WHERE document_id=$1 AND user_id=$2 AND sha256=$3",[doc.id,id,doc.sha256])).rows.length)
        throw new OnboardingError(409,"REVIEW_PDF_FIRST","Open and review this exact MSA before countersigning.");
      if(pdfHash(await this.blobs.read(doc.object_key))!==doc.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The stored MSA failed its integrity check.");
      const signature=prior??(await db.query(`INSERT INTO client_msa_countersignatures(document_id,document_sha256,signer_user_id,legal_name,consent_text,ip_address,user_agent,signer_title,signature_png)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [doc.id,doc.sha256,id,name,"I have reviewed this exact MSA and consent to countersign electronically on behalf of OnSpot.",String(audit.ip).slice(0,100),String(audit.userAgent).slice(0,1000),evidence.title,evidence.png])).rows[0];
      const clientSignature=(await db.query(`SELECT *,client_id AS signer_user_id,signer_name AS legal_name,'client' AS signer_role
        FROM client_msa_signatures WHERE client_id=$1 AND document_id=$2 AND document_sha256=$3`,[identity.client_id,doc.id,doc.sha256])).rows[0];
      const personal=(await db.query("SELECT template_id FROM client_msa_documents WHERE document_id=$1",[doc.id])).rows[0];
      const original=await this.blobs.read(doc.object_key);
      if(pdfHash(original)!==doc.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The stored MSA failed its integrity check.");
      const executed=await executedContractPdf(original,{...doc,version:doc.version,template_id:personal.template_id},[clientSignature,signature]);
      executedKey=await this.blobs.save(executed);
      const hash=pdfHash(executed);
      if(pdfHash(await this.blobs.read(executedKey))!==hash)throw new OnboardingError(502,"EXECUTED_COPY_FAILED","The executed copy could not be verified.");
      await db.query(`INSERT INTO client_msa_executed_copies(document_id,client_id,client_signature_id,onspot_signature_id,object_key,sha256)
        VALUES($1,$2,$3,$4,$5,$6)`,[doc.id,identity.client_id,clientSignature.id,signature.id,executedKey,hash]);
      if(!prior)await db.query(`INSERT INTO client_msa_document_events(client_id,document_id,draft_id,actor_id,action)
        VALUES($1,$2,$3,$4,'onspot_signed')`,[identity.client_id,doc.id,doc.draft_id,id]);
      await queueHiringLifecycleEvent(db,`msa-countersigned:${doc.id}`,"msa_countersigned",
        {submissionId:doc.submission_id,msaDocumentId:doc.id,clientId:identity.client_id,payerId:identity.client_id});
      return {id:signature.id,legalName:signature.legal_name,signedAt:signature.signed_at,alreadySigned:!!prior,countersignatureBlocksActivation:false};
    });}catch(error){if(executedKey)await this.blobs.remove(executedKey).catch(()=>{});throw error;}
    void this.afterCommit?.().catch(()=>{});return result;
  }
  async executedPdf(id:string,documentId:string) {
    return this.tx(async db=>{
      const actor=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[id])).rows[0];
      const admin=actor?.role==="admin"&&actor.admin_sub_role===null;
      if(!admin&&actor?.role!=="client")throw new OnboardingError(403,"FORBIDDEN","Client or Super Admin access required.");
      const copy=(await db.query(`SELECT ec.object_key,ec.sha256,d.filename FROM client_msa_executed_copies ec
        JOIN msa_documents d ON d.id=ec.document_id WHERE ec.document_id=$1 AND ($2::boolean OR ec.client_id=$3)`,[documentId,admin,id])).rows[0];
      if(!copy)throw new OnboardingError(404,"EXECUTED_MSA_NOT_FOUND","An executed MSA is not available to your account.");
      const bytes=await this.blobs.read(copy.object_key);
      if(pdfHash(bytes)!==copy.sha256)throw new OnboardingError(409,"DOCUMENT_CHANGED","The executed MSA failed its integrity check.");
      return {bytes,filename:copy.filename.replace(/\.pdf$/i,"")+"-executed.pdf"};
    });
  }
}
