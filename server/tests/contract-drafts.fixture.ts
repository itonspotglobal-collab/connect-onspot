/** Owned PostgreSQL and real services; synthetic identities, in-memory blob transport.
 * No real sessions, email, storage, funds, shared development or production DB. */
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { pool, query } from "./fixtures/hiring-db";
import { ContractDraftService } from "../services/contractDraftService";
import { ContractTemplateService } from "../services/contractTemplateService";
import * as docs from "../services/contractDocumentService";
import { contractMergeFields } from "../../shared/contractTemplates";
import { pdfHash, type ContractBlobProvider } from "../services/contractBlobStore";

const suffix=randomUUID(), admin=`draft-admin-${suffix}`,client=`draft-client-${suffix}`,talent=`draft-talent-${suffix}`,other=`draft-other-${suffix}`;
const job=`draft-job-${suffix}`;
const files=new Map<string,Buffer>();
const blobs:ContractBlobProvider={
  async save(bytes){const id=randomUUID();files.set(id,bytes);return id;},
  async read(id){if(!files.has(id))throw new Error("Missing fixture blob");return files.get(id)!;},
  async remove(id){files.delete(id);},
};
const service=new ContractDraftService(pool,blobs);
const templates=new ContractTemplateService(pool);
let templateId:string;
const html=`<h1>Hiring agreement</h1><table><tr><th>Client</th><td>{{client.legalEntityName}}</td></tr>
  <tr><th>Rate</th><td>{{offer.rate}}</td></tr></table>
  <p>{{talent.legalFullName}}</p><p>{{talent.address}}</p><p>{{contract.paymentTerms}}</p><p>{{onspot.entityName}}</p>`;
