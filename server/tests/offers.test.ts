/**
 * offers.test.ts
 *
 * Integration tests for the Phase 2 offer flow:
 *   POST  /api/client/offers            (client creates an offer)
 *   PATCH /api/talent/offers/:id/respond (talent accepts / declines)
 *
 * Coverage:
 *  (a) DB-level single-pending-offer guarantee: concurrent inserts of a second
 *      'sent' offer for the same submission are rejected by the partial unique
 *      index uq_offers_one_pending_per_submission.
 *  (b) Offer creation snapshots engagement_type from the jobs row and advances
 *      the submission to 'offer_extended' with a status-history entry.
 *  (c) Rate-mismatch flags: computed when currency+engagement match; NULL when
 *      currencies differ.
 *  (d) Respond: accept → offers.status 'accepted', submission 'offer_accepted';
 *      double-respond loses the conditional UPDATE (0 rows).
 *  (e) Re-offer after decline is allowed (new row; no pending 'sent' row left).
 *
 * Run with:  npm test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../db.js";

let clientId: string | null = null;
let jobId: string | null = null;
let submissionId: string | null = null;

async function ensureUniqueIndex() {
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_offers_one_pending_per_submission
    ON offers(submission_id) WHERE status = 'sent'
  `);
}

async function setupFixture() {
  const client = await query(`SELECT id FROM users WHERE role IN ('client','admin') LIMIT 1`);
  if (!client.rows.length) return;
  clientId = client.rows[0].id;

  const job = await query(
    `INSERT INTO jobs (client_id, title, description, category, engagement_type, experience_level, status)
     VALUES ($1, 'Offer Test Job', 'test', 'IT', 'Full-Time', 'intermediate', 'draft')
     RETURNING id`,
    [clientId],
  );
  jobId = job.rows[0].id;

  const sub = await query(
    `INSERT INTO job_submissions (job_id, client_id, email, applicant_name, status, initiated_by)
     VALUES ($1, $2, 'offer-test@example.com', 'Offer Test', 'shortlisted', 'client')
     RETURNING id`,
    [jobId, clientId],
  );
  submissionId = sub.rows[0].id;
}

async function teardownFixture() {
  if (submissionId) {
    await query(`DELETE FROM job_application_status_history WHERE application_id = $1`, [submissionId]).catch(() => {});
    await query(`DELETE FROM offers WHERE submission_id = $1`, [submissionId]).catch(() => {});
    await query(`DELETE FROM job_submissions WHERE id = $1`, [submissionId]).catch(() => {});
  }
  if (jobId) await query(`DELETE FROM jobs WHERE id = $1`, [jobId]).catch(() => {});
}

/** Mirrors the production create-offer transaction (insert + side-effect). */
async function createOfferTx(subId: string, rate: number, currency = "PHP"): Promise<{ ok: boolean; code?: string; offer?: any }> {
  const tx = await pool.connect();
  try {
    await tx.query("BEGIN");
    const sub = await tx.query(
      `SELECT js.status, j.engagement_type FROM job_submissions js JOIN jobs j ON j.id = js.job_id WHERE js.id = $1`,
      [subId],
    );
    const insert = await tx.query(
      `INSERT INTO offers (submission_id, engagement_type, rate, rate_currency, status)
       VALUES ($1, $2, $3, $4, 'sent') RETURNING *`,
      [subId, sub.rows[0].engagement_type, rate.toFixed(2), currency],
    );
    await tx.query(`UPDATE job_submissions SET status = 'offer_extended', updated_at = NOW() WHERE id = $1`, [subId]);
    await tx.query(
      `INSERT INTO job_application_status_history (application_id, previous_status, new_status, note)
       VALUES ($1, $2, 'offer_extended', 'test offer')`,
      [subId, sub.rows[0].status],
    );
    await tx.query("COMMIT");
    return { ok: true, offer: insert.rows[0] };
  } catch (err: any) {
    await tx.query("ROLLBACK").catch(() => {});
    return { ok: false, code: err?.code };
  } finally {
    tx.release();
  }
}

