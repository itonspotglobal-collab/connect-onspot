import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "node:http";

// Disposable dependency-injected route tests: no database writes or emails.
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:1/test";
const { registerInvestorRoutes, investorDocumentRequestSchema, investorRequestSchema, notifyFounders,
  INVESTOR_NOTIFICATION_RECIPIENTS } = await import("../routes/investors.js");
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
  phone: " +1 (555) 123-4567 ",
  inquiry: " How can I meet the founders? ",
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
    notifyFounders: async (_request, saved) => {
      assert.match(saved.id, /^lead-/);
      assert.ok(saved.createdAt instanceof Date);
      emails++; return { success: deliver };
    },
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
  assert.equal(saves[0].phone, "+1 (555) 123-4567");
  assert.equal(saves[0].inquiry, "How can I meet the founders?");
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

test("phone validation matches the contact contract and inquiry is optional", () => {
  for (const phone of [undefined, "", "123456", "+1 abc 1234567", ".......", "+1 123 456 789 012 345 678"]) {
    assert.equal(investorDocumentRequestSchema.safeParse({ ...lead, phone }).success, false);
  }
  for (const phone of ["1234567", "+1 (555) 123-4567", "+63.917.123.4567"]) {
    const result = investorDocumentRequestSchema.safeParse({ ...lead, phone, inquiry: undefined });
    assert.equal(result.success, true);
  }
  assert.equal(investorDocumentRequestSchema.safeParse({ ...lead, inquiry: "x".repeat(1501) }).success, false);
  assert.equal(investorDocumentRequestSchema.safeParse({ ...lead, recipients: ["attacker@example.org"] }).success, false);
  assert.equal(investorRequestSchema.safeParse({
    name: "Investor", firm: "Firm", email: lead.email, requestType: "meeting",
  }).success, true);
  assert.equal(investorRequestSchema.safeParse({
    name: "Investor", firm: "Firm", email: lead.email, requestType: "meeting", phone: "invalid",
  }).success, false);
});

test("invalid phone and oversized inquiry return 400 before saving", async () => {
  const app = express();
  app.use(express.json());
  let writes = 0;
  registerInvestorRoutes(app, {
    loadStats: async () => ({ contractorAccounts: 0, clientAccounts: 0, asOf: "" }),
    saveRequest: async () => { writes++; return { id: "should-not-save" }; },
    notifyFounders: async () => { throw new Error("should not notify"); },
    recordNotification: async () => {},
  });
  const isolated = app.listen(0);
  await new Promise<void>(resolve => isolated.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${(isolated.address() as { port: number }).port}/api/public/investor-document-requests`;
    for (const body of [{ ...lead, phone: undefined }, { ...lead, phone: "invalid" },
      { ...lead, inquiry: "x".repeat(1501) }]) {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /contact number/);
    }
    assert.equal(writes, 0);
  } finally { await new Promise<void>(resolve => isolated.close(() => resolve())); }
});

test("optional inquiry may be omitted and notification recording failures never invite a duplicate", async () => {
  const app = express();
  app.use(express.json());
  const order: string[] = [];
  registerInvestorRoutes(app, {
    loadStats: async () => ({ contractorAccounts: 0, clientAccounts: 0, asOf: "" }),
    saveRequest: async request => {
      order.push("save");
      assert.equal(request.inquiry, undefined);
      assert.equal(request.phone, "+1 (555) 123-4567");
      return { id: "saved-optional", createdAt: new Date("2026-11-03T00:00:00Z") };
    },
    notifyFounders: async (_request, saved) => {
      order.push("notify");
      assert.equal(saved.id, "saved-optional");
      assert.equal(saved.createdAt.toISOString(), "2026-11-03T00:00:00.000Z");
      return { success: true };
    },
    recordNotification: async () => { order.push("record"); throw new Error("Simulated ledger failure"); },
  });
  const isolated = app.listen(0);
  await new Promise<void>(resolve => isolated.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(isolated.address() as { port: number }).port}/api/public/investor-document-requests`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, inquiry: undefined }) });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { id: "saved-optional", notificationStatus: "sent", documentAvailable: false });
    assert.deepEqual(order, ["save", "notify", "record"]);
  } finally { await new Promise<void>(resolve => isolated.close(() => resolve())); }
});

