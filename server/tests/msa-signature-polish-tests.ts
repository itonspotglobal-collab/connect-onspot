import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {ClientMsaService} from "../services/clientMsaService";
import {pdfHash} from "../services/contractBlobStore";
import {signatureFixturePng} from "./fixtures/signature-fixture";

export function registerMsaSignaturePolishTests(c:any) {
  const {pool,query,msa,client,admin,other,talent,limited,blobs,files}=c;
  test("MSA drawn signatures retain typed consent; executed copy needs both real fixture signatures and stays private",async()=>{
    const current=await msa.status(client),document=current.document,png=signatureFixturePng();
    assert.ok(document);assert.equal(current.signature,null);
    assert.equal(current.countersignatureBlocksActivation,false);
    const original=(await msa.pdf(client,document.id)).bytes;
    const input={documentId:document.id,documentSha256:document.sha256,signerName:"Fixture Client Legal Name",
      signerTitle:"Client Director",drawnSignature:png,consent:true};
    await assert.rejects(msa.sign(client,{...input,consent:false},{ip:"127.0.0.1",userAgent:"isolated fixture"}));
    await assert.rejects(msa.sign(client,{...input,drawnSignature:"data:image/svg+xml;base64,AAAA"},{ip:"127.0.0.1",userAgent:"isolated fixture"}));
    await msa.sign(client,input,{ip:"127.0.0.1",userAgent:"isolated fixture"});
    const pending=await msa.status(client);
    assert.equal(pending.signature.signerTitle,"Client Director");
    assert.equal(pending.signature.hasDrawnSignature,true);
    assert.equal(pending.document.executedUrl,null);
    await assert.rejects(msa.executedPdf(client,document.id),(e:any)=>e.status===404);
    await msa.pdf(admin,document.id);
    const counter={documentSha256:document.sha256,legalName:"Fixture OnSpot Signer",signerTitle:"Authorized Director",drawnSignature:png,consent:true};
    const unavailable=new ClientMsaService(pool,{...blobs,save:async()=>{throw new Error("Synthetic storage outage");}});
    await assert.rejects(unavailable.countersign(admin,document.id,counter,{ip:"127.0.0.1",userAgent:"isolated fixture"}));
    assert.equal((await query("SELECT count(*)::int n FROM client_msa_countersignatures WHERE document_id=$1",[document.id])).rows[0].n,0);
    await msa.countersign(admin,document.id,counter,{ip:"127.0.0.1",userAgent:"isolated fixture"});
    const complete=await msa.status(client);
    assert.equal(complete.document.executedUrl,`/api/client/msa/${document.id}/executed`);
    assert.equal(complete.countersignature.signerTitle,"Authorized Director");
    assert.doesNotMatch(JSON.stringify(complete),/data:image\/png|object_key|signature_png/);
    const copy=await msa.executedPdf(client,document.id);
    const text=execFileSync("pdftotext",["-layout","-","-"],{input:copy.bytes}).toString();
    assert.match(text,/Fixture Client Legal Name/);assert.match(text,/Authorized Director/);assert.match(text,/OnSpot in-system signature record/);
    assert.equal(pdfHash((await msa.pdf(client,document.id)).bytes),document.sha256);
    assert.deepEqual((await msa.pdf(client,document.id)).bytes,original);
    for(const who of [other,talent,limited])await assert.rejects(msa.executedPdf(who,document.id),(e:any)=>[403,404].includes(e.status));
    assert.deepEqual((await msa.executedPdf(admin,document.id)).bytes,copy.bytes);
    const stored=(await query("SELECT object_key FROM client_msa_executed_copies WHERE document_id=$1",[document.id])).rows[0];
    files.set(stored.object_key,Buffer.from("tampered synthetic copy"));
    await assert.rejects(msa.executedPdf(client,document.id),(e:any)=>e.code==="DOCUMENT_CHANGED");
    files.set(stored.object_key,copy.bytes);
    const replay=await msa.countersign(admin,document.id,counter,{ip:"127.0.0.1",userAgent:"isolated fixture"});
    assert.equal(replay.alreadySigned,true);
    assert.equal((await query("SELECT count(*)::int n FROM client_msa_executed_copies WHERE document_id=$1",[document.id])).rows[0].n,1);
  });
  test("signature-detail migration is repeatable without rewriting any prior signatures or deposits",async()=>{
    const signatures=(await query("SELECT id,document_sha256,signer_title,signature_png FROM client_msa_signatures ORDER BY id")).rows;
    const deposits=(await query("SELECT id,amount,status FROM security_deposits ORDER BY id")).rows;
    await query(await readFile("migrations/0064_contract_signature_details.sql","utf8"));
    await query(await readFile("migrations/0064_contract_signature_details.sql","utf8"));
    assert.deepEqual((await query("SELECT id,document_sha256,signer_title,signature_png FROM client_msa_signatures ORDER BY id")).rows,signatures);
    assert.deepEqual((await query("SELECT id,amount,status FROM security_deposits ORDER BY id")).rows,deposits);
  });
}
