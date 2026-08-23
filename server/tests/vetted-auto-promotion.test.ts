import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { query } from "../db.js";
import { autoPromoteVettedCandidates } from "../routes.js";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const CLIENT_ID = `vetted-client-${suffix}`;
const TALENT_ID = `vetted-talent-${suffix}`;
const CANDIDATE_ID = `vetted-candidate-${suffix}`;
const JOB_ID_1 = `vetted-job-1-${suffix}`;
const JOB_ID_2 = `vetted-job-2-${suffix}`;
const SUBMISSION_ID_1 = `vetted-submission-1-${suffix}`;
const SUBMISSION_ID_2 = `vetted-submission-2-${suffix}`;
let offerId1: string;
let offerId2: string;
let previousThreshold: string | null = null;

async function setThreshold(value: string | null): Promise<void> {
  if (value === null) {
    await query(`DELETE FROM platform_settings WHERE key = 'vetted_auto_hire_threshold'`);
  } else {
    await query(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES ('vetted_auto_hire_threshold', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [value],
    );
  }
}

async function resetCandidate(): Promise<void> {
  await query(
    `UPDATE candidates
        SET is_vetted = false, vetted_at = NULL, vetted_by_mechanism = NULL
      WHERE id = $1`,
    [CANDIDATE_ID],
  );
}

describe("Vetted automatic milestone promotion", () => {
  before(async () => {
    const setting = await query(
      `SELECT value FROM platform_settings WHERE key = 'vetted_auto_hire_threshold'`,
    );
    previousThreshold = setting.rows[0]?.value ?? null;

    await query(
      `INSERT INTO users (id, email, role)
       VALUES ($1, $2, 'client'), ($3, $4, 'talent')`,
      [
        CLIENT_ID,
        `${CLIENT_ID}@test.local`,
        TALENT_ID,
        `${TALENT_ID}@test.local`,
      ],
    );
    await query(
      `INSERT INTO candidates (id, user_id, email, full_name, is_vetted)
       VALUES ($1, $2, $3, 'Vetted Test Talent', false)`,
      [CANDIDATE_ID, TALENT_ID, `${TALENT_ID}@test.local`],
    );
    await query(
      `INSERT INTO jobs
         (id, client_id, title, description, category, experience_level, status, engagement_type)
       VALUES
         ($1, $3, 'Vetted Test Job 1', 'test', 'Engineering', 'senior', 'open', 'Standard'),
         ($2, $3, 'Vetted Test Job 2', 'test', 'Engineering', 'senior', 'open', 'Standard')`,
      [JOB_ID_1, JOB_ID_2, CLIENT_ID],
    );
    await query(
      `INSERT INTO job_submissions
         (id, job_id, talent_id, client_id, applicant_name, email, status,
          initiated_by, workflow_type)
       VALUES
         ($1, $3, $5, $6, 'Vetted Test Talent', $7, 'hired', 'client', 'client_invitation'),
         ($2, $4, $5, $6, 'Vetted Test Talent', $7, 'hired', 'client', 'client_invitation')`,
      [
        SUBMISSION_ID_1,
        SUBMISSION_ID_2,
        JOB_ID_1,
        JOB_ID_2,
        TALENT_ID,
        CLIENT_ID,
        `${TALENT_ID}@test.local`,
      ],
    );
    const offers = await query(
      `INSERT INTO offers (submission_id, engagement_type, rate, status)
       VALUES ($1, 'Standard', 100, 'accepted'), ($2, 'Standard', 100, 'accepted')
       RETURNING id`,
      [SUBMISSION_ID_1, SUBMISSION_ID_2],
    );
    offerId1 = offers.rows[0].id;
    offerId2 = offers.rows[1].id;
    await query(
      `INSERT INTO hiring_contracts (offer_id, submission_id, status, onspot_signed_at)
       VALUES ($1, $3, 'signed', NOW()), ($2, $4, 'signed', NOW())`,
      [offerId1, offerId2, SUBMISSION_ID_1, SUBMISSION_ID_2],
    );
  });

  after(async () => {
    await setThreshold(previousThreshold);
    await query(
      `DELETE FROM admin_role_changes
        WHERE user_id = $1 AND mechanism = 'automatic_milestone_job'`,
      [TALENT_ID],
    );
    await query(`DELETE FROM hiring_contracts WHERE offer_id = ANY($1::uuid[])`, [
      [offerId1, offerId2],
    ]);
    await query(`DELETE FROM offers WHERE id = ANY($1::uuid[])`, [[offerId1, offerId2]]);
    await query(
      `DELETE FROM job_submissions WHERE id IN ($1, $2)`,
      [SUBMISSION_ID_1, SUBMISSION_ID_2],
    );
    await query(`DELETE FROM jobs WHERE id IN ($1, $2)`, [JOB_ID_1, JOB_ID_2]);
    await query(`DELETE FROM candidates WHERE id = $1`, [CANDIDATE_ID]);
    await query(`DELETE FROM users WHERE id IN ($1, $2)`, [CLIENT_ID, TALENT_ID]);
  });

  it("promotes eligible candidates and writes one vetting audit row", async () => {
    await setThreshold("2");

    const promoted = await autoPromoteVettedCandidates();
    assert.equal(promoted, 1);

    const candidate = await query(
      `SELECT is_vetted, vetted_by_mechanism, vetted_at
         FROM candidates WHERE id = $1`,
      [CANDIDATE_ID],
    );
    assert.equal(candidate.rows[0].is_vetted, true);
    assert.equal(candidate.rows[0].vetted_by_mechanism, "automatic_milestone");
    assert.ok(candidate.rows[0].vetted_at);

    const audit = await query(
      `SELECT previous_role, new_role, mechanism, changed_by, change_type
         FROM admin_role_changes
        WHERE user_id = $1 AND mechanism = 'automatic_milestone_job'`,
      [TALENT_ID],
    );
    assert.equal(audit.rows.length, 1);
    assert.deepEqual(audit.rows[0], {
      previous_role: "unvetted",
      new_role: "vetted",
      mechanism: "automatic_milestone_job",
      changed_by: "system",
      change_type: "vetting_status",
    });
  });

  it("does not promote again on a later pass", async () => {
    await setThreshold("1");

    const promoted = await autoPromoteVettedCandidates();
    assert.equal(promoted, 0);
    const audit = await query(
      `SELECT COUNT(*)::int AS count
         FROM admin_role_changes
        WHERE user_id = $1 AND mechanism = 'automatic_milestone_job'`,
      [TALENT_ID],
    );
    assert.equal(audit.rows[0].count, 1);
  });

  it("stays dormant for missing or invalid thresholds", async () => {
    await resetCandidate();
    await setThreshold(null);
    assert.equal(await autoPromoteVettedCandidates(), 0);

    await setThreshold("not-a-number");
    assert.equal(await autoPromoteVettedCandidates(), 0);

    const candidate = await query(
      `SELECT is_vetted FROM candidates WHERE id = $1`,
      [CANDIDATE_ID],
    );
    assert.equal(candidate.rows[0].is_vetted, false);
  });
});