import { createHash } from "node:crypto";
import { parseDocument, DomUtils } from "htmlparser2";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../db";
import { contractAuthority, recordContractEvent } from "./contractDocumentService";
import { ContractError } from "./hiringContractService";
import { lockOnboarding } from "./contractorOnboardingPolicy";
import { resolveMergeData, renderContractTemplate, sanitizeTemplateBody, templateMergeKeys } from "./contractMergeService";
import { renderContractPdf } from "./contractPdfRenderer";
import { contractBlobProvider, pdfHash, validateContractPdf, type ContractBlobProvider } from "./contractBlobStore";
import { contractMergeFields } from "../../shared/contractTemplates";
import { businessPartySchema,talentPartySchema,businessPartyColumns,talentPartyColumns } from "../../shared/contractPartyDetails";

const fail = (error:string,status=409) => new ContractError(status,{error,message:error.replace(/_/g," ")});
const maps = z.record(z.string().max(100), z.string().max(20000)).refine(m=>Object.keys(m).length<=100);
const profileChangesSchema=z.object({
  client:businessPartySchema.optional(),
  talent:talentPartySchema.omit({taxIdLast4:true}).optional(),
}).strict();
const edit = z.object({revision:z.number().int().positive(),fieldOverrides:maps.optional(),bodyOverrides:maps.optional(),
  profileChanges:profileChangesSchema.optional()}).strict();
