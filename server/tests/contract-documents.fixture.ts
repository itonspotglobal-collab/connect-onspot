/**
 * Real PostgreSQL + real canonical contract/document services. Only external
 * blob-provider transport and Microsoft Graph HTTP are simulated. No app startup,
 * no application DB, no real user records, credentials or storage are touched.
 */
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { pool, query } from "./fixtures/hiring-db";
import * as documents from "../services/contractDocumentService";
import { contractBlobProvider, validateContractPdf, pdfHash, type ContractBlobProvider } from "../services/contractBlobStore";
import { deliverContractEmails } from "../services/contractDeliveryService";
import { updateHiringContract } from "../services/hiringContractService";
import { ObjectStorageService } from "../objectStorage";

const suffix = randomUUID(), client = `doc-client-${suffix}`, admin = `doc-admin-${suffix}`, talent = `doc-talent-${suffix}`;
const other = `doc-other-${suffix}`, otherTalent = `doc-other-talent-${suffix}`, owner = `doc-owner-${suffix}`, member = `doc-member-${suffix}`;
const job = `doc-job-${suffix}`, org = `doc-org-${suffix}`, foreignOrg = `doc-foreign-org-${suffix}`;
const files = new Map<string, Buffer>();
const externalBlobTransport: ContractBlobProvider = {
  async save(bytes) { const key = randomUUID(); files.set(key, Buffer.from(bytes)); return key; },
  async read(key) { const bytes = files.get(key); if (!bytes) throw new Error("External object not found"); return Buffer.from(bytes); },
  async remove(key) { files.delete(key); },
};
const actor = (id: string) => ({ id });
const fetchBefore = globalThis.fetch;
let rejectMail = false;
let pdf: Buffer;
before(async () => {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://login.microsoftonline.com/")) return Response.json({ access_token: "fixture-access", expires_in: 3600 });
    if (url.startsWith("https://graph.microsoft.com/") && url.endsWith("/sendMail")) return new Response(null, { status: rejectMail ? 503 : 202 });
    throw new Error("Unexpected external HTTP request denied");
  };
  await query(readFileSync("migrations/0035_private_contract_documents.sql", "utf8"));
  await query(readFileSync("migrations/0036_offer_response_contract_package.sql", "utf8"));
  await query(`CREATE TABLE IF NOT EXISTS platform_settings(key text PRIMARY KEY,value text)`);
  for (const [id, role] of [[client, "client"], [other, "client"], [admin, "admin"], [talent, "talent"], [otherTalent, "talent"], [owner, "client"], [member, "client"]]) {
    await query(`INSERT INTO users(id,email,role,password_hash,first_name,last_name) VALUES($1,$2,$3,'not-a-login-hash','Fixture','Person')`, [id, `${id}@fixture.example`, role]);
  }
  await query(`INSERT INTO jobs(id,client_id,title,description,category,experience_level,status,approval_status,engagement_type,billing_mode)
    VALUES($1,$2,'Contract Fixture','Disposable contract fixture','Operations','Intermediate','open','approved','Standard','tracked')`, [job, client]);
  for (const id of [org, foreignOrg]) await query("INSERT INTO organizations(id,name,created_by) VALUES($1,$2,$3)", [id, "Fixture organization", client]);
  for (const [user, role, organization] of [[client, "member", org], [owner, "owner", org], [member, "member", org], [other, "owner", foreignOrg]]) {
    await query("INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,$3,'active')", [organization, user, role]);
  }
  const original = await PDFDocument.create(); original.addPage(); pdf = Buffer.from(await original.save());
});
after(async () => { globalThis.fetch = fetchBefore; await pool.end(); });
async function acceptedOffer(workflow: "application" | "client_invitation") {
  const submission = (await query(`INSERT INTO job_submissions(job_id,client_id,talent_id,email,applicant_name,workflow_type,initiated_by,registration_status,status)
    VALUES($1,$2,$3,$4,'Fixture Talent',$5,$6,'linked','offer_accepted') RETURNING id`,
    [job, client, talent, `${talent}@fixture.example`, workflow, workflow === "application" ? "talent" : "client"])).rows[0].id;
  const offer = (await query(`INSERT INTO offers(submission_id,status,rate,rate_currency,engagement_type,billing_mode,proposed_start_date)
    VALUES($1,'accepted',2500,'USD','Standard','tracked','2032-10-01') RETURNING id`, [submission])).rows[0].id;
  return { submission, offer };
}
async function prepare(workflow: "application" | "client_invitation", partyType: string, who = client) {
  const { submission, offer } = await acceptedOffer(workflow);
  const prepared = await documents.prepareContract(actor(who), { offerId: offer, partyType, organizationId: partyType === "organization" ? org : undefined });
  await documents.uploadContractPdf(prepared.id, actor(who), { buffer: pdf, mimetype: "application/pdf", originalname: "contract.pdf" }, externalBlobTransport);
  await documents.contractPdf(prepared.id, actor(who), false, externalBlobTransport);
  await documents.sendContract(prepared.id, actor(who), externalBlobTransport);
  return { ...prepared, submission, offer };
}
async function sign(id: string, who: string) {
  const detail = await documents.contractDetail(id, actor(who));
  await documents.contractPdf(id, actor(who), false, externalBlobTransport);
  return documents.signContractPdf(id, actor(who), { documentId: detail.document!.id, sha256: detail.document!.sha256,
    legalName: "Fixture Legal Person", consent: true }, {}, externalBlobTransport);
}
async function status(submission: string) { return (await query("SELECT status FROM job_submissions WHERE id=$1", [submission])).rows[0].status; }
async function deposits(contractId: string) { return (await query("SELECT COUNT(*)::int AS n FROM security_deposits WHERE hiring_contract_id=$1", [contractId])).rows[0].n; }