test("one founder email uses the investors sender, reference, timestamps and escaped fields", async () => {
  const priorSender = process.env.INVESTORS_EMAIL;
  const priorTo = process.env.INVESTOR_NOTIFICATION_TO;
  delete process.env.INVESTORS_EMAIL;
  delete process.env.INVESTOR_NOTIFICATION_TO;
  try {
    const calls: import("../services/microsoftGraphEmailService.js").SendEmailOptions[] = [];
    const send = async (options: typeof calls[number]) => { calls.push(options); return { success: true }; };
    const request: Request = {
      name: 'Avery <script>"', firm: "", email: lead.email, phone: "+1 (555) 123-4567",
      requestType: "deck", requestedDocument: "deck", inquiry: '<img src=x>\n"hello"&',
    };
    const saved = { id: "ref<&", createdAt: new Date("2026-11-03T00:00:00Z") };
    assert.equal((await notifyFounders(request, saved, send)).success, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].to, INVESTOR_NOTIFICATION_RECIPIENTS);
    assert.deepEqual((calls[0].to as { address: string }[]).map(r => r.address),
      ["nur@onspotglobal.com", "Jake@onspotglobal.com", "Mark.Apostol@onspotglobal.com"]);
    assert.equal(calls[0].senderEmail, "investors@onspotglobal.com");
    assert.equal(calls[0].replyTo, lead.email);
    assert.ok(!calls[0].bodyHtml.includes(lead.email), "contact email belongs in Reply-To, not the notification body");
    assert.doesNotMatch(calls[0].bodyHtml, /mailto:|>Email<\/th>/);
    assert.equal(calls[0].subject, "Investor request: Pitch deck from Avery");
    assert.match(calls[0].bodyHtml, /&lt;img src=x&gt;<br>/);
    assert.match(calls[0].bodyHtml, /href="tel:\+15551234567"/);
    assert.match(calls[0].bodyHtml, /Asia\/Manila/);
    assert.match(calls[0].bodyHtml, /2026-11-03T00:00:00.000Z/);
    assert.match(calls[0].bodyHtml, /ref&lt;&amp;/);
    assert.doesNotMatch(calls[0].bodyHtml, /<script>|<img/);

    process.env.INVESTOR_NOTIFICATION_TO = "uat@example.org, second@example.org";
    process.env.INVESTORS_EMAIL = "findwork@onspotglobal.com";
    await notifyFounders({ ...request, inquiry: undefined }, saved, send);
    assert.deepEqual(calls[1].to, [{ address: "uat@example.org" }, { address: "second@example.org" }]);
    assert.equal(calls[1].senderEmail, "findwork@onspotglobal.com");
    assert.match(calls[1].bodyHtml, /None provided/);

    process.env.INVESTORS_EMAIL = "not-allowed@example.org";
    assert.deepEqual(await notifyFounders(request, saved, send),
      { success: false, error: "Investor sender mailbox is not allowlisted" });
    assert.equal(calls.length, 2, "invalid sender must not reach the service fallback");
    process.env.INVESTORS_EMAIL = "investors@onspotglobal.com";
    process.env.INVESTOR_NOTIFICATION_TO = "";
    assert.equal((await notifyFounders(request, saved, send)).success, false);
    assert.equal(calls.length, 2);
  } finally {
    if (priorSender === undefined) delete process.env.INVESTORS_EMAIL; else process.env.INVESTORS_EMAIL = priorSender;
    if (priorTo === undefined) delete process.env.INVESTOR_NOTIFICATION_TO; else process.env.INVESTOR_NOTIFICATION_TO = priorTo;
  }
});