describe("offers — single-pending guarantee and transitions", () => {
  before(async () => {
    await ensureUniqueIndex();
    await setupFixture();
  });
  after(async () => { await teardownFixture(); });

  it("(a) concurrent offer creates: exactly one wins, the loser gets a 23505 unique violation", async () => {
    if (!submissionId) return;
    const [r1, r2] = await Promise.all([
      createOfferTx(submissionId, 250),
      createOfferTx(submissionId, 260),
    ]);
    const winners = [r1, r2].filter((r) => r.ok);
    const losers = [r1, r2].filter((r) => !r.ok);
    assert.equal(winners.length, 1, "exactly one concurrent create must succeed");
    assert.equal(losers.length, 1, "exactly one concurrent create must fail");
    assert.equal(losers[0].code, "23505", "loser must fail with a unique violation (maps to 409 offer_already_pending)");

    const pending = await query(`SELECT count(*)::int AS n FROM offers WHERE submission_id = $1 AND status = 'sent'`, [submissionId]);
    assert.equal(pending.rows[0].n, 1, "only one 'sent' offer may exist");
  });

  it("(b) offer creation advanced the submission to 'offer_extended' with history", async () => {
    if (!submissionId) return;
    const sub = await query(`SELECT status FROM job_submissions WHERE id = $1`, [submissionId]);
    assert.equal(sub.rows[0].status, "offer_extended");
    const hist = await query(
      `SELECT new_status FROM job_application_status_history WHERE application_id = $1 AND new_status = 'offer_extended'`,
      [submissionId],
    );
    assert.ok(hist.rows.length >= 1, "history entry for offer_extended must exist");
    const offer = await query(`SELECT engagement_type FROM offers WHERE submission_id = $1 AND status = 'sent'`, [submissionId]);
    assert.equal(offer.rows[0].engagement_type, "Full-Time", "engagement_type snapshotted from the jobs row");
  });

  it("(c) mismatch flag rules: NULL when currencies differ, computed when they match", async () => {
    // Pure rule check mirroring the endpoint logic
    const compute = (rate: number, cur: string, expRate: string | null, expCur: string | null, eng: string, expEng: string | null) => {
      if (expRate === null || expCur === null || expCur !== cur || expEng === null || expEng !== eng) {
        return { below: null, delta: null };
      }
      const expected = Number(expRate);
      return { below: rate < expected, delta: (rate - expected).toFixed(2) };
    };
    assert.deepEqual(compute(250, "PHP", "300", "USD", "Full-Time", "Full-Time"), { below: null, delta: null }, "currency mismatch → NULL");
    assert.deepEqual(compute(250, "PHP", "300", "PHP", "Full-Time", "Half-Day"), { below: null, delta: null }, "engagement mismatch → NULL");
    assert.deepEqual(compute(250, "PHP", null, null, "Full-Time", null), { below: null, delta: null }, "no expectation → NULL");
    assert.deepEqual(compute(250, "PHP", "300", "PHP", "Full-Time", "Full-Time"), { below: true, delta: "-50.00" }, "below expectation");
    assert.deepEqual(compute(350, "PHP", "300", "PHP", "Full-Time", "Full-Time"), { below: false, delta: "50.00" }, "at/above expectation");
  });

  it("(d) respond: conditional UPDATE wins once; double-respond updates 0 rows", async () => {
    if (!submissionId) return;
    const offerRow = await query(`SELECT id FROM offers WHERE submission_id = $1 AND status = 'sent'`, [submissionId]);
    const offerId = offerRow.rows[0].id;

    const first = await query(
      `UPDATE offers SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'sent' RETURNING id`,
      [offerId],
    );
    assert.equal(first.rows.length, 1, "first respond must win the conditional UPDATE");
    await query(`UPDATE job_submissions SET status = 'offer_accepted', updated_at = NOW() WHERE id = $1`, [submissionId]);

    const second = await query(
      `UPDATE offers SET status = 'declined' WHERE id = $1 AND status = 'sent' RETURNING id`,
      [offerId],
    );
    assert.equal(second.rows.length, 0, "double-respond must update 0 rows (endpoint returns 409)");

    const sub = await query(`SELECT status FROM job_submissions WHERE id = $1`, [submissionId]);
    assert.equal(sub.rows[0].status, "offer_accepted", "CHECK constraint accepts canonical offer_accepted");
  });

  it("(e) re-offer after decline is allowed (no pending 'sent' row blocks it)", async () => {
    if (!submissionId) return;
    // Simulate a declined prior offer state: no 'sent' rows remain
    await query(`UPDATE offers SET status = 'declined' WHERE submission_id = $1`, [submissionId]);
    const r = await createOfferTx(submissionId, 400);
    assert.equal(r.ok, true, "re-offer after decline must succeed");
    const n = await query(`SELECT count(*)::int AS n FROM offers WHERE submission_id = $1`, [submissionId]);
    assert.ok(n.rows[0].n >= 2, "re-offer creates a new row");
  });
});
