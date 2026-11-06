import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import pg from "pg";
import { ContractTemplateService } from "../services/contractTemplateService";
import { contractTemplatesRouter } from "../routes/contractTemplates";
import { resolveMergeData, renderContractTemplate } from "../services/contractMergeService";
import { seedContractTemplates } from "../seeds/seedContractTemplates";

// Real PostgreSQL + production services/routes, synthetic JWT identities only.
// No application startup, shared database, real accounts, email, storage or funds.
let directory: string, pool: pg.Pool, service: ContractTemplateService, server: Server, origin: string;
let started = false;
const key = "isolated-contract-template-auth-only";
const contractId = "10000000-0000-4000-8000-000000000001";
const offerId = "20000000-0000-4000-8000-000000000001";
const body = '<h1>Agreement</h1><table><tbody><tr><th>Client</th><td>{{client.legalEntityName}}</td></tr></tbody></table><p>{{offer.rate}}</p>';
async function availablePort() {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
}
async function request(method: string, path: string, actor?: string, data?: unknown) {
  const token = actor && jwt.sign({ id: actor, role: "admin" }, key);
  const response = await fetch(`${origin}${path}`, { method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "onspot-contract-templates-"));
  const port = await availablePort();
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "template_fixture", "-A", "trust", "--no-locale"], { stdio: "ignore" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"], { stdio: "ignore" });
  started = true;
  pool = new pg.Pool({ host: "127.0.0.1", port, user: "template_fixture", database: "postgres" });
  await pool.query(`
    CREATE TABLE users(id text PRIMARY KEY,role text,admin_sub_role text,email text);
    INSERT INTO users VALUES ('admin','admin',NULL,'admin@example.test'),('staff','admin','operations','staff@example.test'),
      ('client','client',NULL,'client@example.test'),('other','client',NULL,'other@example.test'),('talent','talent',NULL,'talent@example.test');
    CREATE TABLE client_profiles(user_id text PRIMARY KEY);
    CREATE TABLE organizations(id text PRIMARY KEY,delete_due_at timestamptz);
    CREATE TABLE organization_members(organization_id text,user_id text,role text,status text);
    CREATE TABLE candidates(id text PRIMARY KEY,user_id text,email text);
    CREATE TABLE job_submissions(id text PRIMARY KEY,client_id text,talent_id text,job_id text);
    CREATE TABLE offers(id uuid PRIMARY KEY,rate numeric,rate_currency text,engagement_type text,proposed_start_date timestamptz,status text);
    CREATE TABLE jobs(id text PRIMARY KEY,title text,description text);
    CREATE TABLE hiring_contracts(id uuid PRIMARY KEY,submission_id text,offer_id uuid,status text,party_type text,
      organization_id text,prepared_by text,signing_entity text,effective_start_date date);
    CREATE TABLE security_deposits(id uuid PRIMARY KEY,hiring_contract_id uuid,offer_id uuid,submission_id text,
      amount numeric,currency text,created_at timestamptz DEFAULT NOW());
    CREATE TABLE platform_settings(key text PRIMARY KEY,value text);
  `);
  await pool.query(await readFile("migrations/0060_contract_party_details.sql", "utf8"));
  const migration = await readFile("migrations/0061_contract_templates.sql", "utf8");
  await pool.query(migration);
  await pool.query(migration);
  await pool.query(`INSERT INTO client_profiles(user_id,legal_entity_name,address_line1,city,country,signatory_name,signatory_title)
    VALUES('client','Client <&> "LLC"','Example client street','Example city','Example country','Client Signer','Director');
    INSERT INTO organizations(id,legal_entity_name,address_line1,city,country) VALUES('org','Organization legal entity','Organization street','Organization city','Example country');
    INSERT INTO organization_members VALUES('org','client','owner','active'),('org','other','member','active');
    INSERT INTO candidates(id,user_id,email,legal_full_name,address_line1,city,country,tax_id_last4)
      VALUES('candidate','talent','talent@example.test','Talent <script>alert(1)</script>','Talent street','Talent city','Example country','0012');
    INSERT INTO jobs VALUES('job','Example job','<p>R&amp;D &lt;review&gt;.</p><p>Second responsibility.</p>');
    INSERT INTO job_submissions VALUES('submission','client','talent','job');
    INSERT INTO offers VALUES('${offerId}',123.45,'PHP','Standard','2030-01-02T00:00:00Z','accepted');
    INSERT INTO hiring_contracts VALUES('${contractId}','submission','${offerId}','draft','client',NULL,'client','Agreed OnSpot Entity','2030-01-02');
    INSERT INTO security_deposits(id,hiring_contract_id,offer_id,submission_id,amount,currency)
      VALUES('30000000-0000-4000-8000-000000000001','${contractId}','${offerId}','submission',0,'PHP');
    INSERT INTO platform_settings VALUES('contract_signing_entity','"Configured OnSpot Entity"'),('contract_signing_address','"OnSpot street, Example country"');
  `);
  service = new ContractTemplateService(pool);
  const app = express();
  app.use(express.json());
  app.use("/templates", contractTemplatesRouter(pool, (req: any, res, next) => {
    try { req.user = jwt.verify(req.headers.authorization?.replace(/^Bearer /, "") ?? "", key); next(); }
    catch { res.status(401).json({ error: "Authentication required" }); }
  }, (_req, _res, next) => next()));
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  if (pool) await pool.end();
  if (started) execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "ignore" });
  if (directory) await rm(directory, { recursive: true, force: true });
});
describe("contract template management", { concurrency: false }, () => {
  it("migration is additive/idempotent with one-active-per-kind enforcement", async () => {
    const before = (await pool.query("SELECT to_jsonb(d) AS snapshot FROM security_deposits d ORDER BY id")).rows;
    await pool.query(await readFile("migrations/0061_contract_templates.sql", "utf8"));
    assert.deepEqual((await pool.query("SELECT to_jsonb(d) AS snapshot FROM security_deposits d ORDER BY id")).rows, before);
    const columns = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='contract_templates'")).rows;
    assert.equal(columns.length, 13);
    assert.equal((await pool.query("SELECT amount FROM security_deposits")).rows[0].amount, "0");
    const constraints = (await pool.query("SELECT indexdef FROM pg_indexes WHERE tablename='contract_templates'")).rows.map(row => row.indexdef).join(" ");
    assert.match(constraints, /UNIQUE INDEX contract_templates_one_active_kind/);
  });
  it("seeds approved MSA as an unattributed system draft once, preserving sections/appendices and excluding financial instructions", async () => {
    await seedContractTemplates(pool);
    await seedContractTemplates(pool);
    const rows = (await pool.query("SELECT * FROM contract_templates WHERE source_document_sha256 IS NOT NULL")).rows;
    assert.equal(rows.length, 1);
    const seed = rows[0];
    assert.equal(seed.status, "draft");
    assert.equal(seed.created_by, null);
    assert.equal(seed.activated_by, null);
    assert.match(seed.source_document_sha256, /^[a-f0-9]{64}$/);
    assert.match(seed.body, /<table>/);
    for (let section = 1; section <= 11; section++) assert.ok(seed.body.includes(`<h2>${section}. `));
    assert.match(seed.body, /APPENDIX A/);
    assert.match(seed.body, /APPENDIX B/);
    assert.match(seed.body, /{{job.description}}/);
    assert.match(seed.body, /{{client.address}}/);
    assert.doesNotMatch(seed.body, /\bACH\b|CREDIT CARD AUTHORIZATION|Account Number|Routing Number|SWIFT\/BIC|Via Wire Transfer/i);
    const saved = await service.detail("admin", seed.id);
    const preview = await service.preview("admin", seed.id, {});
    assert.deepEqual(preview.missingKeys, []);
    assert.deepEqual(preview.unknownKeys, []);
    assert.equal(saved.fields.length, 24);
  });
  it("denies anonymous, Client, Talent and sub-role admins even with forged role claims", async () => {
    assert.equal((await request("GET", "/templates")).status, 401);
    for (const actor of ["client", "talent", "staff", "missing"]) {
      assert.equal((await request("GET", "/templates", actor)).status, 403);
      assert.equal((await request("POST", "/templates", actor, { kind: "msa", name: "Denied", version: actor, body })).status, 403);
    }
  });
  it("creates escaped/sanitized structured HTML and previews only synthetic sample data", async () => {
    const response = await request("POST", "/templates", "admin", { kind: "msa", name: "Example MSA", version: "1", body: `${body}<script>evil()</script><img src=x onerror=evil()>` });
    assert.equal(response.status, 200);
    const draft = response.body;
    assert.equal(draft.status, "draft");
    assert.match(draft.body, /<table>/);
    assert.doesNotMatch(draft.body, /script|onerror|<img/);
    assert.equal(draft.fields.length, 2);
    const preview = await request("POST", `/templates/${draft.id}/preview`, "admin", {});
    assert.match(preview.body.html, /Example Client LLC/);
    assert.doesNotMatch(preview.body.html, /Client &lt;&amp;&gt;|123\.45/);
    assert.deepEqual(preview.body.missingKeys, []);
    assert.equal(preview.body.reviewHash, draft.reviewHash);
    assert.equal((await request("GET", `/templates/${draft.id}`, "client")).status, 403);
    assert.equal((await request("PATCH", `/templates/${draft.id}`, "staff", { name: "Denied" })).status, 403);
  });
  it("supports the editor's blank-draft create payload, but never activates an empty document", async () => {
    const result = await request("POST", "/templates", "admin", { kind: "msa", name: "Blank draft", version: "blank" });
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "draft");
    const activation = await request("POST", `/templates/${result.body.id}/activate`, "admin",
      { reviewed: true, reason: "Cannot approve blank content", reviewHash: result.body.reviewHash });
    assert.equal(activation.status, 422);
    assert.equal(activation.body.code, "EMPTY_TEMPLATE");
  });
  it("requires reason and exact current review hash before activation; active content/fields cannot change", async () => {
    const draft = await service.create("admin", { kind: "sow", name: "SOW", version: "1", body });
    assert.equal((await request("POST", `/templates/${draft.id}/activate`, "admin", { reviewed: true, reason: "Reviewed" })).status, 422);
    await service.update("admin", draft.id, { name: "Changed after preview" });
    assert.equal((await request("POST", `/templates/${draft.id}/activate`, "admin", { reviewed: true, reason: "Reviewed", reviewHash: draft.reviewHash })).status, 409);
    const current = await service.detail("admin", draft.id);
    assert.equal((await request("POST", `/templates/${draft.id}/activate`, "client", { reviewed: true, reason: "Denied", reviewHash: current.reviewHash })).status, 403);
    await service.activate("admin", draft.id, { reviewed: true, reason: "Reviewed sample and field rules", reviewHash: current.reviewHash });
    assert.equal((await request("PATCH", `/templates/${draft.id}`, "admin", { body: "<p>Changed</p>" })).status, 409);
    await assert.rejects(pool.query("UPDATE contract_templates SET body='<p>Changed</p>' WHERE id=$1", [draft.id]), /immutable/);
    await assert.rejects(pool.query("UPDATE contract_template_fields SET label='Changed' WHERE template_id=$1", [draft.id]), /immutable/);
    await assert.rejects(pool.query("DELETE FROM contract_templates WHERE id=$1", [draft.id]), /immutable/);
    const active = await service.detail("admin", draft.id);
    assert.equal(active.activatedBy, "admin");
    assert.equal(active.activationReason, "Reviewed sample and field rules");
  });
  it("clones new versions and atomically retires the previous active version", async () => {
    const first = await service.create("admin", { kind: "talent_agreement", name: "Talent agreement", version: "1", body });
    await service.activate("admin", first.id, { reviewed: true, reason: "First reviewed", reviewHash: first.reviewHash });
    const next = await service.create("admin", { kind: first.kind, name: first.name, version: "2", sourceTemplateId: first.id });
    assert.equal(next.status, "draft");
    assert.equal(next.body, first.body);
    assert.deepEqual(next.fields, first.fields);
    await service.update("admin", next.id, { body: `${body}<p>New clause</p>` });
    const reviewed = await service.detail("admin", next.id);
    await service.activate("admin", next.id, { reviewed: true, reason: "Revision reviewed", reviewHash: reviewed.reviewHash });
    assert.equal((await service.detail("admin", first.id)).status, "retired");
    assert.equal((await service.detail("admin", next.id)).status, "active");
    await assert.rejects(service.activate("admin", first.id, { reviewed: true, reason: "Cannot restore directly", reviewHash: first.reviewHash }), /Clone/);
    assert.equal((await request("POST", "/templates", "admin", { kind: first.kind, name: first.name, version: "2", body })).status, 409);
  });
  it("serializes simultaneous approvals to one active template per kind", async () => {
    const drafts = await Promise.all(["concurrent-a", "concurrent-b"].map(version => service.create("admin", { kind: "msa", name: "Concurrent review", version, body })));
    await Promise.all(drafts.map(draft => service.activate("admin", draft.id, { reviewed: true, reason: "Approved", reviewHash: draft.reviewHash })));
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM contract_templates WHERE kind='msa' AND status='active'")).rows[0].n, 1);
  });
  it("rejects unknown tokens, duplicate fields and arbitrary source mappings", async () => {
    assert.equal((await request("POST", "/templates", "admin", { kind: "msa", name: "Unknown", version: "unknown", body: "<p>{{client.password}}</p>" })).status, 422);
    const draft = await service.create("admin", { kind: "sow", name: "Rules", version: "rules", body });
    assert.equal((await request("PATCH", `/templates/${draft.id}`, "admin", { fields: [{ ...draft.fields[0], source: "users.password" }] })).status, 422);
    assert.equal((await request("PATCH", `/templates/${draft.id}`, "admin", { fields: [draft.fields[0], draft.fields[0]] })).status, 422);
  });
});
describe("private contract merge resolution", { concurrency: false }, () => {
  it("resolves approved source fields, zero deposit and historical offer currency without inventing missing data", async () => {
    const values = await resolveMergeData({ actorId: "client", hiringContractId: contractId, clientId: "other" }, pool);
    assert.equal(values["client.legalEntityName"].value, 'Client <&> "LLC"');
    assert.equal(values["client.legalEntityName"].source, "client_profiles.legal_entity_name");
    assert.equal(values["client.address"].value, "Example client street, Example city, Example country");
    assert.match(values["offer.rate"].value!, /PHP.*123\.45/);
    assert.match(values["deposit.amount"].value!, /PHP.*0\.00/);
    assert.equal(values["offer.startDate"].value, "January 2, 2030");
    assert.equal(values["contract.effectiveDate"].value, "January 2, 2030");
    assert.equal(values["onspot.entityName"].value, "Agreed OnSpot Entity");
    assert.equal(values["onspot.address"].value, "OnSpot street, Example country");
    assert.equal(values["client.entityType"].missing, true);
    assert.equal(values["contract.paymentTerms"].value, null);
    assert.equal(values["contract.paymentTerms"].source, "manual");
    assert.equal(values["job.description"].value, "R&D <review>.\nSecond responsibility.");
    assert.equal(renderContractTemplate("<p>{{job.description}}</p>", values).html,
      "<p>R&amp;D &lt;review&gt;.<br>Second responsibility.</p>");
    assert.doesNotMatch(JSON.stringify(Object.keys(values)), /tax|object_key|password|email/i);
    const rendered = renderContractTemplate("<p>{{client.legalEntityName}} {{talent.legalFullName}}</p>", values);
    assert.match(rendered.html, /Client &lt;&amp;&gt; &quot;LLC&quot;/);
    assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(rendered.html, /<script>/);
  });
  it("blocks Talent, unrelated Clients and any sent contract before reading private party fields", async () => {
    for (const actorId of ["talent", "other"]) await assert.rejects(resolveMergeData({ actorId, hiringContractId: contractId }, pool));
    await pool.query("UPDATE hiring_contracts SET status='sent' WHERE id=$1", [contractId]);
    await assert.rejects(resolveMergeData({ actorId: "admin", hiringContractId: contractId }, pool), /draft preparer/);
    await pool.query("UPDATE hiring_contracts SET status='draft' WHERE id=$1", [contractId]);
    const queries: string[] = [];
    const monitored = { query: async (sql: string, params: any[]) => { queries.push(sql); return pool.query(sql, params); } } as any;
    await assert.rejects(resolveMergeData({ actorId: "talent", hiringContractId: contractId }, monitored));
    assert.equal(queries.some(sql => /FROM client_profiles|FROM candidates|FROM organizations/.test(sql)), false);
  });
  it("uses organization legal details only with canonical contract authority or owned MSA context", async () => {
    await pool.query("UPDATE hiring_contracts SET party_type='organization',organization_id='org' WHERE id=$1", [contractId]);
    const values = await resolveMergeData({ actorId: "client", hiringContractId: contractId }, pool);
    assert.equal(values["client.legalEntityName"].value, "Organization legal entity");
    assert.equal(values["client.legalEntityName"].source, "organizations.legal_entity_name");
    await assert.rejects(resolveMergeData({ actorId: "other", hiringContractId: contractId }, pool), error => (error as any).status === 404);
    const msa = await resolveMergeData({ actorId: "client", clientId: "client", organizationId: "org" }, pool);
    assert.equal(msa["onspot.entityName"].value, "Configured OnSpot Entity");
    assert.equal(msa["offer.rate"].missing, true);
    await assert.rejects(resolveMergeData({ actorId: "other", clientId: "client", organizationId: "org" }, pool));
    await assert.rejects(resolveMergeData({ actorId: "staff", clientId: "client" }, pool));
    await pool.query("UPDATE hiring_contracts SET party_type='client',organization_id=NULL WHERE id=$1", [contractId]);
  });
  it("highlights empty fields and unknown tokens; cannot execute profile markup", () => {
    const result = renderContractTemplate('<p onclick="evil()">{{client.address}}</p><script>bad()</script><p>{{unknown}}</p>',
      { "client.address": { value: null, source: "client_profiles.address_line1", missing: true } });
    assert.deepEqual(result.missingKeys, ["client.address", "unknown"]);
    assert.deepEqual(result.unknownKeys, ["unknown"]);
    assert.doesNotMatch(result.html, /onclick|<script>/);
  });
});
