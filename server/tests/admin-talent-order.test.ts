/**
 * Regression coverage for the deterministic ordering of the admin talent list.
 *
 * The endpoint sorts by Vetted status when requested, then by user creation
 * time descending, and finally by user ID descending. The final tie-break is
 * important because several talent accounts can share the same timestamp.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { registerRoutes } from "../routes.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-secret";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const SEARCH_TERM = `admin-talent-order-${suffix}`;
const ADMIN_ID = `${SEARCH_TERM}-admin`;
const CREATED_AT = "2026-08-20T12:00:00.000Z";

const talentFixtures = [
  { id: `${SEARCH_TERM}-vetted-a`, candidateId: `${SEARCH_TERM}-candidate-vetted-a`, isVetted: true },
  { id: `${SEARCH_TERM}-vetted-b`, candidateId: `${SEARCH_TERM}-candidate-vetted-b`, isVetted: true },
  { id: `${SEARCH_TERM}-unvetted-a`, candidateId: `${SEARCH_TERM}-candidate-unvetted-a`, isVetted: false },
  { id: `${SEARCH_TERM}-unvetted-b`, candidateId: `${SEARCH_TERM}-candidate-unvetted-b`, isVetted: false },
];

const adminToken = jwt.sign(
  { userId: ADMIN_ID, email: `${ADMIN_ID}@onspotglobal.com`, role: "admin" },
  JWT_SECRET,
  { expiresIn: "1h" },
);

let server: http.Server;

function request(path: string): Promise<{ status: number; json: any }> {
  const { port } = server.address() as { port: number };
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "GET",
        path,
        headers: { Authorization: `Bearer ${adminToken}` },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => (responseBody += chunk));
        res.on("end", () => {
          let json: any = null;
          try {
            json = JSON.parse(responseBody);
          } catch {
            // Keep the status assertion useful if an unexpected plain-text
            // response is returned.
          }
          resolve({ status: res.statusCode ?? 0, json });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function createFixtures(): Promise<void> {
  await query(
    `INSERT INTO users (id, email, first_name, last_name, role, created_at)
     VALUES
       ($1, $2, 'Admin', 'Order Test', 'admin', $3),
       ($4, $5, 'Vetted', 'Order A', 'talent', $3),
       ($6, $7, 'Vetted', 'Order B', 'talent', $3),
       ($8, $9, 'Unvetted', 'Order A', 'talent', $3),
       ($10, $11, 'Unvetted', 'Order B', 'talent', $3)`,
    [
      ADMIN_ID,
      `${ADMIN_ID}@onspotglobal.com`,
      CREATED_AT,
      talentFixtures[0].id,
      `${talentFixtures[0].id}@example.test`,
      talentFixtures[1].id,
      `${talentFixtures[1].id}@example.test`,
      talentFixtures[2].id,
      `${talentFixtures[2].id}@example.test`,
      talentFixtures[3].id,
      `${talentFixtures[3].id}@example.test`,
    ],
  );

  await query(
    `INSERT INTO candidates (id, user_id, full_name, is_vetted, created_at)
     VALUES
       ($1, $2, 'Vetted Order A', $3, $7),
       ($4, $5, 'Vetted Order B', $6, $7),
       ($8, $9, 'Unvetted Order A', $10, $7),
       ($11, $12, 'Unvetted Order B', $13, $7)`,
    [
      talentFixtures[0].candidateId,
      talentFixtures[0].id,
      talentFixtures[0].isVetted,
      talentFixtures[1].candidateId,
      talentFixtures[1].id,
      talentFixtures[1].isVetted,
      CREATED_AT,
      talentFixtures[2].candidateId,
      talentFixtures[2].id,
      talentFixtures[2].isVetted,
      talentFixtures[3].candidateId,
      talentFixtures[3].id,
      talentFixtures[3].isVetted,
    ],
  );
}

async function destroyFixtures(): Promise<void> {
  await query(
    `DELETE FROM candidates WHERE id = ANY($1::text[])`,
    [talentFixtures.map((talent) => talent.candidateId)],
  );
  await query(
    `DELETE FROM users WHERE id = ANY($1::text[])`,
    [[ADMIN_ID, ...talentFixtures.map((talent) => talent.id)]],
  );
}

describe("admin talent deterministic ordering", () => {
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

  it("uses descending created-at and ID tie-breaks for both Vetted sort directions", async () => {
    const expectedVettedFirst = [
      talentFixtures[1].id,
      talentFixtures[0].id,
      talentFixtures[3].id,
      talentFixtures[2].id,
    ];
    const expectedNotVettedFirst = [
      talentFixtures[3].id,
      talentFixtures[2].id,
      talentFixtures[1].id,
      talentFixtures[0].id,
    ];

    for (const [sortOrder, expectedIds] of [
      ["desc", expectedVettedFirst],
      ["asc", expectedNotVettedFirst],
    ] as const) {
      const response = await request(
        `/api/admin/talent?search=${encodeURIComponent(SEARCH_TERM)}&sortBy=vetted&sortOrder=${sortOrder}&limit=10`,
      );

      assert.equal(response.status, 200, JSON.stringify(response.json));
      assert.equal(response.json.total, talentFixtures.length);
      assert.equal(response.json.vettedTotal, 2);
      assert.deepEqual(
        response.json.items.map((item: { id: string }) => item.id),
        expectedIds,
      );
      assert.deepEqual(
        response.json.items.map((item: { id: string; created_at: string }) => [
          item.id,
          new Date(item.created_at).toISOString(),
        ]),
        expectedIds.map((id) => [id, CREATED_AT]),
      );
    }
  });
});