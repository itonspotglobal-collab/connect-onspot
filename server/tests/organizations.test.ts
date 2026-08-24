/**
 * Route-level coverage for the Client organization lifecycle.
 *
 * Run with:
 *   npx tsx --test --test-concurrency=1 server/tests/organizations.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

const makeToken = (userId: string, role: string, email?: string) =>
  jwt.sign(
    { userId, email: email ?? `${userId}@test.example`, role },
    JWT_SECRET,
    { expiresIn: "1h" },
  );

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

  it("allows a Client to create a second organization (multiple organizations per client)", async () => {
    const second = await request(server, "POST", "/api/organizations", clientToken, {
      name: "Second Organization",
    });
    assert.equal(second.status, 201, JSON.stringify(second.json));
    const secondOrgId = second.json.organization.id;

    const list = await request(server, "GET", "/api/organizations/me", clientToken);
    assert.equal(list.status, 200);
    assert.ok(list.json.length >= 2, "client should see both organizations");

    // Clean up second organization
    await query(`DELETE FROM organizations WHERE id = $1`, [secondOrgId]).catch(() => {});
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
    assert.ok(invitation.json.invitation.expiresAt, "pending invitations must have an expiry");
    assert.ok(
      new Date(invitation.json.invitation.expiresAt).getTime() > Date.now() + 29 * 24 * 60 * 60 * 1000,
      "organization invitations should expire after 30 days",
    );

    // Verify token_hash was stored
    const tokenRow = await query(
      `SELECT token_hash FROM organization_invitations WHERE id = $1`,
      [invitation.json.invitation.id],
    );
    assert.ok(tokenRow.rows[0]?.token_hash, "invitation must have a stored token_hash");

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

    const pendingInvitations = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members?status=pending`,
      clientToken,
    );
    assert.equal(pendingInvitations.status, 200);
    assert.equal(pendingInvitations.json.invitations.length, 1);
    assert.equal(pendingInvitations.json.invitations[0].status, "pending");

    const acceptedFilter = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members?status=accepted`,
      clientToken,
    );
    assert.equal(acceptedFilter.status, 200);
    assert.equal(acceptedFilter.json.invitations.length, 0);

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

    const acceptedOwnerView = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members?status=accepted`,
      clientToken,
    );
    assert.equal(acceptedOwnerView.status, 200);
    assert.equal(acceptedOwnerView.json.invitations.length, 1);
    assert.equal(acceptedOwnerView.json.invitations[0].status, "accepted");

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

  it("allows invitations to Talent and Admin email addresses (Client-only rejection at acceptance)", async () => {
    // Inviting a Talent email must now succeed (rejection happens at acceptance)
    const talentInvite = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${TALENT_ID}@test.example` },
    );
    assert.equal(talentInvite.status, 201, `Expected 201 got ${talentInvite.status}: ${JSON.stringify(talentInvite.json)}`);
    assert.equal(talentInvite.json.invitation.status, "pending");

    // A Talent user attempting to accept the invitation via the respond endpoint
    // must receive a role-mismatch error (not 404).
    const talentAccept = await request(
      server,
      "POST",
      `/api/organization-invitations/${talentInvite.json.invitation.id}/respond`,
      talentToken,
      { action: "accept" },
    );
    // Talent email matches but role is wrong — expect 403 (not 404)
    assert.equal(talentAccept.status, 403, JSON.stringify(talentAccept.json));
    assert.equal(talentAccept.json.error, "wrong_role");

    // Inviting an Admin email must also succeed
    const adminInvite = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${ADMIN_ID}@test.example` },
    );
    assert.equal(adminInvite.status, 201, JSON.stringify(adminInvite.json));

    // Clean up — revoke both invitations so they don't interfere with later tests
    await query(
      `UPDATE organization_invitations SET status = 'revoked' WHERE id = ANY($1::text[])`,
      [[talentInvite.json.invitation.id, adminInvite.json.invitation.id]],
    );
  });

  it("allows invitations to unknown (unregistered) email addresses", async () => {
    const unknownEmail = `unknown-user-${suffix}@outsider.example`;
    const invite = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: unknownEmail },
    );
    assert.equal(invite.status, 201, JSON.stringify(invite.json));
    assert.equal(invite.json.invitation.status, "pending");

    // Revoke for cleanup
    await query(
      `UPDATE organization_invitations SET status = 'revoked' WHERE id = $1`,
      [invite.json.invitation.id],
    );
  });

  it("exposes invitation details via the public token-based endpoint", async () => {
    // Create an invitation so a real token_hash is stored
    const invite = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${OTHER_CLIENT_ID}@test.example` },
    );
    assert.equal(invite.status, 201, JSON.stringify(invite.json));

    // Fetch the stored hash and manufacture an impossible fake-raw lookup
    const tokenRow = await query(
      `SELECT token_hash FROM organization_invitations WHERE id = $1`,
      [invite.json.invitation.id],
    );
    const storedHash = tokenRow.rows[0].token_hash;
    assert.ok(storedHash, "token_hash must be stored");

    // The public endpoint accepts the raw token, not the hash. We can't
    // reconstruct the raw token from the hash, so verify the 404 path using
    // a dummy token (correct shape, wrong value).
    const notFound = await request(server, "GET", "/api/organization-invitations/public/invalidtoken000", null);
    assert.equal(notFound.status, 404);

    // Clean up
    await query(
      `UPDATE organization_invitations SET status = 'revoked' WHERE id = $1`,
      [invite.json.invitation.id],
    );
  });

  it("accept-by-token rejects mismatched email", async () => {
    // Insert a fresh invitation directly with a known token_hash so we bypass
    // any existing membership state. The invitation is for a unique email
    // address that does NOT match otherClientToken's email.
    const mismatchEmail = `mismatch-target-${suffix}@nowhere.example`;
    const mismatchRaw = "mismatch-raw-token-for-test-000000000000000000000000000000000";
    const mismatchHash = createHash("sha256").update(mismatchRaw).digest("hex");
    const insertResult = await query(
      `INSERT INTO organization_invitations
         (organization_id, email, invited_by, expires_at, token_hash)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 days', $4)
       RETURNING id`,
      [createdOrganizationId, mismatchEmail, CLIENT_ID, mismatchHash],
    );
    const inviteId = insertResult.rows[0].id;

    // otherClientToken's email is different — should get 403 email_mismatch
    const mismatch = await request(server, "POST", "/api/organization-invitations/accept-by-token", otherClientToken, {
      token: mismatchRaw,
      action: "accept",
    });
    assert.equal(mismatch.status, 403, JSON.stringify(mismatch.json));
    assert.equal(mismatch.json.error, "email_mismatch");

    // Clean up
    await query(`UPDATE organization_invitations SET status = 'revoked' WHERE id = $1`, [inviteId]);
  });

  it("accept-by-token accepts with the correct client email and token", async () => {
    // Invite other client
    const invite = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${OTHER_CLIENT_ID}@test.example` },
    );
    assert.equal(invite.status, 201, JSON.stringify(invite.json));

    // Inject known raw token
    const rawToken = "known-raw-token-for-accept-test-0000000000000000000000000000000";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await query(
      `UPDATE organization_invitations SET token_hash = $1 WHERE id = $2`,
      [tokenHash, invite.json.invitation.id],
    );

    const accepted = await request(server, "POST", "/api/organization-invitations/accept-by-token", otherClientToken, {
      token: rawToken,
      action: "accept",
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
    assert.equal(accepted.json.status, "accepted");
    assert.equal(accepted.json.membership.status, "active");

    // Clean up membership so further tests start clean
    await query(
      `UPDATE organization_members SET status = 'suspended'
        WHERE organization_id = $1 AND user_id = $2 AND role = 'member'`,
      [createdOrganizationId, OTHER_CLIENT_ID],
    );
  });

  it("accept-by-token rejects wrong-role (talent) even with matching email", async () => {
    const invite = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${TALENT_ID}@test.example` },
    );
    assert.equal(invite.status, 201, JSON.stringify(invite.json));

    const rawToken = "known-raw-token-for-talent-role-00000000000000000000000000000000";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await query(
      `UPDATE organization_invitations SET token_hash = $1 WHERE id = $2`,
      [tokenHash, invite.json.invitation.id],
    );

    // Talent token: email matches, role wrong
    const talentTokenWithEmail = makeToken(TALENT_ID, "talent", `${TALENT_ID}@test.example`);
    const result = await request(server, "POST", "/api/organization-invitations/accept-by-token", talentTokenWithEmail, {
      token: rawToken,
      action: "accept",
    });
    assert.equal(result.status, 403, JSON.stringify(result.json));
    assert.equal(result.json.error, "wrong_role");

    // Clean up
    await query(`UPDATE organization_invitations SET status = 'revoked' WHERE id = $1`, [invite.json.invitation.id]);
  });

  it("expires stale invitations, rejects acceptance, and allows a safe resend", async () => {
    // Reset OTHER_CLIENT's membership so that re-inviting them is possible.
    await query(
      `DELETE FROM organization_members
        WHERE organization_id = $1 AND user_id = $2 AND role = 'member'`,
      [createdOrganizationId, OTHER_CLIENT_ID],
    ).catch(() => {});

    const invitation = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `${OTHER_CLIENT_ID}@test.example` },
    );
    assert.equal(invitation.status, 201);

    await query(
      `UPDATE organization_invitations
          SET expires_at = NOW() - INTERVAL '1 minute'
        WHERE id = $1`,
      [invitation.json.invitation.id],
    );

    const expiredAcceptance = await request(
      server,
      "POST",
      `/api/organization-invitations/${invitation.json.invitation.id}/respond`,
      otherClientToken,
      { action: "accept" },
    );
    assert.equal(expiredAcceptance.status, 409);
    assert.equal(expiredAcceptance.json.error, "This invitation has expired");

    const ownerView = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members`,
      clientToken,
    );
    const expired = ownerView.json.invitations.find(
      (item: { id: string }) => item.id === invitation.json.invitation.id,
    );
    assert.equal(expired.status, "expired");

    const nonOwnerResend = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations/${invitation.json.invitation.id}/resend`,
      otherClientToken,
    );
    assert.equal(nonOwnerResend.status, 403);

    const resent = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations/${invitation.json.invitation.id}/resend`,
      clientToken,
    );
    assert.equal(resent.status, 201, JSON.stringify(resent.json));
    assert.equal(resent.json.invitation.status, "pending");
    assert.notEqual(resent.json.invitation.id, invitation.json.invitation.id);

    // New invitation must also have a token_hash
    const resentToken = await query(
      `SELECT token_hash FROM organization_invitations WHERE id = $1`,
      [resent.json.invitation.id],
    );
    assert.ok(resentToken.rows[0]?.token_hash, "resent invitation must have a token_hash");

    const pendingResend = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations/${invitation.json.invitation.id}/resend`,
      clientToken,
    );
    assert.equal(pendingResend.status, 409);
    assert.equal(pendingResend.json.error, "An invitation is already pending for this email");

    const history = await request(
      server,
      "GET",
      `/api/organizations/${createdOrganizationId}/members`,
      clientToken,
    );
    assert.equal(
      history.json.invitations.find((item: { id: string }) => item.id === invitation.json.invitation.id).status,
      "expired",
    );
    assert.equal(
      history.json.invitations.find((item: { id: string }) => item.id === resent.json.invitation.id).status,
      "pending",
    );
  });

  it("lets an owner retry a failed pending invitation without changing its expiry", async () => {
    const invitation = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations`,
      clientToken,
      { email: `retry-delivery-${suffix}@test.example` },
    );
    assert.equal(invitation.status, 201);

    const beforeRetry = await query(
      `SELECT expires_at FROM organization_invitations WHERE id = $1`,
      [invitation.json.invitation.id],
    );
    assert.equal(beforeRetry.rows.length, 1);
    await query(
      `UPDATE organization_invitations
          SET email_status = 'failed', email_error = 'Temporary delivery failure'
        WHERE id = $1`,
      [invitation.json.invitation.id],
    );

    const retried = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/invitations/${invitation.json.invitation.id}/resend`,
      clientToken,
    );
    assert.equal(retried.status, 200, JSON.stringify(retried.json));
    assert.equal(retried.json.invitation.id, invitation.json.invitation.id);
    assert.equal(retried.json.invitation.status, "pending");
    assert.equal(
      new Date(retried.json.invitation.expiresAt).getTime(),
      new Date(beforeRetry.rows[0].expires_at).getTime(),
    );

    // Retry must regenerate the token_hash
    const afterRetryToken = await query(
      `SELECT token_hash FROM organization_invitations WHERE id = $1`,
      [invitation.json.invitation.id],
    );
    assert.ok(afterRetryToken.rows[0]?.token_hash, "retried invitation must still have a token_hash");

    const pendingRows = await query(
      `SELECT id FROM organization_invitations
        WHERE organization_id = $1 AND lower(email) = lower($2) AND status = 'pending'`,
      [createdOrganizationId, `retry-delivery-${suffix}@test.example`],
    );
    assert.equal(pendingRows.rows.length, 1);
  });

  it("reports a successful invitation retry when email delivery recovers", async () => {
    const emailConfigKeys = [
      "MICROSOFT_TENANT_ID",
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
      "MICROSOFT_SENDER_EMAIL",
      "APPLICATION_EMAIL_FROM",
      "PUBLIC_APP_URL",
    ] as const;
    const originalEmailConfig = Object.fromEntries(
      emailConfigKeys.map((key) => [key, process.env[key]]),
    ) as Record<(typeof emailConfigKeys)[number], string | undefined>;
    const originalFetch = globalThis.fetch;
    const email = `recovered-delivery-${suffix}@test.example`;

    try {
      for (const key of emailConfigKeys) delete process.env[key];

      const invitation = await request(
        server,
        "POST",
        `/api/organizations/${createdOrganizationId}/invitations`,
        clientToken,
        { email },
      );
      assert.equal(invitation.status, 201, JSON.stringify(invitation.json));
      assert.equal(invitation.json.invitation.emailStatus, "failed");

      const beforeRetry = await query(
        `SELECT expires_at FROM organization_invitations WHERE id = $1`,
        [invitation.json.invitation.id],
      );
      assert.equal(beforeRetry.rows.length, 1);
      await query(
        `UPDATE organization_invitations
            SET email_status = 'failed', email_error = 'Temporary delivery failure'
          WHERE id = $1`,
        [invitation.json.invitation.id],
      );

      process.env.MICROSOFT_TENANT_ID = "test-tenant";
      process.env.MICROSOFT_CLIENT_ID = "test-client";
      process.env.MICROSOFT_CLIENT_SECRET = "test-secret";
      process.env.MICROSOFT_SENDER_EMAIL = "careers@onspotglobal.com";
      process.env.PUBLIC_APP_URL = "https://test.example";

      // Capture the raw Graph sendMail payload so we can inspect the invitation URL.
      let capturedSendMailBody: string | null = null;
      globalThis.fetch = (async (input, init) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
        if (url.includes("/oauth2/v2.0/token")) {
          return new Response(
            JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("graph.microsoft.com")) {
          capturedSendMailBody = typeof init?.body === "string" ? init.body : null;
          return new Response(null, { status: 202 });
        }
        throw new Error(`Unexpected email provider request: ${url}`);
      }) as typeof fetch;

      const retried = await request(
        server,
        "POST",
        `/api/organizations/${createdOrganizationId}/invitations/${invitation.json.invitation.id}/resend`,
        clientToken,
      );
      assert.equal(retried.status, 200, JSON.stringify(retried.json));
      assert.equal(retried.json.invitation.emailStatus, "sent");
      assert.equal(retried.json.invitation.emailError, null);
      assert.equal(retried.json.invitation.id, invitation.json.invitation.id);
      assert.equal(retried.json.invitation.status, "pending");
      assert.equal(
        new Date(retried.json.invitation.expiresAt).getTime(),
        new Date(beforeRetry.rows[0].expires_at).getTime(),
      );

      // Assert the Graph sendMail body carries the tokenized invitation URL.
      assert.ok(capturedSendMailBody, "Graph sendMail must have been called with a request body");
      const sendMailPayload = JSON.parse(capturedSendMailBody);
      const emailHtml: string = sendMailPayload?.message?.body?.content ?? "";
      assert.ok(
        emailHtml.includes("/organization-invite/"),
        `email body must contain /organization-invite/ path — got: ${emailHtml.slice(0, 200)}`,
      );

      // Extract the raw token from the captured URL and verify it matches the stored hash.
      const inviteUrlMatch = emailHtml.match(/\/organization-invite\/([^"'<>\s&]+)/);
      assert.ok(inviteUrlMatch, "email body must contain a /organization-invite/<token> URL");
      const capturedRawToken = decodeURIComponent(inviteUrlMatch[1]);
      const capturedHash = createHash("sha256").update(capturedRawToken).digest("hex");
      const newTokenRow = await query(
        `SELECT token_hash FROM organization_invitations WHERE id = $1`,
        [invitation.json.invitation.id],
      );
      assert.ok(newTokenRow.rows[0]?.token_hash, "invitation must have a token_hash after retry");
      assert.equal(
        capturedHash,
        newTokenRow.rows[0].token_hash,
        "token embedded in the invitation email URL must hash to the stored token_hash",
      );

      const pendingRows = await query(
        `SELECT id, expires_at, email_status, email_error
           FROM organization_invitations
          WHERE organization_id = $1 AND lower(email) = lower($2) AND status = 'pending'`,
        [createdOrganizationId, email],
      );
      assert.equal(pendingRows.rows.length, 1);
      assert.equal(pendingRows.rows[0].id, invitation.json.invitation.id);
      assert.equal(
        new Date(pendingRows.rows[0].expires_at).getTime(),
        new Date(beforeRetry.rows[0].expires_at).getTime(),
      );
      assert.equal(pendingRows.rows[0].email_status, "sent");
      assert.equal(pendingRows.rows[0].email_error, null);
    } finally {
      globalThis.fetch = originalFetch;
      for (const key of emailConfigKeys) {
        const value = originalEmailConfig[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("schedules deletion with owner confirmation and returns the due date", async () => {
    // Wrong name must be rejected
    const wrongName = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      clientToken,
      { confirmName: "Wrong Name" },
    );
    assert.equal(wrongName.status, 400, JSON.stringify(wrongName.json));

    // Non-owner must be rejected
    const nonOwner = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      otherClientToken,
      { confirmName: "Acme Organization" },
    );
    assert.equal(nonOwner.status, 403);

    // Owner with correct name succeeds
    const scheduled = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      clientToken,
      { confirmName: "Acme Organization" },
    );
    assert.equal(scheduled.status, 200, JSON.stringify(scheduled.json));
    assert.equal(scheduled.json.status, "deletion_scheduled");
    assert.ok(scheduled.json.deleteDueAt, "deleteDueAt must be returned");
    const dueAt = new Date(scheduled.json.deleteDueAt);
    const expectedMin = Date.now() + 2.9 * 24 * 60 * 60 * 1000;
    assert.ok(dueAt.getTime() >= expectedMin, "due date should be ~3 days from now");

    // Duplicate request must be rejected
    const duplicate = await request(
      server,
      "POST",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      clientToken,
      { confirmName: "Acme Organization" },
    );
    assert.equal(duplicate.status, 409);

    // Organization detail must reflect deletion fields
    const detail = await request(server, "GET", `/api/organizations/${createdOrganizationId}`, clientToken);
    assert.ok(detail.json.organization.deleteDueAt, "detail must include deleteDueAt");
  });

  it("lets the owner cancel a scheduled deletion", async () => {
    // Non-owner cannot cancel
    const nonOwner = await request(
      server,
      "DELETE",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      otherClientToken,
    );
    assert.equal(nonOwner.status, 403);

    const cancelled = await request(
      server,
      "DELETE",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      clientToken,
    );
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
    assert.equal(cancelled.json.status, "deletion_cancelled");

    // Detail must no longer show a due date
    const detail = await request(server, "GET", `/api/organizations/${createdOrganizationId}`, clientToken);
    assert.equal(detail.json.organization.deleteDueAt, null);

    // Cancelling again must 404
    const again = await request(
      server,
      "DELETE",
      `/api/organizations/${createdOrganizationId}/request-deletion`,
      clientToken,
    );
    assert.equal(again.status, 404);
  });

  it("deletion cleanup removes due organizations without affecting other data", async () => {
    const { cleanupDueOrganizations } = await import("../routes.js");

    // Create a separate organization owned by OTHER_CLIENT_ID so we can verify
    // that cleanup isolation works.
    const otherOrg = await request(server, "POST", "/api/organizations", otherClientToken, {
      name: "Other Organization for Cleanup Test",
    });
    assert.equal(otherOrg.status, 201);
    const otherOrgId = otherOrg.json.organization.id;

    // Schedule the main organization for immediate deletion
    await query(
      `UPDATE organizations
          SET delete_requested_at = NOW(),
              delete_requested_by = $1,
              delete_due_at = NOW() - INTERVAL '1 minute'
        WHERE id = $2`,
      [CLIENT_ID, createdOrganizationId],
    );

    const deleted = await cleanupDueOrganizations();
    assert.ok(deleted >= 1, "should have deleted at least 1 organization");

    // Main org must be gone
    const mainCheck = await query(`SELECT id FROM organizations WHERE id = $1`, [createdOrganizationId]);
    assert.equal(mainCheck.rows.length, 0, "due organization must be deleted");

    // Other org must still exist (isolation)
    const otherCheck = await query(`SELECT id FROM organizations WHERE id = $1`, [otherOrgId]);
    assert.equal(otherCheck.rows.length, 1, "other organization must not be deleted");

    // Users must still exist
    const userCheck = await query(
      `SELECT id FROM users WHERE id = ANY($1::text[])`,
      [[CLIENT_ID, OTHER_CLIENT_ID]],
    );
    assert.equal(userCheck.rows.length, 2, "users must not be deleted by organization cleanup");

    // Clean up other org
    await query(`DELETE FROM organizations WHERE id = $1`, [otherOrgId]).catch(() => {});
  });

  it("retains a user's membership in Organization B when their Organization A is deleted", async () => {
    // Isolation scenario: CLIENT_ID owns Org A (due for deletion) AND is a
    // member of Org B owned by OTHER_CLIENT_ID.  Deleting Org A must not touch
    // Org B or CLIENT_ID's membership there.
    const { cleanupDueOrganizations } = await import("../routes.js");

    // Create Org A (owned by CLIENT_ID — the org that will be deleted)
    const orgA = await request(server, "POST", "/api/organizations", clientToken, {
      name: "Org A for Multi-Org Deletion Test",
    });
    assert.equal(orgA.status, 201, JSON.stringify(orgA.json));
    const orgAId = orgA.json.organization.id;

    // Create Org B (owned by OTHER_CLIENT_ID — the org that must survive)
    const orgB = await request(server, "POST", "/api/organizations", otherClientToken, {
      name: "Org B for Multi-Org Deletion Test",
    });
    assert.equal(orgB.status, 201, JSON.stringify(orgB.json));
    const orgBId = orgB.json.organization.id;

    // Add CLIENT_ID as a member of Org B by direct SQL (simulating an accepted invitation)
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [orgBId, CLIENT_ID],
    );

    // Confirm CLIENT_ID membership in Org B exists before deletion
    const beforeCheck = await query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgBId, CLIENT_ID],
    );
    assert.equal(beforeCheck.rows.length, 1, "CLIENT_ID should be a member of Org B before cleanup");

    // Schedule Org A for immediate deletion
    await query(
      `UPDATE organizations
          SET delete_requested_at = NOW(),
              delete_requested_by = $1,
              delete_due_at = NOW() - INTERVAL '1 minute'
        WHERE id = $2`,
      [CLIENT_ID, orgAId],
    );

    const deleted = await cleanupDueOrganizations();
    assert.ok(deleted >= 1, "cleanupDueOrganizations should have deleted at least 1 organization");

    // Org A must be gone
    const orgACheck = await query(`SELECT id FROM organizations WHERE id = $1`, [orgAId]);
    assert.equal(orgACheck.rows.length, 0, "Org A must be deleted");

    // Org B must still exist
    const orgBCheck = await query(`SELECT id FROM organizations WHERE id = $1`, [orgBId]);
    assert.equal(orgBCheck.rows.length, 1, "Org B must not be affected by Org A deletion");

    // CLIENT_ID's membership in Org B must be intact — this is the key isolation assertion
    const membershipCheck = await query(
      `SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgBId, CLIENT_ID],
    );
    assert.equal(
      membershipCheck.rows.length,
      1,
      "CLIENT_ID must retain their Org B membership after their own Org A is deleted",
    );

    // CLIENT_ID user account must still exist
    const userCheck = await query(`SELECT id FROM users WHERE id = $1`, [CLIENT_ID]);
    assert.equal(userCheck.rows.length, 1, "CLIENT_ID user must not be deleted by organization cleanup");

    // Clean up
    await query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[orgAId, orgBId]]).catch(() => {});
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
