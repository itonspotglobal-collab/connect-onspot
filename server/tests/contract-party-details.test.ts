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
import { registerContractPartyDetails } from "../routes/contractPartyDetails";
import { createClientProfileUpdateHandler, createOrganizationUpdateHandler } from "../routes/businessPartyProfiles";
import {
  businessPartyColumns, talentPartyColumns, partyDetailsFromRow, stripTalentPartyDetails,
} from "../../shared/contractPartyDetails";
import { insertCandidateSchema } from "../../shared/schema";
import { sanitizeSearchCandidate, sanitizeFullProfileForClient } from "../lib/clientSearchSanitize";

// An owned, temporary PostgreSQL cluster. No workspace/production DB or app startup.
let directory: string, pool: pg.Pool, server: Server, origin: string;
let started = false;
const key = "contract-party-isolated-auth-fixture-only";
async function availablePort() {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
}
const actor = (id: string, role = "talent", email = `${id}@example.test`) => jwt.sign({ id, role, email }, key);
async function request(path: string, token?: string, body?: unknown) {
  const response = await fetch(`${origin}${path}`, {
    method: body === undefined ? "GET" : path.startsWith("/client") ? "PUT" : "PATCH",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "onspot-party-details-"));
  const port = await availablePort();
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "party_fixture", "-A", "trust", "--no-locale"], { stdio: "ignore" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"], { stdio: "ignore" });
  started = true;
  pool = new pg.Pool({ host: "127.0.0.1", port, user: "party_fixture", database: "postgres" });
  await pool.query(`
    CREATE TABLE client_profiles (id text PRIMARY KEY, user_id text UNIQUE, company_name text, about text, updated_at timestamptz);
    CREATE TABLE organizations (id text PRIMARY KEY, name text, updated_at timestamptz);
    CREATE TABLE organization_members (organization_id text, user_id text, role text, status text);
    CREATE TABLE candidates (id text PRIMARY KEY, user_id text, email text, full_name text, updated_at timestamptz);
    INSERT INTO client_profiles VALUES ('cp-one','client-one','Preserve company','Preserve about',NOW());
    INSERT INTO client_profiles VALUES ('cp-two','client-two','Other company','Other about',NOW());
    INSERT INTO organizations VALUES ('org-one','Preserve organization',NOW());
    INSERT INTO organization_members VALUES ('org-one','client-one','owner','active'), ('org-one','client-two','member','active');
    INSERT INTO candidates VALUES ('talent-one','user-one','talent-one@example.test','Public profile name',NOW());
    INSERT INTO candidates VALUES ('talent-two','user-two','talent-two@example.test','Other public name',NOW());
    INSERT INTO candidates VALUES ('legacy',NULL,'legacy@example.test','Legacy profile',NOW());
  `);
  const migration = await readFile("migrations/0060_contract_party_details.sql", "utf8");
  await pool.query(migration);
  await pool.query(migration); // Assert native PostgreSQL syntax AND idempotency.
  const app = express();
  app.use(express.json());
  // Synthetic authentication only in this isolated test app. Production uses authenticateJWT.
  const authenticate: express.RequestHandler = (req: any, res, next) => {
    try { req.user = jwt.verify(req.headers.authorization?.replace(/^Bearer /, "") ?? "", key); next(); }
    catch { res.status(401).json({ error: "Unauthorized" }); }
  };
  const clientOnly: express.RequestHandler = (req: any, res, next) =>
    req.user?.role === "client" ? next() : void res.status(403).json({ error: "Client access required" });
  const query = (sql: string, values: any[]) => pool.query(sql, values);
  registerContractPartyDetails(app, authenticate, query);
  app.put("/client/profile", authenticate, clientOnly,
    createClientProfileUpdateHandler(query, row => ({ ...partyDetailsFromRow(row, businessPartyColumns), companyName: row.company_name, about: row.about })));
  app.patch("/organizations/:organizationId", authenticate, clientOnly,
    createOrganizationUpdateHandler(query, async (id, userId) =>
      (await pool.query("SELECT 1 FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role='owner' AND status='active'", [id, userId])).rows[0],
    row => ({ ...partyDetailsFromRow(row, businessPartyColumns), name: row.name })));
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
describe("contract party migration and isolated HTTP handlers", () => {
  it("adds all 28 nullable columns twice without replacing existing rows or names", async () => {
    const rows = (await pool.query(`SELECT table_name,column_name,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('client_profiles','organizations','candidates')`)).rows;
    for (const [table, columns] of [
      ["client_profiles", businessPartyColumns], ["organizations", businessPartyColumns], ["candidates", talentPartyColumns],
    ] as const) {
      for (const column of Object.values(columns)) assert.ok(rows.some(row =>
        row.table_name === table && row.column_name === column && row.is_nullable === "YES"));
    }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM candidates")).rows[0].n, 3);
    assert.equal((await pool.query("SELECT full_name FROM candidates WHERE id='talent-one'")).rows[0].full_name, "Public profile name");
  });
  it("persists all private Talent fields for the owner, preserving leading-zero last4", async () => {
    const fields = {
      legalFullName: "Fixture Legal Name", addressLine1: "Fixture line one", addressLine2: "Fixture line two",
      city: "Fixture city", stateRegion: "Fixture region", postalCode: "00123", country: "Fixture country", taxIdLast4: "0012",
    };
    const token = actor("user-one");
    const saved = await request("/api/candidates/talent-one/contract-party-details", token, fields);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, fields);
    assert.deepEqual((await request("/api/candidates/talent-one/contract-party-details", token)).body, fields);
  });
  it("denies anonymous, other Talent, Clients and Admins reads and writes", async () => {
    for (const token of [undefined, actor("user-two"), actor("client-one", "client"), actor("admin", "admin")]) {
      for (const body of [undefined, { legalFullName: "Must not save" }]) {
        const result = await request("/api/candidates/talent-one/contract-party-details", token, body);
        assert.ok([401, 403, 404].includes(result.status));
        assert.ok(!JSON.stringify(result.body).includes("Fixture line"));
      }
    }
    assert.equal((await pool.query("SELECT legal_full_name FROM candidates WHERE id='talent-one'")).rows[0].legal_full_name, "Fixture Legal Name");
  });
  it("permits verified legacy identity fallback but never overrides a stable owner link", async () => {
    assert.equal((await request("/api/candidates/legacy/contract-party-details", actor("legacy-user", "talent", "legacy@example.test"))).status, 200);
    assert.equal((await request("/api/candidates/talent-one/contract-party-details", actor("intruder", "talent", "talent-one@example.test"))).status, 404);
  });
  it("rejects full tax IDs, financial fields, excessive text and non-text values", async () => {
    for (const body of [{ taxIdLast4: "123456789" }, { taxIdLast4: "12x4" }, { taxIdLast4: 1234 },
      { legalFullName: "x".repeat(301) }, { addressLine1: {} }, { bankAccount: "not-allowed" }, { cardNumber: "not-allowed" }]) {
      assert.equal((await request("/api/candidates/talent-one/contract-party-details", actor("user-one"), body)).status, 400);
    }
    await assert.rejects(pool.query("UPDATE candidates SET tax_id_last4='123456789' WHERE id='talent-one'"), /candidates_tax_id_last4_check/);
  });
  it("clears optional fields to NULL without changing other fields or public identity", async () => {
    const result = await request("/api/candidates/talent-one/contract-party-details", actor("user-one"), { addressLine2: "", taxIdLast4: null });
    assert.equal(result.status, 200);
    assert.equal(result.body.addressLine2, null);
    assert.equal(result.body.taxIdLast4, null);
    assert.equal(result.body.legalFullName, "Fixture Legal Name");
  });
  it("saves Client party-only patches without wiping other profile fields or other Clients", async () => {
    const saved = await request("/client/profile", actor("client-one", "client"), { legalEntityName: "Fixture LLC", city: "Fixture City" });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.companyName, "Preserve company");
    assert.equal(saved.body.about, "Preserve about");
    assert.equal(saved.body.legalEntityName, "Fixture LLC");
    const cleared = await request("/client/profile", actor("client-one", "client"), { city: "" });
    assert.equal(cleared.body.city, null);
    assert.equal(cleared.body.legalEntityName, "Fixture LLC");
    assert.equal((await pool.query("SELECT legal_entity_name FROM client_profiles WHERE user_id='client-two'")).rows[0].legal_entity_name, null);
    assert.equal((await request("/client/profile", actor("client-one", "client"), { userId: "client-two" })).status, 400);
  });
  it("lets only active Organization owners change contract party details", async () => {
    assert.equal((await request("/organizations/org-one", actor("client-two", "client"), { legalEntityName: "Not owner" })).status, 403);
    const result = await request("/organizations/org-one", actor("client-one", "client"), { legalEntityName: "Fixture Org", signatoryTitle: "Fixture title" });
    assert.equal(result.status, 200);
    assert.equal(result.body.organization.name, "Preserve organization");
    assert.equal(result.body.organization.signatoryTitle, "Fixture title");
    assert.equal((await request("/organizations/org-one", actor("client-one", "client"), { createdBy: "intruder" })).status, 400);
  });
  it("removes private fields and snake-case aliases from generic candidate DTOs", () => {
    const source: Record<string, any> = { id: "fixture", fullName: "Public Profile" };
    for (const [key, column] of Object.entries(talentPartyColumns)) { source[key] = "private"; source[column] = "private"; }
    for (const sanitize of [stripTalentPartyDetails, sanitizeSearchCandidate, sanitizeFullProfileForClient]) {
      const safe = sanitize(source);
      for (const [key, column] of Object.entries(talentPartyColumns)) {
        assert.equal(key in safe, false);
        assert.equal(column in safe, false);
      }
    }
    assert.equal(source.legalFullName, "private", "redaction must not mutate the source");
    const parsed = insertCandidateSchema.parse(source) as Record<string, unknown>;
    for (const key of Object.keys(talentPartyColumns)) assert.equal(key in parsed, false, "public signup must not accept private party fields");
  });
});