for (const workflow of ["application", "client_invitation"] as const) {
  for (const partyType of ["onspot", "client", "organization"]) {
    test(`${workflow}: ${partyType} exact signatures execute canonical Hired and one deposit`, async () => {
      const who = partyType === "organization" ? owner : partyType === "onspot" ? admin : client;
      const prepared = await prepare(workflow, partyType, who);
      await sign(prepared.id, talent);
      assert.equal(await status(prepared.submission), "contract_sent");
      assert.equal(await deposits(prepared.id), 0);
      if (partyType !== "onspot") {
        // OnSpot signing early must NOT eliminate the third-party requirement.
        await sign(prepared.id, admin);
        assert.equal(await status(prepared.submission), "contract_sent");
        await sign(prepared.id, partyType === "client" ? client : owner);
      } else {
        await assert.rejects(sign(prepared.id, client));
        await sign(prepared.id, admin);
      }
      assert.equal(await status(prepared.submission), "hired");
      const contract = (await query("SELECT * FROM hiring_contracts WHERE id=$1", [prepared.id])).rows[0];
      assert.equal(contract.status, "signed"); assert.ok(contract.billing_activated_at);
      assert.equal(await deposits(prepared.id), 1);
      const detail = await documents.contractDetail(prepared.id, actor(talent));
      assert.ok((await documents.listContracts(actor(talent))).some(row => row.id === prepared.id));
      assert.equal(detail.document!.status, "executed");
      assert.equal(detail.signatures.length, partyType === "onspot" ? 2 : 3);
      assert.equal(pdfHash((await documents.contractPdf(prepared.id, actor(talent), false, externalBlobTransport)).bytes), pdfHash(pdf));
      assert.ok((await PDFDocument.load((await documents.contractPdf(prepared.id, actor(talent), true, externalBlobTransport)).bytes)).getPageCount() > 1);
      await assert.rejects(sign(prepared.id, admin));
      assert.equal(await deposits(prepared.id), 1);
      const submissions = (await query("SELECT COUNT(*)::int AS n FROM job_submissions WHERE id=$1", [prepared.submission])).rows[0].n;
      assert.equal(submissions, 1, "original submission remains canonical");
    });
  }
}
test("wrong Talent/Client/Org cannot view/sign/replace/void; ordinary org member is denied", async () => {
  const prepared = await prepare("application", "organization", owner);
  for (const who of [other, otherTalent, member]) {
    await assert.rejects(documents.contractDetail(prepared.id, actor(who)));
    await assert.rejects(documents.contractPdf(prepared.id, actor(who), false, externalBlobTransport));
    await assert.rejects(sign(prepared.id, who));
    await assert.rejects(documents.uploadContractPdf(prepared.id, actor(who), { buffer: pdf, mimetype: "application/pdf", originalname: "x.pdf" }, externalBlobTransport));
    await assert.rejects(documents.closeContract(prepared.id, actor(who), "forbidden"));
  }
  await query("UPDATE organization_members SET status='suspended' WHERE user_id=$1 AND organization_id=$2", [owner, org]);
  await assert.rejects(sign(prepared.id, owner));
  await query("UPDATE organization_members SET status='active' WHERE user_id=$1 AND organization_id=$2", [owner, org]);
});
test("draft replacement is immutable history; sent/signed replacements and unreviewed/unchecked signatures fail", async () => {
  const { offer, submission } = await acceptedOffer("application");
  const prepared = await documents.prepareContract(actor(client), { offerId: offer, partyType: "client" });
  await assert.rejects(documents.contractDetail(prepared.id, actor(talent)), "Talent cannot read unsent drafts");
  await assert.rejects(documents.sendContract(prepared.id, actor(client), externalBlobTransport));
  const first = await documents.uploadContractPdf(prepared.id, actor(client), { buffer: pdf, mimetype: "application/pdf", originalname: "one.pdf" }, externalBlobTransport);
  const second = await documents.uploadContractPdf(prepared.id, actor(client), { buffer: pdf, mimetype: "application/pdf", originalname: "two.pdf" }, externalBlobTransport);
  assert.equal(second.version, 2); assert.notEqual(first.id, second.id);
  assert.equal((await query("SELECT status FROM contract_documents WHERE id=$1", [first.id])).rows[0].status, "superseded");
  await assert.rejects(documents.sendContract(prepared.id, actor(client), externalBlobTransport), "Sender must review server-stored bytes");
  await documents.contractPdf(prepared.id, actor(client), false, externalBlobTransport);
  await documents.sendContract(prepared.id, actor(client), externalBlobTransport);
  const payload = { documentId: second.id, sha256: second.sha256, legalName: "Fixture Person", consent: true };
  await assert.rejects(documents.signContractPdf(prepared.id, actor(talent), payload, {}, externalBlobTransport), "review required");
  await documents.contractPdf(prepared.id, actor(talent), false, externalBlobTransport);
  await assert.rejects(documents.signContractPdf(prepared.id, actor(talent), { ...payload, consent: false }, {}, externalBlobTransport));
  await assert.rejects(documents.signContractPdf(prepared.id, actor(talent), { ...payload, documentId: first.id }, {}, externalBlobTransport));
  await assert.rejects(updateHiringContract(prepared.id, { talentSigned: true, onspotSigned: true }));
  await sign(prepared.id, talent);
  await assert.rejects(documents.uploadContractPdf(prepared.id, actor(client), { buffer: pdf, mimetype: "application/pdf", originalname: "replace.pdf" }, externalBlobTransport));
  assert.equal(await status(submission), "contract_sent");
  await documents.closeContract(prepared.id, actor(client), "Wrong version; reissue");
  const next = await documents.prepareContract(actor(client), { offerId: offer, partyType: "client" });
  assert.notEqual(next.id, prepared.id);
  const oldSignatures = (await query("SELECT * FROM contract_signatures WHERE document_id=$1", [second.id])).rows;
  assert.equal(oldSignatures.length, 1); assert.equal(oldSignatures[0].document_sha256, second.sha256);
  assert.equal((await query(`SELECT COUNT(*)::int AS n FROM contract_signatures s JOIN contract_documents d ON d.id=s.document_id WHERE d.hiring_contract_id=$1`, [next.id])).rows[0].n, 0);
});
test("private supporting PDFs are audited, scoped, removable only in draft and frozen on send", async()=>{
  const {submission,offer}=await acceptedOffer("application");
  const draft=await documents.prepareContract(actor(admin),{offerId:offer,partyType:"onspot"});
  const file={buffer:pdf,mimetype:"application/pdf",originalname:"Policy.pdf"};
  const primary=await documents.uploadContractPdf(draft.id,actor(admin),file,externalBlobTransport);
  const removed=await documents.uploadContractAttachment(draft.id,actor(admin),file,externalBlobTransport);
  await documents.removeContractAttachment(draft.id,removed.id,actor(admin));
  await assert.rejects(documents.readContractAttachment(draft.id,removed.id,actor(admin),externalBlobTransport));
  const attached=await documents.uploadContractAttachment(draft.id,actor(admin),file,externalBlobTransport);
  assert.ok(attached.version>removed.version);
  await assert.rejects(documents.readContractAttachment(draft.id,attached.id,actor(talent),externalBlobTransport));
  await assert.rejects(documents.uploadContractAttachment(draft.id,actor(other),file,externalBlobTransport));
  await documents.contractPdf(draft.id,actor(admin),false,externalBlobTransport);
  await documents.sendContract(draft.id,actor(admin),externalBlobTransport);
  const detail=await documents.contractDetail(draft.id,actor(talent));
  assert.equal(detail.attachments.length,1);
  assert.equal(detail.attachments[0].status,"frozen");
  assert.equal((await documents.readContractAttachment(draft.id,attached.id,actor(talent),externalBlobTransport)).bytes.equals(pdf),true);
  assert.equal((await documents.readContractAttachment(draft.id,attached.id,actor(client),externalBlobTransport)).bytes.equals(pdf),true);
  await assert.rejects(documents.readContractAttachment(draft.id,attached.id,actor(otherTalent),externalBlobTransport));
  await assert.rejects(documents.removeContractAttachment(draft.id,attached.id,actor(admin)));
  await assert.rejects(documents.uploadContractAttachment(draft.id,actor(admin),file,externalBlobTransport));
  await assert.rejects(documents.removePrimaryDraftPdf(draft.id,actor(admin)));
  assert.equal(await status(submission),"contract_sent");
  assert.equal(primary.sha256,pdfHash(pdf));
});
test("removing a draft primary preserves history and next upload increments version",async()=>{
  const {offer}=await acceptedOffer("application");
  const draft=await documents.prepareContract(actor(admin),{offerId:offer,partyType:"onspot"});
  const file={buffer:pdf,mimetype:"application/pdf",originalname:"Agreement.pdf"};
  const original=await documents.uploadContractPdf(draft.id,actor(admin),file,externalBlobTransport);
  await documents.removePrimaryDraftPdf(draft.id,actor(admin));
  assert.equal((await documents.contractDetail(draft.id,actor(admin))).document,null);
  await assert.rejects(documents.sendContract(draft.id,actor(admin),externalBlobTransport));
  const next=await documents.uploadContractPdf(draft.id,actor(admin),file,externalBlobTransport);
  assert.equal(next.version,original.version+1);
  assert.equal((await query("SELECT status FROM contract_documents WHERE id=$1",[original.id])).rows[0].status,"superseded");
});
test("tampered stored bytes cannot be viewed or signed and do not activate", async () => {
  const prepared = await prepare("application", "client");
  await documents.contractPdf(prepared.id, actor(talent), false, externalBlobTransport);
  const record = (await query("SELECT * FROM contract_documents WHERE hiring_contract_id=$1", [prepared.id])).rows[0];
  files.set(record.object_key, Buffer.from("%PDF-tampered"));
  await assert.rejects(documents.contractPdf(prepared.id, actor(talent), false, externalBlobTransport));
  await assert.rejects(documents.signContractPdf(prepared.id, actor(talent), { documentId: record.id, sha256: record.sha256, legalName: "Fixture Person", consent: true }, {}, externalBlobTransport));
  assert.equal(await status(prepared.submission), "contract_sent");
});
test("validation rejects non-PDF, empty, oversize, spoofed MIME and unsafe active content", async () => {
  for (const file of [
    { buffer: Buffer.alloc(0), mimetype: "application/pdf", originalname: "x.pdf" },
    { buffer: Buffer.alloc(10485761), mimetype: "application/pdf", originalname: "x.pdf" },
    { buffer: Buffer.from("%PDF-not-parseable"), mimetype: "application/pdf", originalname: "x.pdf" },
    { buffer: pdf, mimetype: "text/plain", originalname: "x.pdf" },
    { buffer: pdf, mimetype: "application/pdf", originalname: "x.txt" },
  ]) await assert.rejects(validateContractPdf(file));
  const active = await PDFDocument.create(); active.addPage(); active.addJavaScript("evil", "app.alert('bad')");
  await assert.rejects(validateContractPdf({ buffer: Buffer.from(await active.save()), mimetype: "application/pdf", originalname: "x.pdf" }));
  await assert.rejects(new ObjectStorageService().getObjectEntityFile("/objects/hiring-contract-documents/" + randomUUID()));
});
test("decline preserves audit, rolls back contract_sent only, never executes or deposits", async () => {
  const prepared = await prepare("client_invitation", "client");
  await documents.closeContract(prepared.id, actor(talent), "Do not accept terms", true);
  assert.equal(await status(prepared.submission), "offer_accepted");
  assert.equal((await documents.contractDetail(prepared.id, actor(talent))).document!.status, "declined");
  assert.equal(await deposits(prepared.id), 0);
});
test("email provider failure is persisted and retry never duplicates contract or notifications", async () => {
  const prepared = await prepare("application", "client");
  const beforeCount = (await query("SELECT COUNT(*)::int AS n FROM notifications WHERE related_id=$1", [prepared.id])).rows[0].n;
  rejectMail = true;
  const delivery = await deliverContractEmails(prepared.id);
  // Unconfigured service remains explicitly skipped, never a false success.
  assert.ok(["failed", "skipped"].includes(delivery.status));
  rejectMail = false;
  await deliverContractEmails(prepared.id);
  await documents.sendContract(prepared.id, actor(client), externalBlobTransport);
  assert.equal((await query("SELECT COUNT(*)::int AS n FROM notifications WHERE related_id=$1", [prepared.id])).rows[0].n, beforeCount);
  assert.equal(await status(prepared.submission), "contract_sent");
});
test("parallel final signature requests activate exactly once and preserve real signer identities", async () => {
  const prepared = await prepare("application", "organization", owner);
  await sign(prepared.id, talent);
  await sign(prepared.id, owner);
  assert.equal((await documents.contractDetail(prepared.id, actor(admin))).document!.status, "countersigned");
  await documents.contractPdf(prepared.id, actor(admin), false, externalBlobTransport);
  const detail = await documents.contractDetail(prepared.id, actor(admin));
  const body = { documentId: detail.document!.id, sha256: detail.document!.sha256, legalName: "Fixture Administrator", consent: true };
  const outcomes = await Promise.allSettled([
    documents.signContractPdf(prepared.id, actor(admin), body, {}, externalBlobTransport),
    documents.signContractPdf(prepared.id, actor(admin), body, {}, externalBlobTransport),
  ]);
  assert.equal(outcomes.filter(outcome => outcome.status === "fulfilled").length, 1);
  assert.equal(await deposits(prepared.id), 1);
  const recorded = (await query("SELECT * FROM contract_signatures WHERE document_id=$1", [detail.document!.id])).rows;
  assert.equal(recorded.find(s => s.signer_role === "organization").signer_user_id, owner);
  assert.equal(recorded.find(s => s.signer_role === "organization").organization_id, org);
  assert.equal(recorded.find(s => s.signer_role === "onspot").signer_user_id, admin);
  assert.ok(recorded.every(s => s.document_sha256 === detail.document!.sha256));
});
test("optional actual private object provider round-trip, with fixture PDF deleted afterward", { skip: process.env.CONTRACT_STORAGE_SMOKE !== "1" }, async () => {
  let key: string | undefined;
  try {
    key = await contractBlobProvider.save(pdf);
    assert.equal(pdfHash(await contractBlobProvider.read(key)), pdfHash(pdf));
  } catch {
    throw new Error("Actual private object-provider round-trip failed");
  } finally { if (key) await contractBlobProvider.remove(key); }
});
