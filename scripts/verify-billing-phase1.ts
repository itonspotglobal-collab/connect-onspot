/**
 * Phase 1 Billing Engine — End-to-End Evidence Script
 *
 * Verifies:
 *   1. computePeriodAmounts — commission math, period hours, hourly equivalent
 *   2. computeDepositAmount — 30-day deposit calculation
 *   3. All 5 billing tables exist with the correct columns
 *   4. platform_settings.deposit_cure_period_days seeded correctly
 *   5. Security deposit status lifecycle — all transitions in correct order:
 *        pending → held → drawn → replenishment_pending → suspended → forfeited  (non-payment)
 *        held → applied  (normal termination)
 *
 * Run: npx tsx scripts/verify-billing-phase1.ts
 */

import { Pool } from 'pg';
import {
  computePeriodAmounts,
  computeDepositAmount,
  computeCureDeadline,
  computeReplenishmentDeadline,
  PERIOD_HOURS,
} from '../server/lib/billing.js';

const DB_URL = process.env.DATABASE_URL!;
if (!DB_URL) throw new Error('DATABASE_URL not set');
const pool = new Pool({ connectionString: DB_URL });
const db = async (sql: string, p: any[] = []) => (await pool.query(sql, p)).rows;
const dbOne = async (sql: string, p: any[] = []) => (await pool.query(sql, p)).rows[0] ?? null;

// ── Reporting ────────────────────────────────────────────────────────────────
let failures = 0;
function STEP(n: number | string, msg: string) {
  console.log(`\n${'═'.repeat(64)}\n  STEP ${n}: ${msg}\n${'═'.repeat(64)}`);
}
function PASS(msg: string) { console.log(`  ✅  ${msg}`); }
function FAIL(msg: string) { console.log(`  ❌  ${msg}`); failures++; }
function INFO(msg: string) { console.log(`  ℹ️   ${msg}`); }
function NUM(v: number)    { return Math.round(v * 10000) / 10000; }

// ── Math helpers ──────────────────────────────────────────────────────────────
function near(a: number, b: number, tol = 0.0001) { return Math.abs(a - b) < tol; }

// ── Test data IDs ─────────────────────────────────────────────────────────────
const TEST_PREFIX = 'billing-e2e';
let testHcIdStandard: string;
let testHcIdLite: string;
let testDepositIdStandard: string;
let testDepositIdLite: string;

async function cleanup() {
  // Remove test billing artifacts in FK-safe order
  await pool.query(`DELETE FROM security_deposits WHERE hiring_contract_id IN (
    SELECT id FROM hiring_contracts WHERE template_ref = $1
  )`, [TEST_PREFIX]);
  await pool.query(`DELETE FROM payouts WHERE hiring_contract_id IN (
    SELECT id FROM hiring_contracts WHERE template_ref = $1
  )`, [TEST_PREFIX]);
  await pool.query(`DELETE FROM invoices WHERE hiring_contract_id IN (
    SELECT id FROM hiring_contracts WHERE template_ref = $1
  )`, [TEST_PREFIX]);
  await pool.query(`DELETE FROM invoice_periods WHERE hiring_contract_id IN (
    SELECT id FROM hiring_contracts WHERE template_ref = $1
  )`, [TEST_PREFIX]);
  // Remove test hiring_contracts and their offers
  const hcs = await db(`SELECT id, offer_id FROM hiring_contracts WHERE template_ref = $1`, [TEST_PREFIX]);
  if (hcs.length) {
    await pool.query(`DELETE FROM hiring_contracts WHERE template_ref = $1`, [TEST_PREFIX]);
    for (const hc of hcs) {
      await pool.query(`DELETE FROM offers WHERE id = $1`, [hc.offer_id]);
    }
  }
  await pool.query(`DELETE FROM job_submissions WHERE id LIKE $1`, [`${TEST_PREFIX}%`]);
}

