import {createHash,randomUUID} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import {z} from "zod";
import {OnboardingError,lockOnboarding} from "./contractorOnboardingPolicy";
import {contractBlobProvider,pdfHash,validateContractPdf,type ContractBlobProvider} from "./contractBlobStore";
import {resolveMergeData,renderContractTemplate,sanitizeTemplateBody} from "./contractMergeService";
import {composeDraft,checkDraftEdits,draftClauses} from "./contractDraftService";
import {renderContractPdf} from "./contractPdfRenderer";
import {verifiedDeferredHiringPayment} from "./hiringPaymentWaiverService";
import {depositArrangement} from "./depositArrangementState";
import {queueHiringLifecycleEvent} from "./hiringLifecycleEvents";
import {businessPartySchema,talentPartySchema,businessPartyColumns,talentPartyColumns} from "../../shared/contractPartyDetails";

const fail=(code:string,status=409)=>new OnboardingError(status,code,code.replace(/_/g," "));
const overrides=z.record(z.string().max(100),z.string().max(20000)).refine(v=>Object.keys(v).length<=100);
const patchSchema=z.object({revision:z.number().int().positive(),fieldOverrides:overrides.optional(),bodyOverrides:overrides.optional(),
  profileChanges:z.object({client:businessPartySchema.optional(),talent:talentPartySchema.omit({taxIdLast4:true}).optional()}).strict().optional()}).strict();
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");

