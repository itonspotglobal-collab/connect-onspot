import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";

// Disposable dependency-injected route tests: no database writes or emails.
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/test";
const { registerInvestorRoutes } = await import("../routes/investors.js");
type Request = import("../routes/investors.js").InvestorRequest;

let server: Server;
let base: string;
let saves: Request[] = [];
let emails = 0;
let failSave = false;
let deliver = true;
const lead = {
  firstName: " A ",
  email: "avery@example.org",
  requestedDocument: "deck",
  source: "investors-page",
  website: "",
};
const post = (body: unknown) => fetch(`${base}/api/public/investor-document-requests`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

before(async () => {
  const app = express();
  app.use(express.json());
  registerInvestorRoutes(app, {
    loadStats: async () => ({ contractorAccounts: 0, clientAccounts: 0, asOf: "" }),
    saveRequest: async (request) => {
      if (failSave) throw new Error("Simulated storage failure");
      saves.push(request);
      return { id: `lead-${saves.length}` };
    },
    notifyFounder: async () => { emails++; return { success: deliver }; },
    recordNotification: async () => {},
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("saves first-name document leads without inventing a firm or a download", async () => {
  const response = await post(lead);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    id: "lead-1", notificationStatus: "sent", documentAvailable: false,
  });
  assert.equal(saves[0].name, "A");
  assert.equal(saves[0].firm, "");
  assert.equal(saves[0].requestType, "deck");
  assert.equal(saves[0].source, "investors-page");
  assert.equal(saves[0].requestedDocument, "deck");
  assert.match(saves[0].message!, /OnSpot_Seed_Pitch_Deck.pptx/);
});

test("records valuation requests and honestly reports notification failure", async () => {
  deliver = false;
  const response = await post({ ...lead, requestedDocument: "valuation" });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.notificationStatus, "failed");
  assert.equal(result.documentAvailable, false);
  assert.equal(result.email, undefined);
  assert.equal(saves[1].requestType, "valuation");
  assert.equal(saves[1].requestedDocument, "valuation");
  assert.match(saves[1].message!, /OnSpot_Seedscope_Valuation_Summary.pdf/);
});

test("rejects honeypot submissions and unsupported document choices before writes", async () => {
  for (const body of [
    { ...lead, website: "https://spam.invalid" },
    { ...lead, requestedDocument: "../../private" },
  ]) {
    assert.equal((await post(body)).status, 400);
  }
  assert.equal(saves.length, 2);
  assert.equal(emails, 2);
});

test("storage failure does not report success or send email", async () => {
  failSave = true;
  const response = await post(lead);
  assert.equal(response.status, 503);
  assert.equal(emails, 2);
});

test("rate limit blocks further submissions without writes", async () => {
  assert.equal((await post(lead)).status, 429);
  assert.equal(saves.length, 2);
});
