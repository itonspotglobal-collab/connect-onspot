/** Registered inside the owned onboarding fixture. Synthetic records and in-memory
 * blob transport only; these are not authenticated-account or Wise UAT claims. */
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {ClientMsaAuthoringService} from "../services/clientMsaAuthoringService";
import {ContractTemplateService} from "../services/contractTemplateService";
import {currentClientMsa} from "../services/currentClientMsa";
import {msaSignatureExists} from "../services/depositArrangementState";
import {tryActivateEngagement} from "../services/hiringLifecycleEvents";

export function registerClientMsaAuthoringTests(c:any) {
  const {pool,query,client,other,talent,admin,limited,blobs,files,accepted,verifiedPayment,signContract,msa,tx,status}=c;
  const author=new ClientMsaAuthoringService(pool,blobs);
  const templates=new ContractTemplateService(pool);
  let templateId:string,scenario:any,issued:any,legacy:any;
  const body="<h1>Fixture MSA</h1><table><tr><th>Client</th><td>{{client.legalEntityName}}</td></tr></table><p>{{client.address}}</p><p>{{offer.rate}}</p><p>{{onspot.entityName}}</p>";
  async function render() {
    const state=await author.detail(admin,client);
    return author.render(admin,client,{revision:state.draft.revision});
  }
  test("per-client migration is additive, repeatable and preserves legacy signatures and deposits",async()=>{
    const before=(await query("SELECT id,document_id,document_sha256,msa_version FROM client_msa_signatures ORDER BY id")).rows;
    const deposits=(await query("SELECT id,status,amount FROM security_deposits ORDER BY id")).rows;
    await query(await readFile("migrations/0063_per_client_msa.sql","utf8"));
    await query(await readFile("migrations/0063_per_client_msa.sql","utf8"));
    assert.deepEqual((await query("SELECT id,document_id,document_sha256,msa_version FROM client_msa_signatures ORDER BY id")).rows,before);
    assert.deepEqual((await query("SELECT id,status,amount FROM security_deposits ORDER BY id")).rows,deposits);
    legacy=await msa.status(client);assert.ok(legacy.signature);
    const template=await templates.create(admin,{kind:"msa",name:"Synthetic MSA fixture",version:"msa-fixture",body});
    const detail=await templates.detail(admin,template.id);templateId=template.id;
    await templates.activate(admin,templateId,{reviewed:true,reason:"Synthetic legal fixture, no actual agreement",reviewHash:detail.reviewHash});
    const after=await msa.status(client);
    assert.equal(after.document.id,legacy.document.id);
    assert.equal(after.signature.id,legacy.signature.id,"template rollout must not invalidate legacy signed Clients");
    assert.equal(await msaSignatureExists(pool,client,await currentClientMsa(pool,client)),true);
  });
  test("only Super Admins can author; draft snapshots and key-only audit remain private",async()=>{
    scenario=await accepted();await verifiedPayment(scenario);
    await query("UPDATE client_profiles SET legal_entity_name='Fixture <Client>',address_line1='Example street',city='Example City',country='Example Country' WHERE user_id=$1",[client]);
    await query(`INSERT INTO platform_settings(key,value) VALUES('contract_signing_entity','"Fixture OnSpot Entity"') ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    for(const actor of [client,other,talent,limited]) {
      await assert.rejects(author.list(actor),(e:any)=>e.status===403);
      await assert.rejects(author.detail(actor,client),(e:any)=>e.status===403);
      await assert.rejects(author.create(actor,client,{templateId,submissionId:scenario.submissionId}),(e:any)=>e.status===403);
    }
    const state=await author.create(admin,client,{templateId,submissionId:scenario.submissionId});
    assert.match(state.preview.html,/Fixture &lt;Client&gt;/);
    assert.equal(state.draft.field_values["offer.currency"].value,"USD");
    assert.ok(state.draft.field_values["deposit.amount"].value);
    await assert.rejects(author.create(admin,client,{templateId,submissionId:scenario.submissionId}));
    const clientState=await msa.status(client);
    assert.equal(clientState.document.id,legacy.document.id);
    assert.equal(clientState.history.some((d:any)=>d.id===state.draft.rendered_document_id),false);
  });
  test("missing values block render; editing, refresh and storage preserve reviewed snapshots",async()=>{
    let state:any=await author.detail(admin,client);
    state=await author.update(admin,client,{revision:state.draft.revision,fieldOverrides:{"client.address":""}});
    await assert.rejects(author.render(admin,client,{revision:state.draft.revision}));
    state=await author.update(admin,client,{revision:state.draft.revision,fieldOverrides:{"client.legalEntityName":"Manual <name>"}});
    await query("UPDATE client_profiles SET legal_entity_name='Updated source' WHERE user_id=$1",[client]);
    const diff:any=await author.refresh(admin,client);
    assert.ok(diff.changes.some((d:any)=>d.key==="client.legalEntityName"));
    state=await author.refresh(admin,client,{revision:diff.revision,refreshHash:diff.refreshHash});
    assert.equal(state.draft.field_overrides["client.legalEntityName"],"Manual <name>");
    await assert.rejects(author.update(admin,client,{revision:state.draft.revision,fieldOverrides:{"offer.rate":"1"}}));
    const document=await render();
    await assert.rejects(msa.pdf(client,document.id),(e:any)=>e.status===404);
    await assert.rejects(msa.pdf(other,document.id),(e:any)=>e.status===404);
    const pdf=await msa.pdf(admin,document.id);assert.equal(pdf.bytes.subarray(0,5).toString(),"%PDF-");
    const key=(await query("SELECT object_key FROM msa_documents WHERE id=$1",[document.id])).rows[0].object_key;
    assert.ok(files.has(key));
    const events=(await query("SELECT action,field_key FROM client_msa_document_events WHERE client_id=$1",[client])).rows;
    assert.doesNotMatch(JSON.stringify(events),/Manual|Example street|Updated source/);
    assert.ok(events.some((e:any)=>e.action==="draft_field_edited"&&e.field_key==="client.legalEntityName"));
    assert.equal((await msa.status(client)).document.id,legacy.document.id);
  });
  test("issue requires reviewing the exact current PDF; review cannot transfer after an edit",async()=>{
    let state:any=await author.detail(admin,client);
    state=await author.update(admin,client,{revision:state.draft.revision,fieldOverrides:{"client.legalEntityName":"Final fixture client"}});
    issued=await render();
    await assert.rejects(author.issue(admin,client,{documentId:issued.id,reviewed:true,reason:"Not yet viewed"}),(e:any)=>e.code==="REVIEW_PDF_FIRST");
    await assert.rejects(msa.activate(admin,issued.id,{reviewed:true,reason:"May not activate as shared"}),(e:any)=>e.code==="PERSONALIZED_MSA");
    await msa.pdf(admin,issued.id);
    await author.issue(admin,client,{documentId:issued.id,reviewed:true,reason:"Synthetic PDF reviewed"});
    const stateClient=await msa.status(client);
    assert.equal(stateClient.document.id,issued.id);assert.equal(stateClient.signature,null);
    assert.equal(stateClient.personalized,true);assert.equal(stateClient.issued,true);
    assert.equal(stateClient.countersignatureBlocksActivation,false);
    for(const actor of [client,other,talent,limited])await assert.rejects(author.issue(actor,client,{documentId:issued.id,reviewed:true,reason:"Forged approval"}),(e:any)=>e.status===403);
    await assert.rejects(author.update(admin,client,{revision:state.draft.revision,fieldOverrides:{}}));
    await assert.rejects(msa.sign(other,{documentId:issued.id,documentSha256:issued.sha256,signerName:"Other Client",consent:true},{ip:"127.0.0.1",userAgent:"fixture"}));
    assert.equal((await msa.status(other)).document,null,"an unsigned Client cannot fall back to the unfilled shared PDF when a template is active");
  });
  test("Client signature activates without OnSpot MSA countersign; foreign documents and hashes are rejected",async()=>{
    const hc=(await query("SELECT id FROM hiring_contracts WHERE offer_id=$1",[scenario.offerId])).rows[0];
    await signContract(hc.id);assert.equal(await status(scenario.submissionId),"contract_signed");
    const input={documentId:issued.id,documentSha256:issued.sha256,signerName:"Fixture Client Signer",consent:true};
    await assert.rejects(msa.sign(client,input,{ip:"127.0.0.1",userAgent:"fixture"}),(e:any)=>e.code==="REVIEW_PDF_FIRST");
    await msa.pdf(client,issued.id);
    await assert.rejects(msa.sign(client,{...input,documentSha256:"0".repeat(64)},{ip:"127.0.0.1",userAgent:"fixture"}));
    await msa.sign(client,input,{ip:"127.0.0.1",userAgent:"fixture"});
    assert.equal(await status(scenario.submissionId),"hired");
    assert.equal((await msa.status(client)).countersignature,null);
    assert.equal(await msaSignatureExists(pool,client,await currentClientMsa(pool,client)),true);
    assert.equal(await msaSignatureExists(pool,other,await currentClientMsa(pool,client)),false);
    assert.equal(await tx((db:any)=>tryActivateEngagement(db,scenario.submissionId,admin)),false,"activation retry is a no-op");
  });
  test("OnSpot countersigning requires Client signature, Super Admin, exact PDF review, consent and hash",async()=>{
    const input={documentSha256:issued.sha256,legalName:"Fixture OnSpot Signer",consent:true};
    for(const actor of [client,talent,other,limited])await assert.rejects(msa.countersign(actor,issued.id,input,{ip:"127.0.0.1",userAgent:"fixture"}),(e:any)=>e.status===403);
    await assert.rejects(msa.countersign(admin,issued.id,{...input,consent:false},{ip:"127.0.0.1",userAgent:"fixture"}));
    await assert.rejects(msa.countersign(admin,issued.id,{...input,documentSha256:"0".repeat(64)},{ip:"127.0.0.1",userAgent:"fixture"}));
    const reviewer=`counter-${admin}`;
    await query("INSERT INTO users(id,email,role,admin_sub_role,password_hash) VALUES($1,$2,'admin',NULL,'NOT_A_LOGIN_HASH')",[reviewer,`${reviewer}@fixture.invalid`]);
    await assert.rejects(msa.countersign(reviewer,issued.id,input,{ip:"127.0.0.1",userAgent:"fixture"}),(e:any)=>e.code==="REVIEW_PDF_FIRST");
    await msa.pdf(reviewer,issued.id);
    const signature=await msa.countersign(admin,issued.id,input,{ip:"127.0.0.1",userAgent:"fixture"});
    const repeated=await msa.countersign(admin,issued.id,input,{ip:"127.0.0.1",userAgent:"fixture"});
    assert.equal(repeated.id,signature.id);
    assert.equal((await msa.status(client)).countersignature.legalName,"Fixture OnSpot Signer");
    assert.equal(await status(scenario.submissionId),"hired");
    const rows=(await query("SELECT event_type FROM hiring_lifecycle_events WHERE event_key=ANY($1::text[])",[[`msa-countersign-required:${issued.id}`,`msa-countersigned:${issued.id}`]])).rows;
    assert.equal(rows.length,2);
  });
  test("replacement MSA preserves old signatures and bytes; new version requires fresh Client and OnSpot signatures",async()=>{
    await author.create(admin,client,{templateId,submissionId:scenario.submissionId});
    const replacement=await render();
    assert.equal((await msa.status(client)).document.id,issued.id,"rendering alone must not replace the issued version");
    await msa.pdf(admin,replacement.id);
    await author.issue(admin,client,{documentId:replacement.id,reviewed:true,reason:"Synthetic replacement requires fresh signatures"});
    assert.equal((await msa.status(client)).document.id,replacement.id);
    assert.equal((await msa.status(client)).signature,null);
    assert.equal((await msa.status(client)).countersignature,null);
    assert.ok((await msa.status(client)).history.some((d:any)=>d.id===issued.id&&d.signedAt));
    await msa.pdf(client,issued.id);
    await assert.rejects(msa.countersign(admin,replacement.id,{documentSha256:replacement.sha256,legalName:"Fixture OnSpot",consent:true},{ip:"127.0.0.1",userAgent:"fixture"}),(e:any)=>e.code==="CLIENT_SIGNATURE_REQUIRED");
    await assert.rejects(msa.sign(client,{documentId:issued.id,documentSha256:issued.sha256,signerName:"Fixture Client",consent:true},{ip:"127.0.0.1",userAgent:"fixture"}));
    assert.equal(await status(scenario.submissionId),"hired","existing active engagement is never rewritten by replacement issuance");
  });
}
