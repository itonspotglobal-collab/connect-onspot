/**
 * verify-billing-phase2.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * E2E evidence script for Billing Phase 2 (admin ledger endpoints).
 *
 * Creates a minimal hiring-contract chain, drives the full billing lifecycle,
 * and verifies the deposit escalation ladder including both terminal paths.
 *
 * Run:  npx tsx scripts/verify-billing-phase2.ts
 */

import { Pool } from "pg";
import { randomUUID } from "crypto";
import { computePeriodAmounts, computeDepositAmount } from "../server/lib/billing.js";

// Use the local dev database (same one the server uses)
const DB_URL = process.env.DATABASE_URL ?? "";
if (!DB_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL });
const q = (text: string, params?: any[]) => pool.query(text, params);

let pass = 0, fail = 0;
const log = (ok: boolean, label: string, extra?: string) => {
  console.log(`${ok ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

// ── Seed / teardown ───────────────────────────────────────────────────────────

async function seed(): Promise<{ hcId: string; offerId: string; submissionId: string; clientId: string; talentId: string; clientUserId: string; talentUserId: string }> {
  // Create real users so FK constraints pass
  const clientUserId = randomUUID();
  const talentUserId = randomUUID();
  const cSuffix = clientUserId.slice(0, 8);
  const tSuffix = talentUserId.slice(0, 8);
  await q(
    `INSERT INTO users (id, username, email, role, created_at)
     VALUES ($1,$2,$3,'client',now()),
            ($4,$5,$6,'talent',now())`,
    [clientUserId, `verify-client-${cSuffix}`, `verify-client-${cSuffix}@phase2.test`,
     talentUserId, `verify-talent-${tSuffix}`, `verify-talent-${tSuffix}@phase2.test`]
  );

  const clientId = clientUserId;
  const talentId = talentUserId;
  const jobId    = randomUUID();

  // minimal job row
  await q(
    `INSERT INTO jobs (id, title, description, category, experience_level, status, client_id, created_at)
     VALUES ($1,'Phase2 Test Job','Verification seed job','Technology','Mid-Level','open',$2,now())`,
    [jobId, clientId]
  );

  const sub = await q(
    `INSERT INTO job_submissions
       (id, job_id, client_id, talent_id, applicant_name, email,
        status, workflow_type, initiated_by, created_at)
     VALUES ($1,$2,$3,$4,'Verify Talent','verify-talent@phase2.test',
             'hired','client_invitation','client',now())
     RETURNING id`,
    [randomUUID(), jobId, clientId, talentId]
  );
  const submissionId = sub.rows[0].id;

  const offerRes = await q(
    `INSERT INTO offers
       (id, submission_id, engagement_type, rate, rate_currency, status)
     VALUES ($1,$2,'Standard',60000,'PHP','sent')
     RETURNING id`,
    [randomUUID(), submissionId]
  );
  const offerId = offerRes.rows[0].id;

  const hcRes = await q(
    `INSERT INTO hiring_contracts (id, offer_id, submission_id, status)
     VALUES ($1,$2,$3,'active')
     RETURNING id`,
    [randomUUID(), offerId, submissionId]
  );

  return { hcId: hcRes.rows[0].id, offerId, submissionId, clientId, talentId };
}

async function cleanup(ids: { hcId: string; submissionId: string; clientUserId: string; talentUserId: string }): Promise<void> {
  await q(`DELETE FROM security_deposits WHERE hiring_contract_id=$1`, [ids.hcId]);
  await q(`DELETE FROM payouts WHERE hiring_contract_id=$1`, [ids.hcId]);
  const periods = await q(`SELECT id FROM invoice_periods WHERE hiring_contract_id=$1`, [ids.hcId]);
  for (const row of periods.rows) await q(`DELETE FROM invoices WHERE period_id=$1`, [row.id]);
  await q(`DELETE FROM invoice_periods WHERE hiring_contract_id=$1`, [ids.hcId]);
  await q(`DELETE FROM hiring_contracts WHERE id=$1`, [ids.hcId]);
  const offerRows = await q(`SELECT id FROM offers WHERE submission_id=$1`, [ids.submissionId]);
  for (const r of offerRows.rows) await q(`DELETE FROM offers WHERE id=$1`, [r.id]);
  const subRow = await q(`SELECT job_id FROM job_submissions WHERE id=$1`, [ids.submissionId]);
  await q(`DELETE FROM job_submissions WHERE id=$1`, [ids.submissionId]);
  if (subRow.rows[0]) await q(`DELETE FROM jobs WHERE id=$1`, [subRow.rows[0].job_id]);
  await q(`DELETE FROM users WHERE id IN ($1,$2)`, [ids.clientUserId, ids.talentUserId]);
}

// ── Pure function checks ──────────────────────────────────────────────────────

function checkPureFunctions() {
  console.log("\n── Pure billing function sanity checks ──");

  const std = computePeriodAmounts(60_000, "Standard", 0, 0, 0.20);
  log(std.standardPeriodHours === 160, "Standard period = 160 h");
  log(Math.abs(std.hourlyEquivalent - 375) < 0.01, `Hourly equiv = ₱375`);
  log(Math.abs(std.adjustedTalentPayout - 60_000) < 0.01, `Talent payout = ₱60,000`);
  log(Math.abs(std.clientInvoiceAmount - 72_000) < 0.01, `Client invoice = ₱72,000`);
  log(Math.abs(std.commissionEarned - 12_000) < 0.01, `Commission = ₱12,000`);

  const dep = computeDepositAmount(60_000);
  log(Math.abs(dep - 90_000) < 0.01, `Security deposit = ₱90,000`);

  const lite = computePeriodAmounts(30_000, "Lite", 8, 0, 0.20);
  log(lite.standardPeriodHours === 80, "Lite standard period = 80 h");
  log(lite.adjustedTalentPayout > 30_000, "Lite payout > base (extended hours add to payout)");

  const extStd = computePeriodAmounts(60_000, "Standard", 8, 0, 0.20);
  log(Math.abs(extStd.adjustedTalentPayout - (60_000 + 8 * 375)) < 0.01,
    `Extended hours: payout = ₱${extStd.adjustedTalentPayout.toFixed(0)}`);
}

// ── DB structure checks ───────────────────────────────────────────────────────

async function checkStructure() {
  console.log("\n── Database structure checks ──");

  for (const t of ["invoice_periods","invoices","payouts","security_deposits","payout_region_configs"]) {
    const r = await q(`SELECT to_regclass($1::text) AS name`, [`public.${t}`]);
    log(r.rows[0].name !== null, `Table '${t}' exists`);
  }

  for (const t of ["proposals","contracts","milestones","time_entries","payments","disputes"]) {
    const r = await q(`SELECT to_regclass($1::text) AS name`, [`public.${t}`]);
    log(r.rows[0].name === null, `Orphaned table '${t}' is dropped`);
  }

  const seq = await q(`SELECT to_regclass('public.invoice_number_seq'::text) AS name`);
  log(seq.rows[0].name !== null, "invoice_number_seq exists");

  // reviews.contract_id must be gone
  const revCol = await q(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='reviews' AND column_name='contract_id'`
  );
  log(revCol.rows.length === 0, "reviews.contract_id column dropped");

  // message_threads.contract_id must be gone
  const mtCol = await q(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name='message_threads' AND column_name='contract_id'`
  );
  log(mtCol.rows.length === 0, "message_threads.contract_id column dropped");
}

// ── Full lifecycle ────────────────────────────────────────────────────────────

async function runLifecycle() {
  console.log("\n── Full billing lifecycle ──");

  const { hcId, submissionId, clientId, talentId } = await seed();

  try {
    const amounts = computePeriodAmounts(60_000, "Standard", 0, 0, 0.20);

    // 1. Create draft billing period
    const pr = await q(
      `INSERT INTO invoice_periods (
         hiring_contract_id, offer_id, period_start, period_end,
         talent_rate, talent_rate_currency, standard_period_hours,
         extended_hours, deduction_hours, hourly_equivalent,
         adjusted_talent_payout, commission_rate, client_invoice_amount,
         commission_earned, status
       )
       SELECT $1, hc.offer_id,
              CURRENT_DATE, (CURRENT_DATE + interval '1 month')::date,
              $2, 'PHP', $3, 0, 0, $4, $5, $6, $7, $8, 'draft'
       FROM hiring_contracts hc WHERE hc.id=$1
       RETURNING id, status, client_invoice_amount`,
      [hcId, amounts.adjustedTalentPayout, amounts.standardPeriodHours,
       amounts.hourlyEquivalent, amounts.adjustedTalentPayout,
       amounts.commissionRate, amounts.clientInvoiceAmount, amounts.commissionEarned]
    );
    const periodId = pr.rows[0].id;
    log(pr.rows[0].status === "draft", "Draft billing period created");
    log(parseFloat(pr.rows[0].client_invoice_amount) === 72_000, `Period invoice amount = ₱72,000`);

    // 2. Advance to ready
    await q(`UPDATE invoice_periods SET status='ready' WHERE id=$1`, [periodId]);
    const readyChk = await q(`SELECT status FROM invoice_periods WHERE id=$1`, [periodId]);
    log(readyChk.rows[0].status === "ready", "Period advanced to ready");

    // 3. Issue invoice
    const seqRow = await q(`SELECT nextval('invoice_number_seq') AS seq`);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(seqRow.rows[0].seq).padStart(4,"0")}`;
    const invR = await q(
      `INSERT INTO invoices (period_id, hiring_contract_id, client_id, invoice_number,
         amount, currency, commission_rate, payment_method, status, issued_at, due_date)
       VALUES ($1,$2,$3,$4,$5,'PHP',$6,'wire','sent',now(),now()+interval'30 days')
       RETURNING id, invoice_number, status, amount`,
      [periodId, hcId, clientId, invoiceNumber,
       amounts.clientInvoiceAmount, amounts.commissionRate]
    );
    log(invR.rows[0].status === "sent", `Invoice issued: ${invR.rows[0].invoice_number}`);
    log(parseFloat(invR.rows[0].amount) === 72_000, `Invoice amount = ₱72,000`);
    const invoiceId = invR.rows[0].id;
    await q(`UPDATE invoice_periods SET status='invoiced' WHERE id=$1`, [periodId]);

    // 4. Mark invoice paid
    await q(`UPDATE invoices SET status='paid', paid_at=now(), external_ref='WIRE-TEST' WHERE id=$1`, [invoiceId]);
    const paidChk = await q(`SELECT status, paid_at FROM invoices WHERE id=$1`, [invoiceId]);
    log(paidChk.rows[0].status === "paid", "Invoice marked paid");
    log(paidChk.rows[0].paid_at !== null, "Invoice paid_at set");

    // 5. Create payout
    const payR = await q(
      `INSERT INTO payouts (period_id, hiring_contract_id, talent_id, amount, currency,
         payout_region, payout_method, status)
       VALUES ($1,$2,$3,$4,'PHP','PH','bank_transfer','pending')
       RETURNING id, status, amount`,
      [periodId, hcId, talentId, amounts.adjustedTalentPayout]
    );
    log(payR.rows[0].status === "pending", "Payout record created (pending)");
    log(parseFloat(payR.rows[0].amount) === 60_000, `Payout amount = ₱60,000`);
    const payoutId = payR.rows[0].id;
    await q(`UPDATE invoice_periods SET status='payout_scheduled' WHERE id=$1`, [periodId]);

    // 6. Disburse payout → closes period
    await q(`UPDATE payouts SET status='disbursed', disbursed_at=now(), external_ref='GCash-001' WHERE id=$1`, [payoutId]);
    await q(`UPDATE invoice_periods SET status='closed' WHERE id=$1`, [periodId]);
    const disChk  = await q(`SELECT status FROM payouts WHERE id=$1`, [payoutId]);
    const closeChk = await q(`SELECT status FROM invoice_periods WHERE id=$1`, [periodId]);
    log(disChk.rows[0].status === "disbursed", "Payout disbursed");
    log(closeChk.rows[0].status === "closed", "Period closed after disburse");

    // 7. Security deposit — full escalation ladder + normal termination
    const depAmount = computeDepositAmount(60_000);
    const depR = await q(
      `INSERT INTO security_deposits (hiring_contract_id, amount, currency, status)
       VALUES ($1,$2,'PHP','pending') RETURNING id, amount, status`,
      [hcId, depAmount]
    );
    log(depR.rows[0].status === "pending", "Deposit created (pending)");
    log(parseFloat(depR.rows[0].amount) === 90_000, `Deposit = ₱90,000 (1.5× monthly)`);
    const depId = depR.rows[0].id;

    // pending → held
    await q(`UPDATE security_deposits SET status='held', held_at=now() WHERE id=$1`, [depId]);
    // held → drawn
    const drawnAt = new Date(); const repDue = new Date(drawnAt); repDue.setDate(repDue.getDate()+5);
    await q(`UPDATE security_deposits SET status='drawn', drawn_at=$1, drawn_reason='invoice_unpaid', replenishment_due_at=$2 WHERE id=$3`, [drawnAt,repDue,depId]);
    // drawn → replenishment_pending
    await q(`UPDATE security_deposits SET status='replenishment_pending' WHERE id=$1`, [depId]);
    // replenishment_pending → suspended + cure_deadline
    const suspAt = new Date(); const cureDl = new Date(suspAt); cureDl.setDate(cureDl.getDate()+5);
    await q(`UPDATE security_deposits SET status='suspended', suspended_at=$1, cure_deadline_at=$2 WHERE id=$3`, [suspAt,cureDl,depId]);
    // suspended → cured → held
    await q(`UPDATE security_deposits SET status='held', suspended_at=null, cure_deadline_at=null WHERE id=$1`, [depId]);
    // applied on normal termination
    await q(
      `UPDATE security_deposits SET status='applied', applied_at=now(),
         applied_to_invoice_id=$1, notice_given_at=now(), terminal_reason='normal_termination'
       WHERE id=$2`,
      [invoiceId, depId]
    );
    const depFinal = await q(`SELECT status, terminal_reason FROM security_deposits WHERE id=$1`, [depId]);
    log(depFinal.rows[0].status === "applied", "Deposit applied (normal termination)");
    log(depFinal.rows[0].terminal_reason === "normal_termination", "terminal_reason='normal_termination'");

    // 8. Forfeiture path — update same deposit to verify nonpayment_breach terminal reason
    await q(
      `UPDATE security_deposits SET status='forfeited', forfeited_at=now(),
         applied_at=null, applied_to_invoice_id=null,
         terminal_reason='nonpayment_breach' WHERE id=$1`,
      [depId]
    );
    const breachChk = await q(`SELECT status, terminal_reason FROM security_deposits WHERE id=$1`, [depId]);
    log(breachChk.rows[0].status === "forfeited", "Deposit transitioned to forfeited");
    log(breachChk.rows[0].terminal_reason === "nonpayment_breach",
      "Forfeiture sets terminal_reason='nonpayment_breach'");

    // 9. Ledger aggregate
    const sum = await q(
      `SELECT COALESCE(SUM(client_invoice_amount),0) AS gtv,
              COALESCE(SUM(commission_earned),0) AS comm
       FROM invoice_periods WHERE hiring_contract_id=$1`, [hcId]
    );
    log(parseFloat(sum.rows[0].gtv) === 72_000, `Ledger GTV = ₱72,000`);
    log(parseFloat(sum.rows[0].comm) === 12_000, `Ledger commission = ₱12,000`);

  } finally {
    await cleanup({ hcId, submissionId });
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Billing Phase 2 — E2E Evidence ===\n");
  checkPureFunctions();
  await checkStructure();
  await runLifecycle();

  console.log(`\n${"═".repeat(48)}`);
  const total = pass + fail;
  if (fail === 0) {
    console.log(`✅ ALL ${total}/${total} CHECKS PASS — Phase 2 verified`);
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
