/**
 * verify-billing-phase3.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * E2E evidence for Billing Phase 3: client invoice view + talent payout history.
 *
 * Tests the SQL queries that back both endpoints (client_id and talent_id
 * filtering, correct joins), plus cross-tenant isolation.
 *
 * Run:  npx tsx scripts/verify-billing-phase3.ts
 */

import { Pool } from "pg";
import { randomUUID } from "crypto";

const DB_URL = process.env.DATABASE_URL ?? "";
if (!DB_URL) { console.error("❌ DATABASE_URL is not set"); process.exit(1); }

const pool = new Pool({ connectionString: DB_URL });
const q = (text: string, params?: any[]) => pool.query(text, params);

let pass = 0, fail = 0;
const log = (ok: boolean, label: string, extra?: string) => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedUser(role: string, suffix: string) {
  const id = randomUUID();
  const tag = `${suffix}-${id.slice(0, 6)}`;
  await q(
    `INSERT INTO users (id, username, email, role, created_at)
     VALUES ($1,$2,$3,$4,now())`,
    [id, `verify-p3-${tag}`, `verify-p3-${tag}@phase3.test`, role],
  );
  return id;
}

async function seedJob(clientId: string) {
  const id = randomUUID();
  await q(
    `INSERT INTO jobs (id, title, description, category, experience_level, status, client_id, created_at)
     VALUES ($1,'Phase3 Test Job','Verification seed job','Technology','Mid-Level','open',$2,now())`,
    [id, clientId],
  );
  return id;
}

async function seedSubmission(jobId: string, clientId: string, talentId: string) {
  const id = randomUUID();
  await q(
    `INSERT INTO job_submissions
       (id, job_id, client_id, talent_id, applicant_name, email,
        status, workflow_type, initiated_by, created_at)
     VALUES ($1,$2,$3,$4,'Verify Talent','verify-talent@phase3.test',
             'hired','client_invitation','client',now())`,
    [id, jobId, clientId, talentId],
  );
  return id;
}

async function seedOffer(submissionId: string) {
  const id = randomUUID();
  await q(
    `INSERT INTO offers (id, submission_id, engagement_type, rate, rate_currency, status)
     VALUES ($1,$2,'Standard',60000,'PHP','sent')`,
    [id, submissionId],
  );
  return id;
}

async function seedHiringContract(offerId: string, submissionId: string) {
  const id = randomUUID();
  await q(
    `INSERT INTO hiring_contracts (id, offer_id, submission_id, status)
     VALUES ($1,$2,$3,'active')`,
    [id, offerId, submissionId],
  );
  return id;
}

async function seedPeriod(hcId: string, offerId: string) {
  const r = await q(
    `INSERT INTO invoice_periods
       (hiring_contract_id, offer_id, period_start, period_end,
        talent_rate, talent_rate_currency, standard_period_hours,
        extended_hours, deduction_hours, hourly_equivalent,
        adjusted_talent_payout, commission_rate, client_invoice_amount,
        commission_earned, status)
     VALUES ($1,$2,CURRENT_DATE,(CURRENT_DATE+interval'1 month')::date,
             60000,'PHP',160,0,0,375,60000,0.2,72000,12000,'ready')
     RETURNING id`,
    [hcId, offerId],
  );
  return r.rows[0].id as string;
}

async function seedInvoice(periodId: string, hcId: string, clientId: string) {
  const r = await q(
    `INSERT INTO invoices
       (period_id, hiring_contract_id, client_id, invoice_number,
        amount, currency, commission_rate, payment_method, status, issued_at, due_date)
     VALUES ($1,$2,$3,
             'INV-P3-'||nextval('invoice_number_seq')::text,
             72000,'PHP',0.2,'wire','sent',now(),now()+interval'30 days')
     RETURNING id`,
    [periodId, hcId, clientId],
  );
  return r.rows[0].id as string;
}

async function seedPayout(periodId: string, hcId: string, talentId: string) {
  const r = await q(
    `INSERT INTO payouts
       (period_id, hiring_contract_id, talent_id, amount, currency,
        payout_region, payout_method, status)
     VALUES ($1,$2,$3,60000,'PHP','PH','bank_transfer','pending')
     RETURNING id`,
    [periodId, hcId, talentId],
  );
  return r.rows[0].id as string;
}

interface SeedResult {
  clientId: string;
  talentId: string;
  jobId: string;
  submissionId: string;
  offerId: string;
  hcId: string;
  periodId: string;
  invoiceId: string;
  payoutId: string;
}