const hash = (data:unknown)=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
export function draftClauses(body:string) {
  const nodes = parseDocument(body).children.filter((n:any)=>n.type !== "text" || n.data.trim());
  return nodes.map((node,index)=>({id:`clause-${index+1}`,html:DomUtils.getOuterHTML(node)}));
}
export function composeDraft(body:string,overrides:Record<string,string>) {
  const list=draftClauses(body);
  if(Object.keys(overrides).some(key=>!list.some(clause=>clause.id===key)))throw fail("unknown_clause",422);
  return list.map(c=>overrides[c.id] ?? c.html).join("\n");
}
export function checkDraftEdits(fields:any[],admin:boolean,fieldOverrides:Record<string,string>,bodyOverrides:Record<string,string>,body:string) {
  for(const key of Object.keys(fieldOverrides)) {
    const f=fields.find(f=>f.key===key);
    // Canonical registry restrictions are a floor, even if a template rule is loosened.
    const canonical=contractMergeFields.find(f=>f.key===key);
    if(!f || !canonical || f.editableBy==="none" || canonical.editableBy==="none" ||
      (!admin && (f.editableBy!=="preparer" || canonical.editableBy!=="preparer")))throw fail("field_not_editable",403);
  }
  if(!admin && Object.keys(bodyOverrides).length)throw fail("admin_clause_edit_required",403);
  const safe = Object.fromEntries(Object.entries(bodyOverrides).map(([key,value])=>[key,sanitizeTemplateBody(value)]));
  const combined=composeDraft(body,safe);
  // Clause edits may not remove required merge tokens or introduce unregistered fields.
  const keys=templateMergeKeys(combined);
  if(keys.some(key=>!fields.some(f=>f.key===key)) ||
    fields.some(f=>f.required && !keys.includes(f.key)))throw fail("clause_merge_fields_changed",422);
  return safe;
}
export class ContractDraftService {
  constructor(private db:Pool=pool,private blobs:ContractBlobProvider=contractBlobProvider) {}
  private async transaction<T>(fn:(tx:PoolClient)=>Promise<T>) {
    const tx=await this.db.connect();
    try {await tx.query("BEGIN");const value=await fn(tx);await tx.query("COMMIT");return value;}
    catch(error){await tx.query("ROLLBACK");throw error;}finally{tx.release();}
  }
  private async context(tx:PoolClient,id:string,actorId:string,editing=true) {
    const identity=(await tx.query("SELECT submission_id FROM hiring_contracts WHERE id=$1",[id])).rows[0];
    if(!identity)throw fail("contract_not_found",404);
    await lockOnboarding(tx,identity.submission_id);
    const row=(await tx.query(`SELECT hc.*,js.client_id,js.talent_id,js.status AS submission_status
      FROM hiring_contracts hc JOIN job_submissions js ON js.id=hc.submission_id WHERE hc.id=$1 FOR UPDATE OF hc,js`,[id])).rows[0];
    const permissions=await contractAuthority(tx,row,{id:actorId});
    if(editing && (!permissions.canPrepare || !row.document_managed ||
      !["offer_accepted","contract_sent"].includes(row.submission_status)))throw fail("draft_preparer_required",403);
    if(!editing && !permissions.canManage)throw fail("draft_preparer_required",403);
    const admin=(await tx.query("SELECT role FROM users WHERE id=$1",[actorId])).rows[0]?.role==="admin";
    return {row,permissions,admin};
  }
  private async load(tx:PoolClient,id:string) {
    const draft=(await tx.query("SELECT * FROM contract_drafts WHERE hiring_contract_id=$1 AND status<>'retired' FOR UPDATE",[id])).rows[0];
    if(!draft)return null;
    const template=(await tx.query("SELECT * FROM contract_templates WHERE id=$1",[draft.template_id])).rows[0];
    const fields=(await tx.query(`SELECT key,label,source,required,editable_by AS "editableBy" FROM contract_template_fields WHERE template_id=$1 ORDER BY key`,[draft.template_id])).rows;
    return {draft,template,fields};
  }
  private view(state:any,admin:boolean) {
    const {draft,template,fields}=state;
    const values=Object.fromEntries(Object.entries(draft.field_values).map(([key,value]:any)=>[key,value.value]));
    Object.assign(values,draft.field_overrides);
    let body=composeDraft(template.body,draft.body_overrides);
    const optionalMissing=new Set(fields.filter((f:any)=>!f.required&&!String(values[f.key]??"").trim()).map((f:any)=>f.key));
    body=body.replace(/{{\s*([^{}]*?)\s*}}/g,(token,key)=>optionalMissing.has(key)?"":token);
    const preview=renderContractTemplate(body,values);
    preview.missingKeys=fields.filter((f:any)=>f.required && !String(values[f.key]??"").trim()).map((f:any)=>f.key);
    return {draft,fields,clauses:draftClauses(template.body),preview,isAdmin:admin};
  }
  async detail(id:string,actorId:string) {
    return this.transaction(async tx=>{
      const {admin}=await this.context(tx,id,actorId,false);
      const state=await this.load(tx,id);
      const templates=(await tx.query("SELECT id,kind,name,version FROM contract_templates WHERE status='active' AND kind IN ('talent_agreement','sow') ORDER BY kind,name")).rows;
      return {...(state?this.view(state,admin):{draft:null,fields:[],clauses:[],preview:{html:"",missingKeys:[],unknownKeys:[]},isAdmin:admin}),templates};
    });
  }
  async create(id:string,actorId:string,input:unknown) {
    const {templateId}=z.object({templateId:z.string().uuid()}).strict().parse(input);
    return this.transaction(async tx=>{
      const {admin}=await this.context(tx,id,actorId);
      if(await this.load(tx,id))throw fail("live_draft_exists");
      const previous=(await tx.query("SELECT status FROM contract_documents WHERE hiring_contract_id=$1 ORDER BY version DESC LIMIT 1",[id])).rows[0];
      if(previous && !["draft","voided","superseded"].includes(previous.status))throw fail("document_immutable");
      const template=(await tx.query("SELECT * FROM contract_templates WHERE id=$1 AND status='active' AND kind IN ('talent_agreement','sow') FOR SHARE",[templateId])).rows[0];
      if(!template)throw fail("active_hiring_template_required",422);
      const fieldValues=await resolveMergeData({actorId,hiringContractId:id},tx);
      const draft=(await tx.query(`INSERT INTO contract_drafts(kind,hiring_contract_id,template_id,template_version,field_values,updated_by)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[template.kind,id,templateId,template.version,JSON.stringify(fieldValues),actorId])).rows[0];
      await this.invalidate(tx,id);
      await recordContractEvent(tx,id,null,actorId,"draft_generated");
      return this.view((await this.load(tx,id))!,admin);
    });
  }
  private async invalidate(tx:PoolClient,id:string) {
    await tx.query("UPDATE contract_documents SET status='superseded' WHERE hiring_contract_id=$1 AND status='draft'",[id]);
    await tx.query("UPDATE hiring_contracts SET document_path=NULL,updated_at=NOW() WHERE id=$1",[id]);
  }
  private requireState(state:any,revision:number) {
    if(!state || state.draft.status!=="draft")throw fail("editable_draft_required");
    if(state.draft.revision!==revision)throw fail("draft_revision_changed");
  }
  async update(id:string,actorId:string,input:unknown,previewOnly=false) {
    const patch=edit.parse(input);
    return this.transaction(async tx=>{
      const {admin,row}=await this.context(tx,id,actorId),state=await this.load(tx,id);
      this.requireState(state,patch.revision);
      const fieldOverrides=patch.fieldOverrides??state!.draft.field_overrides;
      const bodyOverrides=patch.bodyOverrides??state!.draft.body_overrides;
      // Only changed entries require edit authority. Clients can retain Admin overrides.
      const changedFields:Record<string,string>=Object.fromEntries(Object.entries(fieldOverrides).filter(([key,value])=>state!.draft.field_overrides[key]!==value)) as Record<string,string>;
      for(const key of Object.keys(state!.draft.field_overrides))if(!(key in fieldOverrides))changedFields[key]="";
      const changedBody=Object.fromEntries(Object.entries(bodyOverrides).filter(([key,value])=>state!.draft.body_overrides[key]!==value));
      for(const key of Object.keys(state!.draft.body_overrides))if(!(key in bodyOverrides))changedBody[key]="";
      checkDraftEdits(state!.fields,admin,changedFields,{},state!.template.body);
      if(!admin && Object.keys(changedBody).length)throw fail("admin_clause_edit_required",403);
      const safeBody=Object.fromEntries(Object.entries(bodyOverrides).map(([key,value])=>[key,sanitizeTemplateBody(String(value))]));
      // Validate final body too; permissions were checked on changed entries.
      checkDraftEdits(state!.fields,true,{},safeBody,state!.template.body);
      if(patch.profileChanges && (!admin || previewOnly))throw fail("admin_profile_save_required",403);
      if(!previewOnly) {
        if(patch.profileChanges) {
          for(const party of ["client","talent"] as const) {
            const changes=patch.profileChanges[party];
            if(!changes || !Object.keys(changes).length)continue;
            const columns:Record<string,string>=party==="client"?businessPartyColumns:talentPartyColumns;
            const entries=Object.entries(changes).filter(([,v])=>v!==undefined);
            if(!entries.length)continue;
            const table=party==="talent"?"candidates":row.party_type==="organization"?"organizations":"client_profiles";
            const target=table==="organizations"?row.organization_id:party==="talent"?row.talent_id:row.client_id;
            // Existing structured profile only; never infer an address by splitting one-line text.
            const result=await tx.query(`UPDATE ${table} SET ${entries.map(([k],i)=>`${columns[k]}=$${i+1}`).join(",")}
              WHERE ${table==="organizations"?"id":"user_id"}=$${entries.length+1} RETURNING ${table==="client_profiles"?"user_id":"id"}`,
              [...entries.map(([,v])=>v),target]);
            if(result.rowCount!==1)throw fail("linked_profile_required_for_save");
            for(const [key] of entries)await recordContractEvent(tx,id,null,actorId,"draft_profile_field_saved",`${party}.${key}`);
          }
        }
        await tx.query(`UPDATE contract_drafts SET field_overrides=$1,body_overrides=$2,revision=revision+1,
          rendered_document_id=NULL,updated_by=$3,updated_at=NOW() WHERE id=$4`,
        [JSON.stringify(fieldOverrides),JSON.stringify(safeBody),actorId,state!.draft.id]);
        await this.invalidate(tx,id);
        for(const key of Object.keys(changedFields))await recordContractEvent(tx,id,null,actorId,"draft_field_edited",key);
        for(const key of Object.keys(changedBody))await recordContractEvent(tx,id,null,actorId,"draft_clause_edited",key);
        if(!Object.keys(changedFields).length&&!Object.keys(changedBody).length)await recordContractEvent(tx,id,null,actorId,"draft_field_edited");
        return this.view((await this.load(tx,id))!,admin);
      }
      return this.view({...state,draft:{...state!.draft,field_overrides:fieldOverrides,body_overrides:safeBody}},admin);
    });
  }
  async refresh(id:string,actorId:string,input?:unknown) {
    const apply=input!==undefined ? z.object({revision:z.number().int(),refreshHash:z.string().length(64)}).strict().parse(input):null;
    return this.transaction(async tx=>{
      const {admin}=await this.context(tx,id,actorId),state=await this.load(tx,id);
      this.requireState(state,apply?.revision??state?.draft.revision);
      const next=await resolveMergeData({actorId,hiringContractId:id},tx);
      const refreshHash=hash(next);
      const changes=state!.fields.filter((f:any)=>state!.draft.field_values[f.key]?.value!==next[f.key]?.value)
        .map((f:any)=>({key:f.key,before:state!.draft.field_values[f.key]?.value??null,after:next[f.key]?.value??null}));
      if(!apply)return {revision:state!.draft.revision,changes,fieldValues:next,refreshHash};
      if(refreshHash!==apply.refreshHash)throw fail("profiles_changed_review_diff_again");
      await tx.query(`UPDATE contract_drafts SET field_values=$1,revision=revision+1,rendered_document_id=NULL,
        updated_by=$2,updated_at=NOW() WHERE id=$3`,[JSON.stringify(next),actorId,state!.draft.id]);
      await this.invalidate(tx,id);
      await recordContractEvent(tx,id,null,actorId,"draft_profiles_refreshed");
      return this.view((await this.load(tx,id))!,admin);
    });
  }
  async render(id:string,actorId:string,input:unknown) {
    const {revision}=z.object({revision:z.number().int().positive()}).strict().parse(input);
    let key:string|undefined;
    try{return await this.transaction(async tx=>{
      const {row,admin}=await this.context(tx,id,actorId),state=await this.load(tx,id);
      this.requireState(state,revision);
      const view=this.view(state!,admin);
      if(view.preview.missingKeys.length||view.preview.unknownKeys.length)throw fail("required_merge_fields_missing",422);
      const roles=row.party_type==="onspot"?["talent","onspot"]:["talent",row.party_type,"onspot"];
      const bytes=await renderContractPdf(view.preview.html,state!.draft.kind,state!.draft.template_version,roles);
      const validation=await validateContractPdf({buffer:bytes,mimetype:"application/pdf",originalname:"agreement.pdf"});
      key=await this.blobs.save(bytes);
      if(pdfHash(await this.blobs.read(key))!==validation.sha256)throw fail("upload_verification_failed",502);
      await this.invalidate(tx,id);
      const version=Number((await tx.query("SELECT COALESCE(max(version),0)+1 AS next FROM contract_documents WHERE hiring_contract_id=$1",[id])).rows[0].next);
      const values=Object.fromEntries(Object.entries(state!.draft.field_values).map(([k,v]:any)=>[k,v.value]));
      Object.assign(values,state!.draft.field_overrides);
      const snapshot={fieldValues:state!.draft.field_values,fieldOverrides:state!.draft.field_overrides,bodyOverrides:state!.draft.body_overrides,revision};
      const document=(await tx.query(`INSERT INTO contract_documents(hiring_contract_id,object_key,original_filename,mime_type,
        file_size,sha256,version,uploaded_by,template_id,template_version,final_field_values,authoring_snapshot)
        VALUES($1,$2,'agreement.pdf','application/pdf',$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id,version,sha256,status,original_filename,file_size`,
        [id,key,bytes.length,validation.sha256,version,actorId,state!.draft.template_id,state!.draft.template_version,JSON.stringify(values),JSON.stringify(snapshot)])).rows[0];
      await tx.query("UPDATE hiring_contracts SET document_path=$1,document_version=$2,updated_at=NOW() WHERE id=$3",[key,version,id]);
      await tx.query("UPDATE contract_drafts SET rendered_document_id=$1 WHERE id=$2",[document.id,state!.draft.id]);
      await recordContractEvent(tx,id,document.id,actorId,"draft_rendered");
      return document;
    });}catch(error){if(key)await this.blobs.remove(key).catch(()=>{});throw error;}
  }
  async revise(id:string,actorId:string,input:unknown,requestChanges=false) {
    const {reason}=z.object({reason:z.string().trim().min(1).max(2000)}).strict().parse(input);
    return this.transaction(async tx=>{
      // Talent can request changes to sent versions, never read reopened drafts.
      const identity=(await tx.query("SELECT submission_id FROM hiring_contracts WHERE id=$1",[id])).rows[0];
      if(!identity)throw fail("contract_not_found",404);
      await lockOnboarding(tx,identity.submission_id);
      const row=(await tx.query(`SELECT hc.*,js.client_id,js.talent_id,js.status AS submission_status FROM hiring_contracts hc
        JOIN job_submissions js ON js.id=hc.submission_id WHERE hc.id=$1 FOR UPDATE OF hc,js`,[id])).rows[0];
      const permissions=await contractAuthority(tx,row,{id:actorId});
      if(row.status!=="sent" || row.submission_status!=="contract_sent" ||
        !(requestChanges?!!permissions.signerRole:permissions.canManage))throw fail("sent_contract_revision_required",403);
      const document=(await tx.query("SELECT * FROM contract_documents WHERE hiring_contract_id=$1 AND status<>'superseded' ORDER BY version DESC LIMIT 1",[id])).rows[0];
      if(!document || document.status==="executed")throw fail("sent_contract_revision_required");
      await tx.query("UPDATE contract_documents SET status='voided' WHERE id=$1",[document.id]);
      await tx.query("UPDATE hiring_contracts SET status='draft',document_path=NULL,updated_at=NOW() WHERE id=$1",[id]);
      await tx.query("UPDATE job_submissions SET status='offer_accepted',updated_at=NOW() WHERE id=$1",[row.submission_id]);
      await tx.query(`INSERT INTO job_application_status_history(application_id,previous_status,new_status,note,changed_by)
        VALUES($1,'contract_sent','offer_accepted',$2,$3)`,[row.submission_id,`Contract revision requested: ${reason}`,actorId]);
      await tx.query("UPDATE contract_drafts SET status='draft',revision=revision+1,rendered_document_id=NULL,updated_by=$1,updated_at=NOW() WHERE hiring_contract_id=$2 AND status='sent'",[actorId,id]);
      await recordContractEvent(tx,id,document.id,actorId,"voided");
      await recordContractEvent(tx,id,document.id,actorId,requestChanges?"changes_requested":"revision_opened");
      // Preserve signatures on old voided document; new document has a new ID/hash and no signatures.
      return {id};
    });
  }
}
