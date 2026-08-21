/**
 * Route-level coverage for the Client organization foundation.
 *
 * Run with:
 *   npx tsx --test --test-concurrency=1 server/tests/organizations.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = Date.now();
const CLIENT_ID = `organization-client-${suffix}`;
const OTHER_CLIENT_ID = `organization-other-client-${suffix}`;
const INVITEE_ID = `organization-invitee-${suffix}`;
const TALENT_ID = `organization-talent-${suffix}`;
const ADMIN_ID = `organization-admin-${suffix}`;

const makeToken = (userId: string, role: string) =>
  jwt.sign({ userId, email: `${userId}@test.example`, role }, JWT_SECRET, { expiresIn: "1h" });

const clientToken = makeToken(CLIENT_ID, "client");
const otherClientToken = makeToken(OTHER_CLIENT_ID, "client");
const inviteeToken = makeToken(INVITEE_ID, "client");
const talentToken = makeToken(TALENT_ID, "talent");
const adminToken = makeToken(ADMIN_ID, "admin");

function request(
  server: http.Server,
  method: string,
  path: string,
  authToken?: string | null,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = JSON.parse(responseBody);
          } catch {
            // Keep the status useful when an unrelated error returns plain text.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

let server: http.Server;
let createdOrganizationId: string;

async function createFixtures() {
  await query(
    `INSERT INTO users (id, email, first_name, last_name, role)
     VALUES
       ($1, $2, 'Organization', 'Client', 'client'),
       ($3, $4, 'Other', 'Client', 'client'),
       ($5, $6, 'Invitee', 'Client', 'client'),
       ($7, $8, 'Organization', 'Talent', 'talent'),
       ($9, $10, 'Organization', 'Admin', 'admin')`,
    [
      CLIENT_ID,
      `${CLIENT_ID}@test.example`,
      OTHER_CLIENT_ID,
      `${OTHER_CLIENT_ID}@test.example`,
      INVITEE_ID,
      `${INVITEE_ID}@test.example`,
      TALENT_ID,
      `${TALENT_ID}@test.example`,
      ADMIN_ID,
      `${ADMIN_ID}@test.example`,
    ],
  );
}

async function destroyFixtures() {
  await query(`DELETE FROM organizations WHERE created_by = ANY($1::text[])`, [[CLIENT_ID, OTHER_CLIENT_ID]]).catch(() => {});
  await query(`DELETE FROM notifications WHERE user_id = ANY($1::text[])`, [[CLIENT_ID, OTHER_CLIENT_ID, INVITEE_ID, TALENT_ID, ADMIN_ID]]).catch(() => {});
  await query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[CLIENT_ID, OTHER_CLIENT_ID, INVITEE_ID, TALENT_ID, ADMIN_ID]]);
}

describe("Client organization routes", () => {
  before(async () => {
    await createFixtures();
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await destroyFixtures();
  });

  it("requires authentication and the Client role", async () => {
    const unauthenticated = await request(server, "POST", "/api/organizations", null, { name: "No access" });
    assert.equal(unauthenticated.status, 401);

    for (const [role, token] of [["talent", talentToken], ["admin", adminToken]] as const) {
      const denied = await request(server, "POST", "/api/organizations", token, { name: `${role} cannot create` });
      assert.equal(denied.status, 403, `${role} must not create an organization`);

      const listDenied = await request(server, "GET", "/api/organizations/me", token);
      assert.equal(listDenied.status, 403, `${role} must not list Client organizations`);
    }
  });

  it("rejects empty organization names without creating a row", async () => {
    const response = await request(server, "POST", "/api/organizations", clientToken, { name: "   " });
    assert.equal(response.status, 400);
    const rows = await query(
      `SELECT id FROM organizations WHERE created_by = $1 AND name = ''`,
      [CLIENT_ID],
    );
    assert.equal(rows.rows.length, 0);
  });

  it("creates the organization and owner membership atomically for a Client", async () => {
    const response = await request(server, "POST", "/api/organizations", clientToken, {
      name: "Acme Organization",
      website: "https://acme.example",
      industry: "Technology",
      companySize: "11-50",
      location: "Singapore",
      about: "A test organization.",
      timezone: "Asia/Singapore",
    });

    assert.equal(response.status, 201, JSON.stringify(response.json));
    createdOrganizationId = response.json.organization.id;
    assert.equal(response.json.organization.name, "Acme Organization");
    assert.equal(response.json.membership.role, "owner");
    assert.equal(response.json.membership.status, "active");

    const membership = await query(
      `SELECT role, status, user_id FROM organization_members
        WHERE organization_id = $1`,
      [createdOrganizationId],
    );
    assert.equal(membership.rows.length, 1);
    assert.deepEqual(membership.rows[0], {
      role: "owner",
      status: "active",
      user_id: CLIENT_ID,
    });
  });

  it("returns only the current user's active organizations and protects detail access", async () => {
    const list = await request(server, "GET", "/api/organizations/me", clientToken);
    assert.equal(list.status, 200);
    assert.equal(list.json.length, 1);
    assert.equal(list.json[0].organization.id, createdOrganizationId);
    assert.equal(list.json[0].membership.role, "owner");

    const detail = await request(server, "GET", `/api/organizations/${createdOrganizationId}`, clientToken);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.organization.id, createdOrganizationId);
    assert.equal(detail.json.organization.website, "https://acme.example");

    const otherUserDetail = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}`,
      otherClientToken,
    );
    assert.equal(otherUserDetail.status, 404);
  });

  it("keeps an independent Client account compatible with an empty organization list", async () => {
    const list = await request(server, "GET", "/api/organizations/me", otherClientToken);
    assert.equal(list.status, 200);
    assert.deepEqual(list.json, []);
  });

  it("lets owners invite Clients, lets invitees accept, and keeps administration owner-only", async () => {
    const invitation = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${INVITEE_ID}@test.example` },
    );
    assert.equal(invitation.status, 201, JSON.stringify(invitation.json));
    assert.equal(invitation.json.invitation.status, "pending");

    const ownerView = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members`,
      clientToken,
    );
    assert.equal(ownerView.status, 200);
    assert.equal(ownerView.json.canManage, true);
    assert.equal(ownerView.json.members.length, 1);
    assert.equal(ownerView.json.invitations.length, 1);

    const nonOwnerView = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members`,
      otherClientToken,
    );
    assert.equal(nonOwnerView.status, 404);

    const inviteeInvitations = await request(server, "GET", "/api/organization-invitations", inviteeToken);
    assert.equal(inviteeInvitations.status, 200);
    assert.equal(inviteeInvitations.json.length, 1);

    const accepted = await request(
      server,
      "POST",
      `/api/organization-invitations/${invitation.json.invitation.id}/respond`,
      inviteeToken,
      { action: "accept" },
    );
    assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
    assert.equal(accepted.json.membership.status, "active");

    const inviteeOrganizations = await request(server, "GET", "/api/organizations/me", inviteeToken);
    assert.equal(inviteeOrganizations.status, 200);
    assert.equal(inviteeOrganizations.json[0].organization.id, createdOrganizationId);

    const removed = await request(
      server,
      "DELETE",
      `/api/organizations/${createdOrganizationId}/members/${accepted.json.membership.id}`,
      clientToken,
    );
    assert.equal(removed.status, 200, JSON.stringify(removed.json));

    const afterRemoval = await request(server, "GET", "/api/organizations/me", inviteeToken);
    assert.deepEqual(afterRemoval.json, []);
  });

  it("allows an owner to revoke a pending invitation", async () => {
    const invitation = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: "not-yet-registered@example.test" },
    );
    assert.equal(invitation.status, 201);

    const revoked = await request(
      server,
      "DELETE",
      `/api/organizations/${createdOrganizationId}/invitations/${invitation.json.invitation.id}`,
      clientToken,
    );
    assert.equal(revoked.status, 200);

    const ownerView = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members`,
      clientToken,
    );
    assert.equal(ownerView.json.invitations[0].status, "revoked");
  });

  it("rolls back the organization when owner membership creation fails", async () => {
    const triggerName = `organization_test_failure_${suffix}`;
    const functionName = `${triggerName}_fn`;
    await query(`
      CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'intentional organization membership failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await query(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON organization_members
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()
    `);

    const name = "Should Roll Back";
    try {
      const response = await request(server, "POST", "/api/organizations", clientToken, { name });
      assert.equal(response.status, 500);
      const rows = await query(
        `SELECT id FROM organizations WHERE created_by = $1 AND name = $2`,
        [CLIENT_ID, name],
      );
      assert.equal(rows.rows.length, 0, "organization insert must roll back with membership failure");
    } finally {
      await query(`DROP TRIGGER IF EXISTS ${triggerName} ON organization_members`).catch(() => {});
      await query(`DROP FUNCTION IF EXISTS ${functionName}()`).catch(() => {});
    }
  });
});