before(async()=>{
  for(const [id,role]of [[admin,"admin"],[client,"client"],[talent,"talent"],[other,"client"]])
    await query("INSERT INTO users(id,email,role,password_hash,first_name,last_name) VALUES($1,$2,$3,'not-a-login-hash','Test','Person')",[id,`${id}@example.test`,role]);
  await query(`INSERT INTO client_profiles(user_id,legal_entity_name,address_line1) VALUES($1,'Example LLC','Example client street')`,[client]);
  await query(`INSERT INTO candidates(id,user_id,email,legal_full_name,address_line1) VALUES($1,$2,$3,'Talent <&>','Example talent street')`,
    [`candidate-${suffix}`,talent,`${talent}@example.test`]);
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Draft fixture job','Example job','Operations','Intermediate','open','approved','Standard','tracked')`,[job,client]);
  const t=await templates.create(admin,{kind:"talent_agreement",name:"Fixture agreement",version:suffix,body:html});
  templateId=t.id;
  const detail=await templates.detail(admin,templateId);
  await templates.activate(admin,templateId,{reviewed:true,reason:"Owned fixture approval",reviewHash:detail.reviewHash});
});
after(async()=>{await pool.end();});
async function prepare(partyType="client") {
  const submission=(await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,workflow_type,initiated_by,registration_status,status)
    VALUES($1,$2,$3,$4,'Synthetic Talent','application','talent','linked','offer_accepted') RETURNING id`,
    [job,client,talent,`${talent}@example.test`])).rows[0].id;
  const offer=(await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2032-10-01') RETURNING id`,[submission])).rows[0].id;
  const c=await docs.prepareContract({id:admin},{offerId:offer,partyType});
  await service.create(c.id,admin,{templateId});
  return {id:c.id,submission,offer};
}
async function complete(id:string) {
  const state=await service.detail(id,admin);
  return service.update(id,admin,{revision:state.draft.revision,fieldOverrides:{"contract.paymentTerms":"Approved fixture terms"}});
}
async function reviewAndSend(id:string) {
  await docs.contractPdf(id,{id:admin},false,blobs);
  await docs.sendContract(id,{id:admin},blobs);
}
test("0062 is idempotent and preserves existing deposits",async()=>{
  const before=(await query("SELECT id,amount,status FROM security_deposits ORDER BY id")).rows;
  const sql=await readFile("migrations/0062_contract_drafts.sql","utf8");
  await query(sql);await query(sql);
  assert.deepEqual((await query("SELECT id,amount,status FROM security_deposits ORDER BY id")).rows,before);
});
test("drafts resolve authorized private data; Talent and unrelated Clients cannot read or edit",async()=>{
  const c=await prepare();
  const state=await service.detail(c.id,admin);
  assert.equal(state.draft.field_values["talent.legalFullName"].value,"Talent <&>");
  assert.match(state.preview.html,/Talent &lt;&amp;&gt;/);
  assert.equal(state.draft.template_version,suffix);
  await assert.rejects(service.detail(c.id,talent));
  await assert.rejects(service.detail(c.id,other));
  await assert.rejects(service.create(c.id,admin,{templateId}));
});
test("preparer permissions, canonical immutable offer terms and clause token protection",async()=>{
  const c=await prepare();let state:any=await service.detail(c.id,client);
  state=await service.update(c.id,client,{revision:state.draft.revision,fieldOverrides:{"client.legalEntityName":"Changed client"}});
  await assert.rejects(service.update(c.id,client,{revision:state.draft.revision,fieldOverrides:{"contract.paymentTerms":"Unauthorized"}}));
  await assert.rejects(service.update(c.id,admin,{revision:state.draft.revision,fieldOverrides:{"offer.rate":"USD 1"}}));
  await assert.rejects(service.update(c.id,client,{revision:state.draft.revision,bodyOverrides:{"clause-1":"<h1>Changed</h1>"}}));
  await assert.rejects(service.update(c.id,admin,{revision:state.draft.revision,bodyOverrides:{"clause-3":"<p>Removed required talent</p>"}}));
  state=await service.update(c.id,admin,{revision:state.draft.revision,bodyOverrides:{"clause-1":"<h1>Approved change</h1><script>bad()</script>"}});
  assert.doesNotMatch(state.preview.html,/<script>/);
  const events=(await query("SELECT action,field_key FROM contract_document_events WHERE hiring_contract_id=$1",[c.id])).rows;
  assert.ok(events.some(e=>e.action==="draft_field_edited" && e.field_key==="client.legalEntityName"));
  assert.doesNotMatch(JSON.stringify(events),/Changed client|Approved change/);
});
test("refresh shows current profile diff, rejects stale acceptance and keeps overrides",async()=>{
  const c=await prepare();let state:any=await service.detail(c.id,admin);
  state=await service.update(c.id,admin,{revision:state.draft.revision,fieldOverrides:{"client.legalEntityName":"Manual <override>"}});
  await query("UPDATE client_profiles SET legal_entity_name='Profile refreshed' WHERE user_id=$1",[client]);
  const preview:any=await service.refresh(c.id,admin);
  assert.ok(preview.changes.some((v:any)=>v.key==="client.legalEntityName"));
  await query("UPDATE client_profiles SET legal_entity_name='Profile changed again' WHERE user_id=$1",[client]);
  await assert.rejects(service.refresh(c.id,admin,{revision:preview.revision,refreshHash:preview.refreshHash}));
  const fresh:any=await service.refresh(c.id,admin);
  state=await service.refresh(c.id,admin,{revision:fresh.revision,refreshHash:fresh.refreshHash});
  assert.equal(state.draft.field_values["client.legalEntityName"].value,"Profile changed again");
  assert.equal(state.draft.field_overrides["client.legalEntityName"],"Manual <override>");
  assert.match(state.preview.html,/Manual &lt;override&gt;/);
});
test("admin opt-in structured profile save is atomic and does not accept arbitrary columns",async()=>{
  const c=await prepare();let state:any=await service.detail(c.id,admin);
  await assert.rejects(service.update(c.id,client,{revision:state.draft.revision,profileChanges:{talent:{legalFullName:"Unauthorized"}}}));
  await assert.rejects(service.update(c.id,admin,{revision:state.draft.revision,profileChanges:{talent:{taxIdLast4:"1234"}}}));
  state=await service.update(c.id,admin,{revision:state.draft.revision,profileChanges:{talent:{legalFullName:"Approved legal name",city:"Example City"}}});
  assert.equal((await query("SELECT legal_full_name,city FROM candidates WHERE user_id=$1",[talent])).rows[0].city,"Example City");
  await assert.rejects(service.update(c.id,admin,{revision:state.draft.revision-1,profileChanges:{talent:{city:"Lost update"}}}));
  assert.equal((await query("SELECT city FROM candidates WHERE user_id=$1",[talent])).rows[0].city,"Example City");
});
test("required values block PDF; PDF tables and branded footer render, review required before send, freeze denies edits",async()=>{
  const c=await prepare();let state:any=await service.detail(c.id,admin);
  await assert.rejects(service.render(c.id,admin,{revision:state.draft.revision}));
  state=await complete(c.id);
  const doc=await service.render(c.id,admin,{revision:state.draft.revision});
  const key=(await query("SELECT object_key FROM contract_documents WHERE id=$1",[doc.id])).rows[0].object_key;
  const bytes=await blobs.read(key);
  assert.equal(pdfHash(bytes),doc.sha256);
  assert.ok((await PDFDocument.load(bytes)).getPageCount()>=2);
  const text=execFileSync("pdftotext",["-layout","-","-"],{input:bytes}).toString();
  assert.match(text,/OnSpot Connect/);assert.match(text,/Approved fixture terms/);
  assert.match(text,/Signature:/);assert.match(text,/Client/);assert.match(text,/USD/);
  await assert.rejects(docs.sendContract(c.id,{id:admin},blobs));
  await reviewAndSend(c.id);
  await assert.rejects(service.update(c.id,admin,{revision:state.draft.revision,fieldOverrides:{}}));
  await assert.rejects(service.refresh(c.id,admin));
  await assert.rejects(service.render(c.id,admin,{revision:state.draft.revision}));
  await assert.rejects(service.detail(c.id,talent));
  const detail=await docs.contractDetail(c.id,{id:talent});
  assert.equal(detail.document!.template_id,templateId);
  assert.equal(detail.document!.authoring_snapshot,undefined);
  assert.equal(detail.document!.final_field_values,undefined);
  assert.equal(detail.document!.object_key,undefined);
});
test("every save invalidates generated PDF and review; stale revisions cannot render",async()=>{
  const c=await prepare();let state=await complete(c.id);
  const first=await service.render(c.id,admin,{revision:state.draft.revision});
  await docs.contractPdf(c.id,{id:admin},false,blobs);
  const oldRevision=state.draft.revision;
  state=await service.update(c.id,admin,{revision:oldRevision,fieldOverrides:{"contract.paymentTerms":"Revised terms"}});
  await assert.rejects(service.render(c.id,admin,{revision:oldRevision}));
  await assert.rejects(docs.sendContract(c.id,{id:admin},blobs));
  const next=await service.render(c.id,admin,{revision:state.draft.revision});
  assert.ok(next.version>first.version);assert.notEqual(next.sha256,first.sha256);
  await assert.rejects(docs.sendContract(c.id,{id:admin},blobs));
  await reviewAndSend(c.id);
});
test("signer requests changes: void prior version, reopen private draft, resend with fresh signatures only",async()=>{
  const c=await prepare();let state=await complete(c.id);
  const old=await service.render(c.id,admin,{revision:state.draft.revision});
  await reviewAndSend(c.id);
  await docs.contractPdf(c.id,{id:talent},false,blobs);
  await docs.signContractPdf(c.id,{id:talent},{legalName:"Synthetic Legal Name",consent:true,documentId:old.id,sha256:old.sha256},{},blobs);
  await service.revise(c.id,talent,{reason:"Correct the terms"},true);
  await assert.rejects(service.detail(c.id,talent));
  assert.equal((await query("SELECT status FROM contract_documents WHERE id=$1",[old.id])).rows[0].status,"voided");
  assert.equal((await query("SELECT count(*)::int AS n FROM contract_signatures WHERE document_id=$1",[old.id])).rows[0].n,1);
  state=await service.detail(c.id,admin);
  const newDoc=await service.render(c.id,admin,{revision:state.draft.revision});
  await reviewAndSend(c.id);
  assert.ok(newDoc.version>old.version);assert.notEqual(newDoc.id,old.id);
  assert.equal((await docs.contractDetail(c.id,{id:talent})).signatures.length,0);
  await assert.rejects(docs.signContractPdf(c.id,{id:talent},{legalName:"Synthetic Name",consent:true,documentId:old.id,sha256:old.sha256},{},blobs));
});
test("upload path retires authoring draft and remains usable; manager can revise an uploaded PDF",async()=>{
  const c=await prepare();
  const pdf=await PDFDocument.create();pdf.addPage();
  const uploaded=await docs.uploadContractPdf(c.id,{id:admin},{buffer:Buffer.from(await pdf.save()),mimetype:"application/pdf",originalname:"uploaded.pdf"},blobs);
  assert.equal((await service.detail(c.id,admin)).draft,null);
  await reviewAndSend(c.id);
  await service.revise(c.id,admin,{reason:"Replace uploaded source"});
  const next=await docs.uploadContractPdf(c.id,{id:admin},{buffer:Buffer.from(await pdf.save()),mimetype:"application/pdf",originalname:"revised.pdf"},blobs);
  assert.ok(next.version>uploaded.version);
  await reviewAndSend(c.id);
});