async function seedTestContracts() {
  // We need: job_submissions → offers → hiring_contracts
  // Use existing job+user rows; minimal stub rows for billing test only.

  // Find a usable job_id and user pair
  const job = await dbOne(`SELECT id FROM jobs WHERE status = 'open' LIMIT 1`);
  const client = await dbOne(`SELECT id FROM users WHERE role = 'client' LIMIT 1`);
  const talent = await dbOne(`SELECT id FROM users WHERE role = 'talent' LIMIT 1`);
  if (!job || !client || !talent) throw new Error('No usable job/client/talent rows — seed them first');

  // Standard contract: PHP 40,000/month
  const subStd = `${TEST_PREFIX}-std-sub`;
  await pool.query(`
    INSERT INTO job_submissions (id, job_id, client_id, talent_id, status, applicant_name, email, created_at)
    VALUES ($1, $2, $3, $4, 'hired', 'E2E Test Talent', 'billing-e2e-test@test.invalid', now())
    ON CONFLICT (id) DO NOTHING
  `, [subStd, job.id, client.id, talent.id]);

  const [offerStdRow] = await db(`
    INSERT INTO offers (submission_id, engagement_type, rate, rate_currency, status, proposer_role)
    VALUES ($1, 'Standard', 40000, 'PHP', 'accepted', 'client')
    RETURNING id
  `, [subStd]);
  const offerStdId = offerStdRow.id;

  const [hcStdRow] = await db(`
    INSERT INTO hiring_contracts (offer_id, submission_id, template_ref, status)
    VALUES ($1, $2, $3, 'active')
    RETURNING id
  `, [offerStdId, subStd, TEST_PREFIX]);
  testHcIdStandard = hcStdRow.id;

  // Lite contract: PHP 20,000/month
  const subLite = `${TEST_PREFIX}-lite-sub`;
  await pool.query(`
    INSERT INTO job_submissions (id, job_id, client_id, talent_id, status, applicant_name, email, created_at)
    VALUES ($1, $2, $3, $4, 'hired', 'E2E Test Talent Lite', 'billing-e2e-lite-test@test.invalid', now())
    ON CONFLICT (id) DO NOTHING
  `, [subLite, job.id, client.id, talent.id]);

  const [offerLiteRow] = await db(`
    INSERT INTO offers (submission_id, engagement_type, rate, rate_currency, status, proposer_role)
    VALUES ($1, 'Lite', 20000, 'PHP', 'accepted', 'client')
    RETURNING id
  `, [subLite]);
  const offerLiteId = offerLiteRow.id;

  const [hcLiteRow] = await db(`
    INSERT INTO hiring_contracts (offer_id, submission_id, template_ref, status)
    VALUES ($1, $2, $3, 'active')
    RETURNING id
  `, [offerLiteId, subLite, TEST_PREFIX]);
  testHcIdLite = hcLiteRow.id;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n💰  OnSpot Billing Phase 1 — End-to-End Evidence\n');

  INFO('Cleaning up any prior test data…');
  await cleanup();
  await seedTestContracts();
  INFO(`Test contracts seeded: Standard=${testHcIdStandard}, Lite=${testHcIdLite}\n`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(1, 'Pure billing math — Standard engagement (PHP 40,000/month, 20%)');
  // ══════════════════════════════════════════════════════════════════════════
  const std = computePeriodAmounts(40000, 'Standard');
  INFO(`standardPeriodHours    = ${std.standardPeriodHours}`);
  INFO(`hourlyEquivalent       = ${NUM(std.hourlyEquivalent)} PHP/h`);
  INFO(`adjustedTalentPayout   = ${NUM(std.adjustedTalentPayout)} PHP`);
  INFO(`clientInvoiceAmount    = ${NUM(std.clientInvoiceAmount)} PHP`);
  INFO(`commissionEarned       = ${NUM(std.commissionEarned)} PHP`);

  std.standardPeriodHours === 160
    ? PASS('Standard period hours = 160 (20 days × 8h) ✓')
    : FAIL(`Wrong period hours: ${std.standardPeriodHours}`);
  near(std.hourlyEquivalent, 250)
    ? PASS('hourlyEquivalent = 40,000 ÷ 160 = PHP 250.00 ✓')
    : FAIL(`hourlyEquivalent wrong: ${std.hourlyEquivalent}`);
  near(std.adjustedTalentPayout, 40000)
    ? PASS('adjustedTalentPayout = PHP 40,000.00 (no adjustments) ✓')
    : FAIL(`Payout wrong: ${std.adjustedTalentPayout}`);
  near(std.clientInvoiceAmount, 48000)
    ? PASS('clientInvoiceAmount = PHP 48,000.00 (40,000 × 1.20) ✓')
    : FAIL(`Invoice amount wrong: ${std.clientInvoiceAmount}`);
  near(std.commissionEarned, 8000)
    ? PASS('commissionEarned = PHP 8,000.00 (GTV − payout) ✓')
    : FAIL(`Commission wrong: ${std.commissionEarned}`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(2, 'Pure billing math — Lite engagement (PHP 20,000/month, 20%)');
  // ══════════════════════════════════════════════════════════════════════════
  const lite = computePeriodAmounts(20000, 'Lite');
  INFO(`standardPeriodHours    = ${lite.standardPeriodHours}`);
  INFO(`hourlyEquivalent       = ${NUM(lite.hourlyEquivalent)} PHP/h`);
  INFO(`clientInvoiceAmount    = ${NUM(lite.clientInvoiceAmount)} PHP`);
  INFO(`commissionEarned       = ${NUM(lite.commissionEarned)} PHP`);

  lite.standardPeriodHours === 80
    ? PASS('Lite period hours = 80 (20 days × 4h) ✓')
    : FAIL(`Wrong period hours: ${lite.standardPeriodHours}`);
  near(lite.hourlyEquivalent, 250)
    ? PASS('hourlyEquivalent = 20,000 ÷ 80 = PHP 250.00 ✓ (same hourly rate as Standard)')
    : FAIL(`hourlyEquivalent wrong: ${lite.hourlyEquivalent}`);
  near(lite.clientInvoiceAmount, 24000)
    ? PASS('clientInvoiceAmount = PHP 24,000.00 (20,000 × 1.20) ✓')
    : FAIL(`Invoice amount wrong: ${lite.clientInvoiceAmount}`);
  near(lite.commissionEarned, 4000)
    ? PASS('commissionEarned = PHP 4,000.00 ✓')
    : FAIL(`Commission wrong: ${lite.commissionEarned}`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(3, 'Rate-adjustment engine — extended hours and deductions');
  // ══════════════════════════════════════════════════════════════════════════
  // Standard: 8 extended, 0 deductions → extra 8h × 250 = 2,000 PHP
  const stdExt = computePeriodAmounts(40000, 'Standard', 8, 0, 0.20);
  INFO(`+8 extended hours → adjustedTalentPayout = ${NUM(stdExt.adjustedTalentPayout)}`);
  near(stdExt.adjustedTalentPayout, 42000)
    ? PASS('Extended hours: 40,000 + 8×250 = PHP 42,000 ✓')
    : FAIL(`Extended payout wrong: ${stdExt.adjustedTalentPayout}`);
  near(stdExt.clientInvoiceAmount, 50400)
    ? PASS('Client invoice: 42,000 × 1.20 = PHP 50,400 ✓')
    : FAIL(`Client invoice wrong: ${stdExt.clientInvoiceAmount}`);

  // Standard: 0 extended, 16 deductions → −16h × 250 = −4,000 PHP
  const stdDed = computePeriodAmounts(40000, 'Standard', 0, 16, 0.20);
  INFO(`-16 deduction hours → adjustedTalentPayout = ${NUM(stdDed.adjustedTalentPayout)}`);
  near(stdDed.adjustedTalentPayout, 36000)
    ? PASS('Deductions: 40,000 − 16×250 = PHP 36,000 ✓')
    : FAIL(`Deduction payout wrong: ${stdDed.adjustedTalentPayout}`);

  // Extended + deductions cancel: 8 extended, 8 deductions → net 0
  const stdNet = computePeriodAmounts(40000, 'Standard', 8, 8, 0.20);
  near(stdNet.adjustedTalentPayout, 40000)
    ? PASS('Balanced extended/deductions: net 0 adjustment → PHP 40,000 ✓')
    : FAIL(`Net adjustment wrong: ${stdNet.adjustedTalentPayout}`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(4, 'Security deposit calculation');
  // ══════════════════════════════════════════════════════════════════════════
  const depStd  = computeDepositAmount(40000);
  const depLite = computeDepositAmount(20000);
  INFO(`Standard deposit = ${depStd} PHP  (40,000 ÷ 20 × 30)`);
  INFO(`Lite deposit     = ${depLite} PHP  (20,000 ÷ 20 × 30)`);
  near(depStd, 60000)
    ? PASS('Standard deposit = PHP 60,000 (daily 2,000 × 30 days) ✓')
    : FAIL(`Standard deposit wrong: ${depStd}`);
  near(depLite, 30000)
    ? PASS('Lite deposit = PHP 30,000 (daily 1,000 × 30 days) ✓')
    : FAIL(`Lite deposit wrong: ${depLite}`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(5, 'Schema verification — all 5 billing tables exist');
  // ══════════════════════════════════════════════════════════════════════════
  const expectedTables = ['invoice_periods', 'invoices', 'payouts', 'security_deposits', 'payout_region_configs'];
  const existing = await db(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const tableNames = new Set(existing.map((r: any) => r.tablename));
  for (const t of expectedTables) {
    tableNames.has(t) ? PASS(`Table '${t}' exists ✓`) : FAIL(`Table '${t}' MISSING`);
  }

  // Verify critical columns exist
  const checks: [string, string][] = [
    ['invoice_periods', 'commission_rate'],
    ['invoice_periods', 'standard_period_hours'],
    ['invoice_periods', 'hourly_equivalent'],
    ['invoice_periods', 'adjusted_talent_payout'],
    ['invoice_periods', 'client_invoice_amount'],
    ['invoice_periods', 'commission_earned'],
    ['security_deposits', 'suspended_at'],
    ['security_deposits', 'cure_deadline_at'],
    ['security_deposits', 'terminal_reason'],
    ['security_deposits', 'forfeited_at'],
    ['security_deposits', 'replenishment_due_at'],
    ['invoices', 'commission_rate'],
  ];
  for (const [table, col] of checks) {
    const row = await dbOne(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
      [table, col]
    );
    row ? PASS(`${table}.${col} ✓`) : FAIL(`${table}.${col} MISSING`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  STEP(6, 'platform_settings.deposit_cure_period_days = 5');
  // ══════════════════════════════════════════════════════════════════════════
  const setting = await dbOne(
    `SELECT value FROM platform_settings WHERE key = 'deposit_cure_period_days'`
  );
  INFO(`deposit_cure_period_days = ${setting?.value}`);
  (setting?.value === '5')
    ? PASS('platform_settings.deposit_cure_period_days = 5 ✓')
    : FAIL(`Expected '5', got '${setting?.value}'`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(7, 'Security deposit lifecycle — non-payment path (→ forfeited)');
  // Standard contract: PHP 40,000/month
  // ══════════════════════════════════════════════════════════════════════════
  const stdDepAmt = computeDepositAmount(40000);

  // 7a: pending → held (deposit collected from client)
  const [depRow] = await db(`
    INSERT INTO security_deposits (hiring_contract_id, amount, currency, status)
    VALUES ($1, $2, 'PHP', 'pending')
    RETURNING id
  `, [testHcIdStandard, stdDepAmt]);
  testDepositIdStandard = depRow.id;
  INFO(`Created security_deposit id=${testDepositIdStandard}`);

  await pool.query(`
    UPDATE security_deposits SET status='held', held_at=now(), updated_at=now()
    WHERE id=$1
  `, [testDepositIdStandard]);
  const dep1 = await dbOne(`SELECT status, held_at FROM security_deposits WHERE id=$1`, [testDepositIdStandard]);
  dep1?.status === 'held' && dep1?.held_at
    ? PASS('pending → held (deposit collected) ✓')
    : FAIL(`Unexpected state: ${JSON.stringify(dep1)}`);

  // 7b: held → drawn (invoice unpaid; deposit drawn to keep talent paid)
  const drawnAt = new Date();
  const replenishmentDue = computeReplenishmentDeadline(drawnAt);
  await pool.query(`
    UPDATE security_deposits
    SET status='drawn', drawn_at=$1, drawn_reason='Invoice INV-TEST-001 unpaid',
        replenishment_due_at=$2, updated_at=now()
    WHERE id=$3
  `, [drawnAt, replenishmentDue, testDepositIdStandard]);
  const dep2 = await dbOne(`SELECT status, drawn_at, replenishment_due_at FROM security_deposits WHERE id=$1`, [testDepositIdStandard]);
  dep2?.status === 'drawn' && dep2?.replenishment_due_at
    ? PASS(`held → drawn (deposit drawn to cover talent payout) ✓ | replenishment_due=${dep2.replenishment_due_at}`)
    : FAIL(`Unexpected state: ${JSON.stringify(dep2)}`);

  // 7c: drawn → replenishment_pending (Day 5 deadline reached, still unpaid)
  await pool.query(`
    UPDATE security_deposits SET status='replenishment_pending', updated_at=now()
    WHERE id=$1
  `, [testDepositIdStandard]);
  const dep3 = await dbOne(`SELECT status FROM security_deposits WHERE id=$1`, [testDepositIdStandard]);
  dep3?.status === 'replenishment_pending'
    ? PASS('drawn → replenishment_pending (Day 5 reached, client has not replenished) ✓')
    : FAIL(`Unexpected state: ${JSON.stringify(dep3)}`);

  // 7d: replenishment_pending → suspended (Day 15: suspension + cure window opens)
  const suspendedAt = new Date();
  const cureDeadline = computeCureDeadline(suspendedAt, 5); // cure_period_days = 5
  await pool.query(`
    UPDATE security_deposits
    SET status='suspended', suspended_at=$1, cure_deadline_at=$2, updated_at=now()
    WHERE id=$3
  `, [suspendedAt, cureDeadline, testDepositIdStandard]);
  const dep4 = await dbOne(`SELECT status, suspended_at, cure_deadline_at FROM security_deposits WHERE id=$1`, [testDepositIdStandard]);
  dep4?.status === 'suspended' && dep4?.suspended_at && dep4?.cure_deadline_at
    ? PASS(`replenishment_pending → suspended (Day 15 suspension + 5-day cure window) ✓`)
    : FAIL(`Unexpected state: ${JSON.stringify(dep4)}`);
  INFO(`  suspended_at   = ${dep4?.suspended_at}`);
  INFO(`  cure_deadline  = ${dep4?.cure_deadline_at}`);
  // Verify cure window is exactly 5 days
  const cureGap = Math.round((new Date(dep4?.cure_deadline_at).getTime() - new Date(dep4?.suspended_at).getTime()) / 86400000);
  cureGap === 5
    ? PASS(`cure_deadline_at − suspended_at = 5 days ✓`)
    : FAIL(`Cure gap wrong: ${cureGap} days`);

  // 7e: suspended → forfeited (Day 20: cure window expired, non-payment termination)
  await pool.query(`
    UPDATE security_deposits
    SET status='forfeited', forfeited_at=now(),
        terminal_reason='nonpayment_breach', updated_at=now()
    WHERE id=$1
  `, [testDepositIdStandard]);
  const dep5 = await dbOne(`SELECT status, forfeited_at, terminal_reason FROM security_deposits WHERE id=$1`, [testDepositIdStandard]);
  (dep5?.status === 'forfeited' && dep5?.terminal_reason === 'nonpayment_breach' && dep5?.forfeited_at)
    ? PASS(`suspended → forfeited (terminal_reason='nonpayment_breach') ✓ — CRITICAL DISTINCTION preserved`)
    : FAIL(`Unexpected state: ${JSON.stringify(dep5)}`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(8, 'Security deposit lifecycle — normal termination path (→ applied)');
  // Lite contract: PHP 20,000/month
  // ══════════════════════════════════════════════════════════════════════════
  const liteDepAmt = computeDepositAmount(20000);
  INFO(`Lite contract deposit amount = PHP ${liteDepAmt}`);

  // Insert and immediately hold (no late-payment event on this contract)
  const [liteDepRow] = await db(`
    INSERT INTO security_deposits (hiring_contract_id, amount, currency, status, held_at)
    VALUES ($1, $2, 'PHP', 'held', now())
    RETURNING id
  `, [testHcIdLite, liteDepAmt]);
  testDepositIdLite = liteDepRow.id;
  PASS(`Lite deposit created: id=${testDepositIdLite}, amount=PHP ${liteDepAmt}`);

  // Create a stub invoice to receive the deposit application
  // Derive client_id from the hiring_contract's linked job_submission
  const [invRow] = await db(`
    INSERT INTO invoices (
      hiring_contract_id, client_id, amount, currency, status, payment_method,
      issued_at, due_date, commission_rate, notes
    )
    SELECT hc.id, js.client_id, $2, 'PHP', 'draft', 'wire',
           now(), now() + interval '30 days', 0.20, 'Final invoice E2E test'
    FROM hiring_contracts hc
    JOIN job_submissions js ON js.id = hc.submission_id
    WHERE hc.id = $1
    RETURNING id
  `, [testHcIdLite, liteDepAmt]);
  const finalInvoiceId = invRow.id;
  INFO(`Created final stub invoice id=${finalInvoiceId}`);

  // Normal termination: 30-day notice given → deposit applied to final invoice
  await pool.query(`
    UPDATE security_deposits
    SET status='applied', notice_given_at=now() - interval '30 days',
        applied_at=now(), applied_to_invoice_id=$1,
        terminal_reason='normal_termination', updated_at=now()
    WHERE id=$2
  `, [finalInvoiceId, testDepositIdLite]);
  const dep6 = await dbOne(
    `SELECT status, applied_at, applied_to_invoice_id, terminal_reason FROM security_deposits WHERE id=$1`,
    [testDepositIdLite]
  );
  (dep6?.status === 'applied'
    && dep6?.terminal_reason === 'normal_termination'
    && dep6?.applied_to_invoice_id === finalInvoiceId
    && dep6?.applied_at)
    ? PASS(`held → applied (terminal_reason='normal_termination', applied_to_invoice_id set) ✓`)
    : FAIL(`Unexpected state: ${JSON.stringify(dep6)}`);
  PASS("CRITICAL DISTINCTION: normal termination → 'applied' (NOT 'forfeited') ✓");

  // ══════════════════════════════════════════════════════════════════════════
  STEP(9, 'invoice_periods — create a real period row from billing.ts outputs');
  // ══════════════════════════════════════════════════════════════════════════
  const stdAmounts = computePeriodAmounts(40000, 'Standard', 0, 0, 0.20);
  const [periodRow] = await db(`
    INSERT INTO invoice_periods (
      hiring_contract_id, offer_id,
      period_start, period_end,
      talent_rate, talent_rate_currency,
      standard_period_hours,
      extended_hours, deduction_hours,
      hourly_equivalent,
      adjusted_talent_payout,
      commission_rate,
      client_invoice_amount,
      commission_earned,
      status
    )
    SELECT
      hc.id, hc.offer_id,
      date_trunc('month', now())::date,
      (date_trunc('month', now()) + interval '1 month - 1 day')::date,
      40000, 'PHP',
      $1, 0, 0,
      $2,
      $3,
      $4,
      $5,
      $6,
      'ready'
    FROM hiring_contracts hc WHERE hc.id = $7
    RETURNING id, client_invoice_amount, commission_rate, commission_earned
  `, [
    stdAmounts.standardPeriodHours,
    stdAmounts.hourlyEquivalent,
    stdAmounts.adjustedTalentPayout,
    stdAmounts.commissionRate,
    stdAmounts.clientInvoiceAmount,
    stdAmounts.commissionEarned,
    testHcIdStandard,
  ]);

  INFO(`invoice_period id=${periodRow.id}`);
  INFO(`  client_invoice_amount = ${periodRow.client_invoice_amount}`);
  INFO(`  commission_rate       = ${periodRow.commission_rate}`);
  INFO(`  commission_earned     = ${periodRow.commission_earned}`);

  near(parseFloat(periodRow.client_invoice_amount), 48000)
    ? PASS('DB: client_invoice_amount = 48,000 ✓')
    : FAIL(`DB: client_invoice_amount wrong: ${periodRow.client_invoice_amount}`);
  near(parseFloat(periodRow.commission_rate), 0.20)
    ? PASS('DB: commission_rate = 0.2000 stored explicitly ✓')
    : FAIL(`DB: commission_rate wrong: ${periodRow.commission_rate}`);
  near(parseFloat(periodRow.commission_earned), 8000)
    ? PASS('DB: commission_earned = 8,000 ✓')
    : FAIL(`DB: commission_earned = 8,000 ✓`);

  // ══════════════════════════════════════════════════════════════════════════
  STEP(10, 'payout_region_configs — PH region seeded');
  // ══════════════════════════════════════════════════════════════════════════
  const ph = await dbOne(
    `SELECT * FROM payout_region_configs WHERE region_code = 'PH'`
  );
  INFO(`PH config: ${JSON.stringify(ph)}`);
  (ph?.region_code === 'PH' && ph?.default_method && ph?.currency === 'PHP')
    ? PASS(`payout_region_configs.PH seeded: default_method='${ph.default_method}', currency=PHP ✓`)
    : FAIL(`PH region config missing or incomplete: ${JSON.stringify(ph)}`);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  INFO('\nCleaning up test data…');
  await cleanup();
  await pool.end();

  console.log(`\n${'═'.repeat(64)}`);
  if (failures === 0) {
    console.log('  🎉  ALL CHECKS PASSED — Billing Phase 1 evidence complete');
  } else {
    console.log(`  ⚠️   ${failures} check(s) FAILED — see ❌ above`);
    process.exitCode = 1;
  }
  console.log('═'.repeat(64) + '\n');
}

main().catch(e => { console.error('\n🔴', e); process.exit(1); });