async function seedChain(suffix: string): Promise<SeedResult> {
  const clientId = await seedUser("client", `cli-${suffix}`);
  const talentId = await seedUser("talent", `tal-${suffix}`);
  const jobId    = await seedJob(clientId);
  const subId    = await seedSubmission(jobId, clientId, talentId);
  const offerId  = await seedOffer(subId);
  const hcId     = await seedHiringContract(offerId, subId);
  const pId      = await seedPeriod(hcId, offerId);
  const invId    = await seedInvoice(pId, hcId, clientId);
  const payId    = await seedPayout(pId, hcId, talentId);
  return { clientId, talentId, jobId, submissionId: subId, offerId, hcId, periodId: pId, invoiceId: invId, payoutId: payId };
}

async function cleanup(s: SeedResult) {
  await q(`DELETE FROM payouts WHERE id=$1`, [s.payoutId]);
  await q(`DELETE FROM invoices WHERE id=$1`, [s.invoiceId]);
  await q(`DELETE FROM invoice_periods WHERE id=$1`, [s.periodId]);
  await q(`DELETE FROM hiring_contracts WHERE id=$1`, [s.hcId]);
  await q(`DELETE FROM offers WHERE id=$1`, [s.offerId]);
  await q(`DELETE FROM job_submissions WHERE id=$1`, [s.submissionId]);
  await q(`DELETE FROM jobs WHERE id=$1`, [s.jobId]);
  await q(`DELETE FROM users WHERE id IN ($1,$2)`, [s.clientId, s.talentId]);
}

// ── Client invoice query (mirrors GET /api/client/invoices) ──────────────────

async function clientInvoiceQuery(clientId: string) {
  const result = await q(
    `SELECT
       inv.id, inv.invoice_number, inv.amount, inv.currency, inv.status,
       inv.payment_method, inv.issued_at, inv.due_date, inv.paid_at,
       inv.commission_rate,
       ip.period_start, ip.period_end, ip.standard_period_hours,
       ip.adjusted_talent_payout, ip.client_invoice_amount,
       o.engagement_type,
       COALESCE(NULLIF(TRIM(CONCAT(talent.first_name,' ',talent.last_name)),''), talent.email) AS talent_name
     FROM invoices inv
     JOIN invoice_periods   ip  ON ip.id  = inv.period_id
     JOIN hiring_contracts  hc  ON hc.id  = inv.hiring_contract_id
     JOIN job_submissions   js  ON js.id  = hc.submission_id
     JOIN offers            o   ON o.id   = hc.offer_id
     LEFT JOIN users talent ON talent.id = js.talent_id
     WHERE inv.client_id = $1
     ORDER BY inv.issued_at DESC NULLS LAST, inv.created_at DESC
     LIMIT 20 OFFSET 0`,
    [clientId],
  );
  return result.rows;
}

// ── Talent payout query (mirrors GET /api/talent/payouts) ────────────────────

