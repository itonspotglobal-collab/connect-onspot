import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {PDFDocument,PDFName,PDFRawStream} from "pdf-lib";
import {ContractDraftService} from "../services/contractDraftService";
import {ContractTemplateService} from "../services/contractTemplateService";
import * as documents from "../services/contractDocumentService";
import {pdfHash} from "../services/contractBlobStore";
import {signatureEvidence} from "../services/signatureEvidence";
import {signatureFixturePng} from "./fixtures/signature-fixture";

export function registerSignaturePolishTests(c:any) {
  const {pool,query,client,talent,admin,org,owner,prepare,acceptedOffer,blobs}=c;
  const png=signatureFixturePng();
  test("drawn PNG is optional, bounded and readable; titles are validated without changing typed consent",async()=>{
    assert.deepEqual(await signatureEvidence({}),{title:null,png:null});
    assert.equal((await signatureEvidence({signerTitle:" Director ",drawnSignature:png})).title,"Director");
    const oversized=Buffer.from(png.slice(22),"base64");oversized.writeUInt32BE(50000,16);
    for(const drawnSignature of ["https://example.invalid/sign.png","data:image/svg+xml;base64,PHN2Zz4=","data:image/png;base64,AAAA",`data:image/png;base64,${oversized.toString("base64")}`,png+"AAAA"])
      await assert.rejects(signatureEvidence({drawnSignature}),(e:any)=>e.status===422);
    for(const signerTitle of ["a".repeat(161),"Director\nHidden",42,{}])await assert.rejects(signatureEvidence({signerTitle}),(e:any)=>e.status===422);
    const contract=await prepare("application","onspot",admin);
    const detail=await documents.contractDetail(contract.id,{id:talent});
    await documents.contractPdf(contract.id,{id:talent},false,blobs);
    const payload={documentId:detail.document.id,sha256:detail.document.sha256,legalName:"Fixture Legal Name",drawnSignature:png};
    await assert.rejects(documents.signContractPdf(contract.id,{id:talent},payload,{},blobs));
    await assert.rejects(documents.signContractPdf(contract.id,{id:talent},{...payload,consent:true,drawnSignature:"https://example.invalid"}, {},blobs));
    assert.equal((await query("SELECT count(*)::int AS n FROM contract_signatures WHERE document_id=$1",[detail.document.id])).rows[0].n,0);
  });
  test("profile legal names and representative titles are prefilled only for the authenticated signing party",async()=>{
    await query("INSERT INTO candidates(id,user_id,email,legal_full_name) VALUES($1,$2,$3,'Fixture Private Legal Name')",
      [`signature-${talent}`,talent,`${talent}@fixture.example`]);
    await query(`INSERT INTO client_profiles(id,user_id,signatory_name,signatory_title) VALUES($1,$2,'Fixture Client Signer','Client Director')
      ON CONFLICT(user_id) DO UPDATE SET signatory_name=excluded.signatory_name,signatory_title=excluded.signatory_title`,[`sig-${client}`,client]);
    const contract=await prepare("application","client",client);
    assert.equal((await documents.contractDetail(contract.id,{id:talent})).signerProfile.legalName,"Fixture Private Legal Name");
    const clientDetail=await documents.contractDetail(contract.id,{id:client});
    assert.equal(clientDetail.signerProfile.title,"Client Director");
    assert.equal(clientDetail.signerProfile.userId,client);
    const adminDetail=await documents.contractDetail(contract.id,{id:admin});
    assert.notEqual(adminDetail.signerProfile.legalName,"Fixture Client Signer");
    await query("UPDATE organizations SET signatory_name='Fixture Org Owner',signatory_title='Managing Partner' WHERE id=$1",[org]);
    const organization=await prepare("client_invitation","organization",owner);
    assert.equal((await documents.contractDetail(organization.id,{id:owner})).signerProfile.title,"Managing Partner");
  });
  test("all three required parties stamp Unicode names, titles, dates and PNG in generated blocks; original stays immutable",async()=>{
    const source=await acceptedOffer("application");
    const contract=await documents.prepareContract({id:admin},{offerId:source.offer,partyType:"client"});
    const templates=new ContractTemplateService(pool),drafts=new ContractDraftService(pool,blobs);
    const template=await templates.create(admin,{kind:"talent_agreement",name:"Synthetic signing fixture",version:"signature-fixture",
      body:"<h1>Signature fixture only</h1><p>{{job.title}}</p>"});
    const review=await templates.detail(admin,template.id);
    await templates.activate(admin,template.id,{reviewed:true,reason:"Synthetic fixture only; not legal approval",reviewHash:review.reviewHash});
    const draft=await drafts.create(contract.id,admin,{templateId:template.id});
    const rendered=await drafts.render(contract.id,admin,{revision:draft.draft.revision});
    const original=(await documents.contractPdf(contract.id,{id:admin},false,blobs)).bytes;
    const originalPages=(await PDFDocument.load(original)).getPageCount();
    await documents.sendContract(contract.id,{id:admin},blobs);
    const parties=[talent,client,admin];
    for(let index=0;index<parties.length;index++) {
      const who=parties[index];
      await documents.contractPdf(contract.id,{id:who},false,blobs);
      const payload={documentId:rendered.id,sha256:rendered.sha256,legalName:index===0?"李 明":`Fixture Signer ${index}`,
        signerTitle:index===0?"合同负责人":"Fixture Director",drawnSignature:index===0?png:null,consent:true};
      if(index===2) {
        await assert.rejects(documents.signContractPdf(contract.id,{id:who},payload,{}, {...blobs,save:async()=>{throw new Error("Synthetic private storage outage");}}));
        assert.equal((await query("SELECT count(*)::int AS n FROM contract_signatures WHERE document_id=$1",[rendered.id])).rows[0].n,2);
      }
      const result=await documents.signContractPdf(contract.id,{id:who},payload,{},blobs);
      assert.equal(result.executed,index===2);
    }
    const final=await documents.contractDetail(contract.id,{id:talent});
    assert.equal(final.signatures.length,3);
    assert.equal(final.signatures[0].has_drawn_signature,true);
    assert.doesNotMatch(JSON.stringify(final),/data:image\/png|object_key|signature_png/);
    const executed=(await documents.contractPdf(contract.id,{id:talent},true,blobs)).bytes;
    const parsed=await PDFDocument.load(executed);
    assert.equal(parsed.getPageCount(),originalPages+1,"generated reserved blocks do not append replacement signature pages");
    assert.ok(parsed.context.enumerateIndirectObjects().some(([,o])=>o instanceof PDFRawStream&&o.dict.get(PDFName.of("Subtype"))?.toString()==="/Image"));
    const text=execFileSync("pdftotext",["-layout","-","-"],{input:executed}).toString();
    assert.match(text,/李 明/);assert.match(text,/合同负责人/);assert.match(text,/Fixture Director/);
    assert.match(text,/Original SHA-256:/);assert.match(text,new RegExp(rendered.sha256));
    const originalAgain=(await documents.contractPdf(contract.id,{id:talent},false,blobs)).bytes;
    assert.equal(pdfHash(originalAgain),rendered.sha256);assert.deepEqual(originalAgain,original);
  });
}
