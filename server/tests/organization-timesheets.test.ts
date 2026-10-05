import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import { query, initializeFixture, closeFixture, registerRoutes } from "./fixtures/timesheetServer";
import { TIMESHEET_HIRE_SQL } from "../services/timesheetEligibility";
import { clientTeamDashboardSqlForTests } from "../lib/clientTeamDashboardHandler";

let server: Server;
let base: string;
const contracts: Record<string, string> = {};
const sessions: Record<string, string> = {};
const periodIds: Record<string, string> = {};
const roles: Record<string, string> = {
  "client-a": "client", "client-b": "client", "unrelated": "client",
  "workspace-member": "client", "workspace-owner": "client",
  "talent-one": "talent", "talent-two": "talent", "not-hired": "talent",
  "unsigned": "talent", "half-signed": "talent", "shortlisted": "talent",
  "guaranteed": "talent", "historical": "talent", "admin": "admin",
};

async function request(user: string | null, path: string, method = "GET", body?: unknown) {
  const token = user ? jwt.sign({ userId: user, role: roles[user] },
    process.env.JWT_SECRET || "dev-fallback-secret") : null;
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, json: await response.json() as any };
}

async function hire(key: string, client: string, talent: string, options: {
  status?: string; billingMode?: string; signature?: "none" | "talent"; workflow?: string; end?: string;
} = {}) {
  const mode = options.billingMode ?? "tracked";
  const job = (await query(`INSERT INTO jobs (client_id, title, time_zone, billing_mode)
    VALUES ($1, $2, 'America/New_York', $3) RETURNING id`, [client, `${key} role`, mode])).rows[0].id;
  const submission = (await query(`INSERT INTO job_submissions (job_id, client_id, talent_id, status, workflow_type)
    VALUES ($1, $2, $3, 'hired', $4) RETURNING id`,
  [job, client, talent, options.workflow ?? "client_invitation"])).rows[0].id;
  const offer = (await query(`INSERT INTO offers (submission_id, billing_mode, status)
    VALUES ($1, $2, 'accepted') RETURNING id`, [submission, mode])).rows[0].id;
  const contract = (await query(`INSERT INTO hiring_contracts
    (offer_id, submission_id, billing_mode, status, talent_signed_at, onspot_signed_at, effective_end_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
  [offer, submission, mode, options.status ?? "signed",
    options.signature === "none" ? null : new Date(), options.signature ? null : new Date(), options.end ?? null])).rows[0].id;
  contracts[key] = contract;
  return contract;
}

async function clock(key: string, talent: string, hours: number, end?: string) {
  const finish = end ? new Date(end) : new Date(Date.now() - 60_000);
  sessions[key] = (await query(`INSERT INTO clock_sessions (hiring_contract_id, talent_id, started_at, ended_at)
    VALUES ($1, $2, $3, $4) RETURNING id`,
  [contracts[key], talent, new Date(finish.getTime() - hours * 3600000), finish])).rows[0].id;
}

describe("organization-aware canonical timesheets", () => {
  before(async () => {
    await initializeFixture();
    for (const [id, role] of Object.entries(roles)) await query(`INSERT INTO users
      (id, role, first_name, last_name, company, profile_image_url, email)
      VALUES ($1::varchar, $2, $1::text, 'Fixture', $3, $4, $5)`,
    [id, role, role === "client" ? `${id} Company` : null,
      role === "talent" ? "/fixture-avatar.png" : null, `${id}@test.example`]);
    await query(`INSERT INTO organizations VALUES ('org-a', 'Workspace A'), ('org-b', 'Workspace B'),
      ('org-second', 'Second Client Workspace');
      INSERT INTO organization_members (organization_id, user_id, role, status) VALUES
        ('org-a', 'client-a', 'owner', 'active'), ('org-b', 'client-b', 'owner', 'active'),
        ('org-second', 'client-a', 'owner', 'active'),
        ('org-a', 'workspace-member', 'member', 'active'),
        ('org-a', 'workspace-owner', 'owner', 'active'),
        ('org-a', 'not-hired', 'member', 'active');`);
    await hire("a", "client-a", "talent-one");
    await hire("b", "client-b", "talent-one");
    await hire("a-other", "client-a", "talent-two");
    await hire("unsigned", "client-a", "unsigned", { status: "draft", signature: "none" });
    await hire("half-signed", "client-a", "half-signed", { signature: "talent" });
    await hire("shortlisted", "client-a", "shortlisted", { workflow: "client_shortlist" });
    await hire("guaranteed", "client-a", "guaranteed", { billingMode: "guaranteed" });
    await hire("historical", "client-a", "historical", { status: "terminated", end: "2024-03-15" });
    await clock("a", "talent-one", 2);
    await clock("b", "talent-one", 3);
    await clock("a-other", "talent-two", 1);
    await clock("historical", "historical", 1, "2024-03-14T20:00:00Z");
    // A pre-existing malformed period must not make an unsigned Talent eligible.
    for (const key of ["unsigned", "half-signed", "shortlisted"]) {
      periodIds[key] = (await query(`INSERT INTO timesheet_periods
        (hiring_contract_id, period_start, period_end, work_timezone)
        VALUES ($1, '2024-03-01', '2024-03-15', 'America/New_York') RETURNING id`,
      [contracts[key]])).rows[0].id;
    }
    const job = (await query(`INSERT INTO jobs (client_id, title) VALUES ('client-a', 'Applicant role') RETURNING id`)).rows[0].id;
    for (const status of ["new", "invited", "interview", "offer_accepted"]) {
      const submission = (await query(`INSERT INTO job_submissions
        (job_id, client_id, talent_id, status, workflow_type)
        VALUES ($1, 'client-a', 'not-hired', $2, 'client_invitation') RETURNING id`, [job, status])).rows[0].id;
      if (status === "offer_accepted") await query(`INSERT INTO offers (submission_id, status) VALUES ($1, 'accepted')`, [submission]);
    }
    const app = express(); app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  after(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeFixture();
  });

  it("requires authentication and retains role-specific routes", async () => {
    for (const role of ["talent", "client", "admin"]) {
      assert.equal((await request(null, `/api/${role}/timesheets`)).status, 401);
    }
    assert.equal((await request("client-a", "/api/talent/timesheets")).status, 403);
    assert.equal((await request("talent-one", "/api/client/timesheets")).status, 403);
    assert.equal((await request("client-a", "/api/admin/timesheets")).status, 403);
  });
  it("applications, invitations, accepted offers and account membership do not confer eligibility", async () => {
    const result = await request("not-hired", "/api/talent/timesheets");
    assert.equal(result.status, 200);
    assert.deepEqual(result.json, { periods: [], engagements: [], eligible: false, trackedEligible: false });
  });
  for (const key of ["unsigned", "half-signed", "shortlisted"]) {
    it(`${key} cannot read, submit or correct even a pre-existing period`, async () => {
      const result = await request(key, "/api/talent/timesheets");
      assert.equal(result.json.eligible, false);
      assert.deepEqual(result.json.periods, []);
      assert.equal((await request(key, `/api/talent/timesheets/${periodIds[key]}/submit`, "POST", {})).status, 404);
      assert.equal((await request(key, `/api/talent/timesheets/${periodIds[key]}/corrections`, "POST", {
        corrections: [{ sessionId: sessions.a, reason: "Fixture correction", endedAt: new Date().toISOString() }],
      })).status, 404);
    });
  }
  it("navigation eligibility is read-only and never generates periods or loads sessions", async () => {
    const before = (await query(`SELECT count(*)::int AS count FROM timesheet_periods`)).rows[0].count;
    const result = await request("talent-one", "/api/talent/timesheets?eligibilityOnly=true");
    assert.deepEqual(result.json, { eligible: true, trackedEligible: true });
    assert.equal((await query(`SELECT count(*)::int AS count FROM timesheet_periods`)).rows[0].count, before);
  });
  it("separates two legitimate Client engagements and uses Clock hours once", async () => {
    const { json } = await request("talent-one", "/api/talent/timesheets");
    assert.equal(json.eligible, true); assert.equal(json.trackedEligible, true);
    assert.deepEqual(new Set(json.engagements.map((e: any) => e.hiringContractId)), new Set([contracts.a, contracts.b]));
    assert.equal(json.periods.reduce((sum: number, p: any) => sum + p.totalHours, 0), 5);
    assert.ok(json.periods.every((p: any) => p.talentId === "talent-one"));
    const a = json.engagements.find((e: any) => e.hiringContractId === contracts.a);
    assert.deepEqual(new Set(a.organizations.map((o: any) => o.id)), new Set(["org-a", "org-second"]));
    assert.equal(json.engagements.find((e: any) => e.hiringContractId === contracts.b).organizations[0].id, "org-b");
    assert.equal(json.periods.find((p: any) => p.hiringContractId === contracts.a).sessions[0].id, sessions.a);
  });
  it("a Talent filter or contract filter never bypasses authenticated Talent ownership", async () => {
    for (const filter of [`talentId=talent-two`, `hiringContractId=${contracts["a-other"]}`, "clientId=client-a&talentId=talent-two"]) {
      assert.deepEqual((await request("talent-one", `/api/talent/timesheets?${filter}`)).json.periods, []);
    }
  });
  it("Client sees their hired Talent with safe name/avatar/job/workspace context", async () => {
    const { status, json } = await request("client-a", "/api/client/timesheets?organizationId=org-a");
    assert.equal(status, 200);
    assert.ok(json.periods.length >= 2);
    assert.ok(json.periods.every((p: any) => p.clientId === "client-a"));
    const period = json.periods.find((p: any) => p.hiringContractId === contracts.a);
    assert.equal(period.talentName, "talent-one Fixture");
    assert.equal(period.talentAvatar, "/fixture-avatar.png");
    assert.equal(period.jobTitle, "a role");
    assert.deepEqual(period.organizations.map((o: any) => o.name), ["Second Client Workspace", "Workspace A"]);
    for (const forbidden of ["email", "phone", "resume", "preferences"]) assert.ok(!(forbidden in period));
  });
  it("unrelated Client and injected Talent, Client, contract and job IDs cannot broaden scope", async () => {
    assert.deepEqual((await request("unrelated", "/api/client/timesheets?clientId=client-a")).json.periods, []);
    for (const filter of ["talentId=talent-two", `hiringContractId=${contracts["a-other"]}`]) {
      assert.deepEqual((await request("client-b", `/api/client/timesheets?${filter}`)).json.periods, []);
    }
    const otherJob = (await query(`SELECT job_id FROM job_submissions js JOIN hiring_contracts hc ON hc.submission_id = js.id WHERE hc.id = $1`, [contracts.b])).rows[0].job_id;
    assert.deepEqual((await request("client-a", `/api/client/timesheets?jobId=${otherJob}`)).json.periods, []);
  });
  it("uses existing profile photos and submission names without exposing contact data", async () => {
    await query(`UPDATE users SET first_name = NULL, last_name = NULL WHERE id = 'talent-two'`);
    await query(`UPDATE job_submissions SET applicant_name = 'Submission Talent Name' WHERE talent_id = 'talent-two'`);
    await query(`INSERT INTO profiles (user_id, profile_picture) VALUES ('talent-two', '/uploaded-profile-photo.png')`);
    const result = await request("client-a", "/api/client/timesheets?talentId=talent-two");
    assert.equal(result.json.periods[0].talentName, "Submission Talent Name");
    assert.equal(result.json.periods[0].talentAvatar, "/uploaded-profile-photo.png");
    assert.ok(!("email" in result.json.periods[0]));
  });
  it("workspace membership—including owner—is not a new payroll permission", async () => {
    for (const user of ["workspace-member", "workspace-owner"]) {
      const result = await request(user, "/api/client/timesheets?organizationId=org-a&talentId=talent-one");
      assert.equal(result.status, 200); assert.deepEqual(result.json.periods, []);
    }
    assert.equal((await request("client-a", "/api/client/timesheets?organizationId=org-b")).status, 403);
    await query(`UPDATE organization_members SET status = 'inactive' WHERE organization_id = 'org-a' AND user_id = 'client-a'`);
    assert.equal((await request("client-a", "/api/client/timesheets?organizationId=org-a")).status, 403);
    await query(`UPDATE organization_members SET status = 'active' WHERE organization_id = 'org-a' AND user_id = 'client-a'`);
  });
  it("handles malformed filter shapes without treating them as authorization or SQL", async () => {
    assert.equal((await request("client-a", "/api/client/timesheets?organizationId=org-a&organizationId=org-b")).status, 400);
    assert.equal((await request("client-a", "/api/client/timesheets?talentId=")).status, 400);
    assert.deepEqual((await request("client-a", "/api/client/timesheets?hiringContractId=not-a-uuid")).json.periods, []);
  });
  it("terminated hires retain historical periods, not invented current attendance", async () => {
    const { json } = await request("historical", "/api/talent/timesheets");
    assert.equal(json.eligible, true);
    assert.equal(json.engagements[0].contractStatus, "terminated");
    assert.equal(json.periods.length, 1);
    assert.equal(json.periods[0].periodEnd, "2024-03-15");
    assert.equal(json.periods[0].totalHours, 1);
  });
  it("Guaranteed hire is eligible context, never a zero-hour attendance timesheet", async () => {
    const { json } = await request("guaranteed", "/api/talent/timesheets");
    assert.equal(json.eligible, true); assert.equal(json.trackedEligible, false);
    assert.deepEqual(json.periods, []);
    assert.equal(json.engagements[0].billingMode, "guaranteed");
    assert.equal((await query(`SELECT count(*)::int AS count FROM timesheet_periods WHERE hiring_contract_id = $1`,
      [contracts.guaranteed])).rows[0].count, 0);
  });
  it("Clock contract selection and timesheets share the completed-hire predicate", async () => {
    const { rows } = await query(`SELECT hc.id FROM hiring_contracts hc
      JOIN job_submissions js ON js.id = hc.submission_id
      WHERE ${TIMESHEET_HIRE_SQL} AND hc.billing_mode = 'tracked'`);
    assert.ok(rows.some((row: any) => row.id === contracts.a));
    for (const key of ["unsigned", "half-signed", "shortlisted", "guaranteed"]) {
      assert.ok(!rows.some((row: any) => row.id === contracts[key]));
    }
  });
  it("real Team SQL offers the canonical link only for the current Client's completed Tracked hires", async () => {
    const owner = await query(clientTeamDashboardSqlForTests.members, ["org-a", new Date(), "client-a"]);
    assert.equal(owner.rows.find((row: any) => row.talent_id === "talent-one").can_view_timesheets, true);
    assert.equal(owner.rows.find((row: any) => row.talent_id === "guaranteed").can_view_timesheets, false);
    assert.equal(owner.rows.find((row: any) => row.talent_id === "shortlisted").can_view_timesheets, false);
    const member = await query(clientTeamDashboardSqlForTests.members, ["org-a", new Date(), "workspace-member"]);
    assert.ok(member.rows.length > 0);
    assert.ok(member.rows.every((row: any) => row.can_view_timesheets === false));
  });
  it("Admin retains canonical review visibility and Clients cannot dispute another Client's period", async () => {
    const { json } = await request("admin", "/api/admin/timesheets");
    assert.ok(json.periods.some((p: any) => p.hiringContractId === contracts.a));
    assert.ok(json.periods.some((p: any) => p.hiringContractId === contracts.b));
    const own = json.periods.find((p: any) => p.hiringContractId === contracts.a);
    assert.equal((await request("client-b", `/api/client/timesheets/${own.id}/dispute`, "POST", { reason: "Wrong owner" })).status, 404);
  });
});