export class ClientMsaAuthoringService {
  constructor(private pool:Pool,private blobs:ContractBlobProvider=contractBlobProvider,private afterCommit?:()=>Promise<void>) {}
  private async tx<T>(fn:(db:PoolClient)=>Promise<T>) {
    const db=await this.pool.connect();
    try {await db.query("BEGIN");const result=await fn(db);await db.query("COMMIT");return result;}
    catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}finally{db.release();}
  }
  private async authorize(db:Pick<PoolClient,"query">,id:string) {
    const actor=(await db.query("SELECT role,admin_sub_role FROM users WHERE id=$1",[id])).rows[0];
    if(actor?.role!=="admin"||actor.admin_sub_role!==null)throw fail("SUPER_ADMIN_REQUIRED",403);
  }
  private async lock(db:PoolClient,actor:string,clientId:string) {
    await this.authorize(db,actor);
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`msa-signature:${clientId}`]);
    if(!(await db.query("SELECT 1 FROM users WHERE id=$1 AND role='client'",[clientId])).rows.length)throw fail("CLIENT_NOT_FOUND",404);
  }
  private async eligible(db:PoolClient,clientId:string,submissionId:string) {
    await lockOnboarding(db,submissionId);
    const submission=(await db.query("SELECT * FROM job_submissions WHERE id=$1 AND client_id=$2",[submissionId,clientId])).rows[0];
    const deposit=(await db.query(`SELECT d.* FROM security_deposits d JOIN offers o ON o.id=d.offer_id
      WHERE d.submission_id=$1 AND o.status IN ('accepted','offer_accepted') ORDER BY d.created_at DESC LIMIT 1`,[submissionId])).rows[0];
    const arrangement=deposit?await depositArrangement(db,submissionId):null;
    if(!submission || !["offer_accepted","contract_sent","contract_signed","hired"].includes(submission.status) || !deposit ||
      (!["held","waived"].includes(deposit.status)&&arrangement?.waiver_type!=="defer") ||
      !await verifiedDeferredHiringPayment(db,submission))throw fail("VERIFIED_ENGAGEMENT_REQUIRED");
    return submission;
  }
  private async load(db:PoolClient,clientId:string) {
    const draft=(await db.query("SELECT * FROM contract_drafts WHERE client_id=$1 AND status<>'retired' FOR UPDATE",[clientId])).rows[0];
    if(!draft)return null;
    const template=(await db.query("SELECT * FROM contract_templates WHERE id=$1",[draft.template_id])).rows[0];
    const fields=(await db.query(`SELECT key,label,source,required,editable_by AS "editableBy"
      FROM contract_template_fields WHERE template_id=$1 ORDER BY key`,[draft.template_id])).rows;
    return {draft,template,fields};
  }
  private view(state:any) {
    const {draft,template,fields}=state;
    const values=Object.fromEntries(Object.entries(draft.field_values).map(([key,value]:any)=>[key,value.value]));
    Object.assign(values,draft.field_overrides);
    let body=composeDraft(template.body,draft.body_overrides);
    const optional=new Set(fields.filter((f:any)=>!f.required&&!String(values[f.key]??"").trim()).map((f:any)=>f.key));
    body=body.replace(/{{\s*([^{}]*?)\s*}}/g,(token,key)=>optional.has(key)?"":token);
    const preview=renderContractTemplate(body,values);
    preview.missingKeys=fields.filter((f:any)=>f.required&&!String(values[f.key]??"").trim()).map((f:any)=>f.key);
    return {draft:{...draft,rendered_document_id:draft.rendered_msa_document_id},fields,
      clauses:draftClauses(template.body),preview,isAdmin:true};
  }
  private async audit(db:PoolClient,clientId:string,draftId:string|null,actor:string,action:string,documentId:string|null=null,key:string|null=null) {
    await db.query(`INSERT INTO client_msa_document_events(client_id,draft_id,actor_id,action,document_id,field_key)
      VALUES($1,$2,$3,$4,$5,$6)`,[clientId,draftId,actor,action,documentId,key]);
  }
  private require(state:any,revision:number) {
    if(!state||state.draft.status!=="draft")throw fail("EDITABLE_DRAFT_REQUIRED");
    if(state.draft.revision!==revision)throw fail("DRAFT_REVISION_CHANGED");
  }
  async list(actor:string) {
    await this.authorize(this.pool,actor);
    const engagements=(await this.pool.query(`SELECT js.id AS "submissionId",js.client_id AS "clientId",j.title AS "jobTitle",
      COALESCE(cp.legal_entity_name,u.company,'Client') AS "clientName"
      FROM job_submissions js JOIN users u ON u.id=js.client_id JOIN jobs j ON j.id=js.job_id
      LEFT JOIN client_profiles cp ON cp.user_id=u.id
      WHERE js.status IN ('offer_accepted','contract_sent','contract_signed','hired')
      AND EXISTS(SELECT 1 FROM security_deposits d WHERE d.submission_id=js.id)
      ORDER BY js.updated_at DESC LIMIT 200`)).rows;
    const documents=(await this.pool.query(`SELECT d.id,d.version,d.filename,d.sha256,d.effective_at AS "effectiveAt",
      c.client_id AS "clientId",c.status,c.template_version AS "templateVersion",c.submission_id AS "submissionId",
      COALESCE(cp.legal_entity_name,u.company,'Client') AS "clientName",
      s.signer_name AS "clientSignerName",s.signed_at AS "clientSignedAt",
      cs.legal_name AS "onspotSignerName",cs.signed_at AS "onspotSignedAt",
      '/api/client/msa/'||d.id||'/pdf' AS "viewUrl"
      FROM client_msa_documents c JOIN msa_documents d ON d.id=c.document_id JOIN users u ON u.id=c.client_id
      LEFT JOIN client_profiles cp ON cp.user_id=u.id
      LEFT JOIN client_msa_signatures s ON s.document_id=d.id AND s.client_id=c.client_id AND s.document_sha256=d.sha256
      LEFT JOIN client_msa_countersignatures cs ON cs.document_id=d.id AND cs.document_sha256=d.sha256
      ORDER BY c.created_at DESC LIMIT 200`)).rows;
    return {engagements,documents,countersignatureBlocksActivation:false};
  }
  async detail(actor:string,clientId:string) {
    return this.tx(async db=>{
      await this.lock(db,actor,clientId);
      const state=await this.load(db,clientId);
      const templates=(await db.query("SELECT id,kind,name,version FROM contract_templates WHERE kind='msa' AND status='active'")).rows;
      return {...(state?this.view(state):{draft:null,fields:[],clauses:[],preview:{html:"",missingKeys:[],unknownKeys:[]},isAdmin:true}),templates};
    });
  }
  async create(actor:string,clientId:string,input:unknown) {
    const body=z.object({templateId:z.string().uuid(),submissionId:z.string().min(1).max(200)}).strict().parse(input);
    return this.tx(async db=>{
      await this.lock(db,actor,clientId);
      await this.eligible(db,clientId,body.submissionId);
      const old=await this.load(db,clientId);
      if(old?.draft.status==="draft")throw fail("LIVE_DRAFT_EXISTS");
      const template=(await db.query("SELECT * FROM contract_templates WHERE id=$1 AND kind='msa' AND status='active' FOR SHARE",[body.templateId])).rows[0];
      if(!template)throw fail("ACTIVE_MSA_TEMPLATE_REQUIRED",422);
      const values=await resolveMergeData({actorId:actor,clientId,msaSubmissionId:body.submissionId},db);
      if(old)await db.query("UPDATE contract_drafts SET status='retired' WHERE id=$1",[old.draft.id]);
      const draft=(await db.query(`INSERT INTO contract_drafts(kind,client_id,msa_submission_id,template_id,template_version,field_values,updated_by)
        VALUES('msa',$1,$2,$3,$4,$5,$6) RETURNING *`,[clientId,body.submissionId,template.id,template.version,JSON.stringify(values),actor])).rows[0];
      await this.audit(db,clientId,draft.id,actor,"draft_generated");
      return this.view((await this.load(db,clientId))!);
    });
  }
  private async invalidate(db:PoolClient,draft:any) {
    await db.query("UPDATE client_msa_documents SET status='superseded' WHERE draft_id=$1 AND status='draft'",[draft.id]);
  }
  async update(actor:string,clientId:string,input:unknown,previewOnly=false) {
    const patch=patchSchema.parse(input);
    return this.tx(async db=>{
      await this.lock(db,actor,clientId);const state=await this.load(db,clientId);this.require(state,patch.revision);
      const field=patch.fieldOverrides??state!.draft.field_overrides;
      const body=patch.bodyOverrides??state!.draft.body_overrides;
      const changed:Record<string,string>=Object.fromEntries(Object.entries(field).filter(([k,v])=>state!.draft.field_overrides[k]!==v)) as any;
      for(const k of Object.keys(state!.draft.field_overrides))if(!(k in field))changed[k]="";
      checkDraftEdits(state!.fields,true,changed,{},state!.template.body);
      const safeBody=checkDraftEdits(state!.fields,true,{},body,state!.template.body);
      if(previewOnly) {
        if(patch.profileChanges)throw fail("PROFILE_SAVE_NOT_PREVIEW",422);
        return this.view({...state,draft:{...state!.draft,field_overrides:field,body_overrides:safeBody}}).preview;
      }
      if(patch.profileChanges) {
        const submission=(await db.query("SELECT talent_id FROM job_submissions WHERE id=$1 AND client_id=$2",[state!.draft.msa_submission_id,clientId])).rows[0];
        for(const party of ["client","talent"] as const) {
          const entries=Object.entries(patch.profileChanges[party]??{}).filter(([,v])=>v!==undefined);
          if(!entries.length)continue;
          const cols:Record<string,string>=party==="client"?businessPartyColumns:talentPartyColumns;
          const table=party==="client"?"client_profiles":"candidates";
          const result=await db.query(`UPDATE ${table} SET ${entries.map(([k],i)=>`${cols[k]}=$${i+1}`).join(",")}
            WHERE user_id=$${entries.length+1} RETURNING user_id`,[...entries.map(([,v])=>v),party==="client"?clientId:submission?.talent_id]);
          if(result.rowCount!==1)throw fail("LINKED_PROFILE_REQUIRED_FOR_SAVE");
          for(const [key] of entries)await this.audit(db,clientId,state!.draft.id,actor,"draft_profile_field_saved",null,`${party}.${key}`);
        }
      }
      await this.invalidate(db,state!.draft);
      await db.query(`UPDATE contract_drafts SET field_overrides=$1,body_overrides=$2,revision=revision+1,
        rendered_msa_document_id=NULL,updated_by=$3,updated_at=now() WHERE id=$4`,
      [JSON.stringify(field),JSON.stringify(safeBody),actor,state!.draft.id]);
      for(const key of Object.keys(changed))await this.audit(db,clientId,state!.draft.id,actor,"draft_field_edited",null,key);
      const bodyKeys=new Set([...Object.keys(safeBody),...Object.keys(state!.draft.body_overrides)]);
      for(const key of Array.from(bodyKeys))if(state!.draft.body_overrides[key]!==safeBody[key])await this.audit(db,clientId,state!.draft.id,actor,"draft_clause_edited",null,key);
      if(!Object.keys(changed).length)await this.audit(db,clientId,state!.draft.id,actor,"draft_saved");
      return this.view((await this.load(db,clientId))!);
    });
  }
  async refresh(actor:string,clientId:string,input?:unknown) {
    const apply=input===undefined?null:z.object({revision:z.number().int(),refreshHash:z.string().length(64)}).strict().parse(input);
    return this.tx(async db=>{
      await this.lock(db,actor,clientId);const state=await this.load(db,clientId);this.require(state,apply?.revision??state?.draft.revision);
      const values=await resolveMergeData({actorId:actor,clientId,msaSubmissionId:state!.draft.msa_submission_id},db);
      const refreshHash=digest(values);
      if(!apply)return {revision:state!.draft.revision,refreshHash,fieldValues:values,changes:state!.fields.filter((f:any)=>state!.draft.field_values[f.key]?.value!==values[f.key]?.value)
        .map((f:any)=>({key:f.key,before:state!.draft.field_values[f.key]?.value??null,after:values[f.key]?.value??null}))};
      if(apply.refreshHash!==refreshHash)throw fail("PROFILES_CHANGED_REVIEW_DIFF_AGAIN");
      await this.invalidate(db,state!.draft);
      await db.query(`UPDATE contract_drafts SET field_values=$1,revision=revision+1,rendered_msa_document_id=NULL,updated_by=$2,updated_at=now() WHERE id=$3`,
        [JSON.stringify(values),actor,state!.draft.id]);
      await this.audit(db,clientId,state!.draft.id,actor,"draft_profiles_refreshed");
      return this.view((await this.load(db,clientId))!);
    });
  }
  async render(actor:string,clientId:string,input:unknown) {
    const {revision}=z.object({revision:z.number().int().positive()}).strict().parse(input);let key:string|undefined;
    try{return await this.tx(async db=>{
      await this.lock(db,actor,clientId);const state=await this.load(db,clientId);this.require(state,revision);
      const view=this.view(state!);
      if(view.preview.missingKeys.length||view.preview.unknownKeys.length)throw fail("REQUIRED_MERGE_FIELDS_MISSING",422);
      const bytes=await renderContractPdf(view.preview.html,"msa",state!.draft.template_version,["client","onspot"]);
      const meta=await validateContractPdf({buffer:bytes,mimetype:"application/pdf",originalname:"OnSpot-MSA.pdf"});
      key=await this.blobs.save(bytes);if(pdfHash(await this.blobs.read(key))!==meta.sha256)throw fail("STORAGE_VERIFICATION_FAILED",502);
      await this.invalidate(db,state!.draft);
      const doc=(await db.query(`INSERT INTO msa_documents(version,object_key,filename,file_size,sha256,effective_at,uploaded_by)
        VALUES($1,$2,'OnSpot-MSA.pdf',$3,$4,now(),$5) RETURNING id,version,sha256,filename`,
      [`client-${randomUUID()}`,key,bytes.length,meta.sha256,actor])).rows[0];
      const values=Object.fromEntries(Object.entries(state!.draft.field_values).map(([k,v]:any)=>[k,v.value]));Object.assign(values,state!.draft.field_overrides);
      await db.query(`INSERT INTO client_msa_documents(document_id,client_id,submission_id,draft_id,template_id,template_version,
        final_field_values,authoring_snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [doc.id,clientId,state!.draft.msa_submission_id,state!.draft.id,state!.draft.template_id,state!.draft.template_version,JSON.stringify(values),
        JSON.stringify({fieldValues:state!.draft.field_values,fieldOverrides:state!.draft.field_overrides,bodyOverrides:state!.draft.body_overrides,revision}),actor]);
      await db.query("UPDATE contract_drafts SET rendered_msa_document_id=$1 WHERE id=$2",[doc.id,state!.draft.id]);
      await this.audit(db,clientId,state!.draft.id,actor,"draft_rendered",doc.id);
      return doc;
    });}catch(error){if(key)await this.blobs.remove(key).catch(()=>{});throw error;}
  }
  async issue(actor:string,clientId:string,input:unknown) {
    const {documentId,reviewed,reason}=z.object({documentId:z.string().uuid(),reviewed:z.literal(true),reason:z.string().trim().min(1).max(2000)}).strict().parse(input);
    const result=await this.tx(async db=>{
      await this.lock(db,actor,clientId);const state=await this.load(db,clientId);
      if(!state||state.draft.status!=="draft"||state.draft.rendered_msa_document_id!==documentId)throw fail("RENDER_CURRENT_MSA_FIRST");
      await this.eligible(db,clientId,state.draft.msa_submission_id);
      const doc=(await db.query(`SELECT d.*,c.status FROM msa_documents d JOIN client_msa_documents c ON c.document_id=d.id
        WHERE d.id=$1 AND c.client_id=$2 FOR UPDATE OF c`,[documentId,clientId])).rows[0];
      if(!doc||doc.status!=="draft"||!reviewed)throw fail("DRAFT_MSA_REQUIRED");
      if(!(await db.query("SELECT 1 FROM msa_document_reviews WHERE document_id=$1 AND user_id=$2 AND sha256=$3",[doc.id,actor,doc.sha256])).rows.length)
        throw fail("REVIEW_PDF_FIRST");
      if(pdfHash(await this.blobs.read(doc.object_key))!==doc.sha256)throw fail("DOCUMENT_CHANGED");
      await db.query("UPDATE client_msa_documents SET status='superseded' WHERE client_id=$1 AND status='issued'",[clientId]);
      await db.query("UPDATE client_msa_documents SET status='issued',issued_at=now(),issue_reason=$2 WHERE document_id=$1",[doc.id,reason]);
      await db.query("UPDATE contract_drafts SET status='sent',updated_by=$2,updated_at=now() WHERE id=$1",[state.draft.id,actor]);
      await db.query("INSERT INTO client_msa_requests(client_id,msa_document_id,submission_id) VALUES($1,$2,$3)",[clientId,doc.id,state.draft.msa_submission_id]);
      await this.audit(db,clientId,state.draft.id,actor,"issued",doc.id);
      await queueHiringLifecycleEvent(db,`msa-required:${clientId}:${doc.id}`,"msa_required",{submissionId:state.draft.msa_submission_id,msaDocumentId:doc.id,payerId:clientId});
      return {id:doc.id,issued:true};
    });
    void this.afterCommit?.().catch(()=>{});return result;
  }
}