async function talentPayoutQuery(talentId: string) {
  const result = await q(
    `SELECT
       p.id, p.amount, p.currency, p.status, p.payout_region,
       p.payout_method, p.external_ref, p.failed_reason,
       p.scheduled_at, p.disbursed_at, p.created_at,
       ip.period_start, ip.period_end, ip.standard_period_hours,
       ip.talent_rate, ip.talent_rate_currency, ip.client_invoice_amount,
       o.engagement_type,
       COALESCE(NULLIF(TRIM(CONCAT(client.first_name,' ',client.last_name)),''), client.email) AS client_name
     FROM payouts p
     JOIN invoice_periods   ip  ON ip.id  = p.period_id
     JOIN hiring_contracts  hc  ON hc.id  = p.hiring_contract_id
     JOIN job_submissions   js  ON js.id  = hc.submission_id
     JOIN offers            o   ON o.id   = hc.offer_id
     LEFT JOIN users client ON client.id = js.client_id
     WHERE p.talent_id = $1
     ORDER BY ip.period_start DESC, p.created_at DESC
     LIMIT 20 OFFSET 0`,
    [talentId],
  );
  return result.rows;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function runClientInvoiceTests(a: SeedResult, b: SeedResult) {
  console.log("\n── Client invoice view ──");

  const rowsA = await clientInvoiceQuery(a.clientId);
  log(rowsA.length === 1, "Client A sees exactly 1 invoice");

  const inv = rowsA[0];
  log(inv?.id === a.invoiceId, "Invoice ID matches seeded invoice");
  log(parseFloat(inv?.amount) === 72_000, `Invoice amount = ₱72,000 (got ${inv?.amount})`);
  log(inv?.currency === "PHP", "Currency is PHP");
  log(inv?.status === "sent", "Status is 'sent'");
  log(inv?.engagement_type === "Standard", "Engagement type = Standard");
  log(inv?.period_start != null, "period_start is present");
  log(inv?.period_end   != null, "period_end is present");
  log(inv?.invoice_number?.startsWith("INV-P3-"), "Invoice number has expected prefix");

  // Isolation: client A cannot see client B's invoices
  const rowsA_seesB = (await clientInvoiceQuery(a.clientId)).some(r => r.id === b.invoiceId);
  log(!rowsA_seesB, "Client A cannot see Client B's invoice (isolation)");

  const rowsB = await clientInvoiceQuery(b.clientId);
  log(rowsB.length === 1 && rowsB[0].id === b.invoiceId, "Client B sees only their own invoice");

  // Pagination count
  const countA = await q(`SELECT COUNT(*)::int AS total FROM invoices WHERE client_id=$1`, [a.clientId]);
  log(countA.rows[0].total === 1, "Client invoice count = 1");
}

async function runTalentPayoutTests(a: SeedResult, b: SeedResult) {
  console.log("\n── Talent payout view ──");

  const rowsA = await talentPayoutQuery(a.talentId);
  log(rowsA.length === 1, "Talent A sees exactly 1 payout");

  const p = rowsA[0];
  log(p?.id === a.payoutId, "Payout ID matches seeded payout");
  log(parseFloat(p?.amount) === 60_000, `Payout amount = ₱60,000 (got ${p?.amount})`);
  log(p?.currency === "PHP", "Currency is PHP");
  log(p?.status === "pending", "Status is 'pending'");
  log(p?.payout_method === "bank_transfer", "Payout method = bank_transfer");
  log(p?.payout_region === "PH", "Payout region = PH");
  log(p?.engagement_type === "Standard", "Engagement type = Standard");
  log(p?.period_start != null, "period_start is present");
  log(parseFloat(p?.client_invoice_amount) === 72_000, `Client invoice amount visible = ₱72,000`);

  // Isolation: talent A cannot see talent B's payouts
  const rowsA_seesB = (await talentPayoutQuery(a.talentId)).some(r => r.id === b.payoutId);
  log(!rowsA_seesB, "Talent A cannot see Talent B's payout (isolation)");

  const rowsB = await talentPayoutQuery(b.talentId);
  log(rowsB.length === 1 && rowsB[0].id === b.payoutId, "Talent B sees only their own payout");

  // Pagination count
  const countA = await q(`SELECT COUNT(*)::int AS total FROM payouts WHERE talent_id=$1`, [a.talentId]);
  log(countA.rows[0].total === 1, "Talent payout count = 1");
}

async function runStatusTransitionChecks(a: SeedResult) {
  console.log("\n── Status transition checks ──");

  // Mark invoice paid — client should see paid_at
  await q(`UPDATE invoices SET status='paid', paid_at=now() WHERE id=$1`, [a.invoiceId]);
  const paidRows = await clientInvoiceQuery(a.clientId);
  log(paidRows[0]?.status === "paid", "Invoice status updates to paid");
  log(paidRows[0]?.paid_at !== null, "paid_at is populated after payment");

  // Disburse payout — talent should see disbursed_at
  await q(`UPDATE payouts SET status='disbursed', disbursed_at=now(), external_ref='TEST-REF' WHERE id=$1`, [a.payoutId]);
  const disRows = await talentPayoutQuery(a.talentId);
  log(disRows[0]?.status === "disbursed", "Payout status updates to disbursed");
  log(disRows[0]?.disbursed_at !== null, "disbursed_at is populated");
  log(disRows[0]?.external_ref === "TEST-REF", "external_ref is visible to talent");

  // Empty state: a new client with no invoices sees 0
  const freshClientId = await seedUser("client", "fresh");
  const emptyRows = await clientInvoiceQuery(freshClientId);
  log(emptyRows.length === 0, "New client with no invoices sees empty list");
  await q(`DELETE FROM users WHERE id=$1`, [freshClientId]);

  // Empty state: a new talent with no payouts sees 0
  const freshTalentId = await seedUser("talent", "fresh");
  const emptyPRows = await talentPayoutQuery(freshTalentId);
  log(emptyPRows.length === 0, "New talent with no payouts sees empty list");
  await q(`DELETE FROM users WHERE id=$1`, [freshTalentId]);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Billing Phase 3 — E2E Evidence ===\n");

  const seedA = await seedChain("A");
  const seedB = await seedChain("B");

  try {
    await runClientInvoiceTests(seedA, seedB);
    await runTalentPayoutTests(seedA, seedB);
    await runStatusTransitionChecks(seedA);
  } finally {
    await cleanup(seedA);
    await cleanup(seedB);
  }

  console.log(`\n${"═".repeat(48)}`);
  const total = pass + fail;
  if (fail === 0) {
    console.log(`✅ ALL ${total}/${total} CHECKS PASS — Phase 3 verified`);
  } else {
    console.log(`❌ ${fail}/${total} CHECKS FAILED`);
    process.exit(1);
  }
  await pool.end();
}

main().catch(async err => {
  console.error("Fatal:", err);
  await pool.end();
  process.exit(1);
});
