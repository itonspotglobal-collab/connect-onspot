import type { Express, RequestHandler } from "express";
import { getClient, query } from "../db.ts";
import { BILLING_CURRENCY, isUsdCurrency, requireUsdCurrency } from "../../shared/currency.ts";

type Middleware = RequestHandler;
type Options = {
  authenticateJWT: Middleware;
  requireTalent: Middleware;
  requireClient: Middleware;
  requireAdmin: Middleware;
  requireAdminSubRole: (roles: string[]) => Middleware;
  getTalentBillingUserId: (req: any) => Promise<string | null>;
  startAutomation?: boolean;
};

export const BILLING_TIME_ZONE = "America/New_York";
export const billingCurrencyForSource = (sourceCurrency: unknown) => {
  requireUsdCurrency(sourceCurrency);
  return BILLING_CURRENCY;
};
const DAY_MS = 86_400_000;
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const validMoney = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const dateString = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  throw new Error("Invalid date-only value from database");
};
const dateInZone = (instant: Date, zone = BILLING_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const addCalendarDays = (date: string, days: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};
const monthLength = (date: string) => {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
};
export const halfMonthPeriod = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return day <= 15
    ? { start: `${prefix}-01`, end: `${prefix}-15` }
    : { start: `${prefix}-16`, end: `${prefix}-${monthLength(date)}` };
};
const periodsFrom = (startDate: string, through: string) => {
  const output: Array<{ start: string; end: string }> = [];
  let period = halfMonthPeriod(startDate);
  while (period.start <= through) {
    output.push(period);
    period = halfMonthPeriod(addCalendarDays(period.end, 1));
  }
  return output;
};
const periodsThrough = (startDate: string, through: string, effectiveEndDate: string | null = null) => {
  if (effectiveEndDate && effectiveEndDate < startDate) return [];
  const limit = effectiveEndDate && effectiveEndDate < through ? effectiveEndDate : through;
  return periodsFrom(startDate, limit).map((period) => ({
    ...period,
    end: effectiveEndDate && effectiveEndDate < period.end ? effectiveEndDate : period.end,
  }));
};

// All cutoffs and pay dates are calendar dates in New York, not UTC dates.
const midnightInZone = (date: string) => {
  let low = Date.parse(`${date}T00:00:00.000Z`) - 48 * 60 * 60 * 1000;
  let high = Date.parse(`${date}T00:00:00.000Z`) + 48 * 60 * 60 * 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (dateInZone(new Date(middle)) >= date) high = middle;
    else low = middle;
  }
  return new Date(high);
};
export const claimDeadlineForPeriod = (periodEnd: string) =>
  midnightInZone(addCalendarDays(periodEnd, 2));
export const payoutDateForPeriod = (period: { start: string; end: string }, today: string) => {
  const [year, month] = period.start.split("-").map(Number);
  let candidate = period.end.endsWith("-15")
    ? `${year}-${String(month).padStart(2, "0")}-25`
    : addCalendarDays(`${year}-${String(month).padStart(2, "0")}-01`, monthLength(`${year}-${String(month).padStart(2, "0")}-01`) + 4);
  // A claim resolved after one or more contractual run dates rolls forward to
  // the first 5th/25th that has not passed; it is never a retroactive payment.
  while (candidate < today) {
    const [candidateYear, candidateMonth, candidateDay] = candidate.split("-").map(Number);
    if (candidateDay === 5) {
      candidate = `${candidateYear}-${String(candidateMonth).padStart(2, "0")}-25`;
    } else {
      const nextMonth = candidateMonth === 12 ? 1 : candidateMonth + 1;
      const nextYear = candidateMonth === 12 ? candidateYear + 1 : candidateYear;
      candidate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-05`;
    }
  }
  return candidate;
};

export const trackedPeriodAmount = (
  monthlyRate: number,
  engagementType: string,
  hours: number,
) => {
  const monthlyHours = engagementType === "Standard" ? 160 : engagementType === "Lite" ? 80 : null;
  if (monthlyHours === null) throw new Error("The signed offer has no supported engagement type");
  const standardHours = monthlyHours / 2;
  const hourlyEquivalent = monthlyRate / monthlyHours;
  return {
    amount: roundMoney(Math.max(0, monthlyRate / 2 + (hours - standardHours) * hourlyEquivalent)),
    standardHours,
    hourlyEquivalent,
  };
};
export const guaranteedPeriodAmount = (
  monthlyRate: number,
  period: { start: string; end: string },
  effectiveStart: string,
) => {
  const activeStart = effectiveStart > period.start ? effectiveStart : period.start;
  const activeDays = Math.max(0,
    Math.floor((Date.parse(`${period.end}T00:00:00Z`) - Date.parse(`${activeStart}T00:00:00Z`)) / DAY_MS) + 1);
  return roundMoney(Math.max(0, monthlyRate * activeDays / monthLength(period.start)));
};

const revisionHours = async (
  db: { query: (sql: string, params?: any[]) => Promise<any> },
  revisionId: string,
  period?: { start: string; end: string },
) => {
  const startBoundary = period ? midnightInZone(period.start) : null;
  const endBoundary = period ? midnightInZone(addCalendarDays(period.end, 1)) : null;
  const result = await db.query(
    `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (
       LEAST(effective_end_at, COALESCE($3::timestamptz, effective_end_at))
       - GREATEST(started_at, COALESCE($2::timestamptz, started_at))
     )) / 3600), 0) AS hours
       FROM timesheet_revision_sessions
      WHERE revision_id = $1
        AND effective_end_at > COALESCE($2::timestamptz, started_at)
        AND started_at < COALESCE($3::timestamptz, effective_end_at)`,
    [revisionId, startBoundary, endBoundary],
  );
  return Number(result.rows[0]?.hours ?? 0);
};

async function ensureTrackedPeriods(contract: any, startDate: string, through: string, today: string) {
  const effectiveEndDate = contract.effective_end_date ? dateString(contract.effective_end_date) : null;
  const periods = periodsThrough(startDate, through, effectiveEndDate)
    .filter((period) => period.end < today);
  for (const period of periods) {
    await query(
      `INSERT INTO timesheet_periods (hiring_contract_id, period_start, period_end, work_timezone)
       VALUES ($1, $2::date, $3::date, $4)
       ON CONFLICT (hiring_contract_id, period_start, period_end) DO NOTHING`,
      [contract.id, period.start, period.end, contract.time_zone],
    );
  }
}

async function applyCreditMemosToDraft(client: any, invoiceId: string, now: Date) {
  const invoiceResult = await client.query(
    `SELECT ti.id, ti.hiring_contract_id, ti.period_start, ti.talent_id, ti.currency,
            ti.base_amount, ti.credit_amount, ti.status, o.rate_currency AS source_currency
       FROM talent_invoices ti
       LEFT JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
       LEFT JOIN offers o ON o.id = hc.offer_id
      WHERE ti.id = $1 FOR UPDATE OF ti`,
    [invoiceId],
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice || invoice.status !== "draft") return { appliedIds: [] as string[], creditAmount: 0 };
  if (!isUsdCurrency(invoice.currency) || !isUsdCurrency(invoice.source_currency)) {
    return { appliedIds: [] as string[], creditAmount: Number(invoice.credit_amount), blockedReason: "unsupported_invoice_currency" };
  }
  const currency = billingCurrencyForSource(invoice.currency);
  const memos = await client.query(
    `SELECT cm.id, cm.amount
       FROM talent_credit_memos cm
       JOIN talent_invoices original ON original.id = cm.original_invoice_id
       JOIN hiring_contracts source_contract ON source_contract.id = original.hiring_contract_id
       JOIN offers source_offer ON source_offer.id = source_contract.offer_id
      WHERE cm.hiring_contract_id = $1 AND cm.currency = $2
        AND LOWER(BTRIM(original.currency)) = 'usd'
        AND LOWER(BTRIM(source_offer.rate_currency)) = 'usd'
        AND original.period_end < $3::date
      ORDER BY cm.created_at, cm.id
      FOR UPDATE OF cm`,
    [invoice.hiring_contract_id, currency, invoice.period_start],
  );
  let creditAmount = Number(invoice.credit_amount);
  const appliedIds: string[] = [];
  for (const memo of memos.rows) {
    const appliedTotals = await client.query(
      `SELECT
         COALESCE((SELECT SUM(amount) FROM talent_credit_memo_applications WHERE credit_memo_id = $1), 0)
         + COALESCE((SELECT SUM(amount) FROM talent_credit_memo_applications_v2 WHERE credit_memo_id = $1), 0)
         AS applied`,
      [memo.id],
    );
    const remaining = roundMoney(Number(memo.amount) - Number(appliedTotals.rows[0]?.applied ?? 0));
    if (Math.abs(remaining) < 0.01) continue;
    let applied = remaining;
    if (remaining < 0) {
      const availableToOffset = Math.max(0, Number(invoice.base_amount) + creditAmount);
      applied = -Math.min(Math.abs(remaining), availableToOffset);
    }
    if (Math.abs(applied) < 0.01) continue;
    await client.query(
      `INSERT INTO talent_credit_memo_applications_v2 (credit_memo_id, talent_invoice_id, amount)
       VALUES ($1,$2,$3)`,
      [memo.id, invoice.id, applied.toFixed(2)],
    );
    creditAmount = roundMoney(creditAmount + applied);
    appliedIds.push(memo.id);
  }
  if (appliedIds.length) {
    const totalAmount = roundMoney(Number(invoice.base_amount) + creditAmount);
    await client.query(
      `UPDATE talent_invoices
          SET amount = $2, credit_amount = $3, drafted_at = $4,
              auto_send_at = $5, updated_at = now()
        WHERE id = $1 AND status = 'draft'`,
      [invoice.id, totalAmount.toFixed(2), creditAmount.toFixed(2), now,
        new Date(now.getTime() + 48 * 60 * 60 * 1000)],
    );
  }
  return { appliedIds, creditAmount };
}

async function notifyInvoiceDraft(client: any, invoiceId: string, versionKey: string, updated = false) {
  const invoice = await client.query(
    `SELECT talent_id FROM talent_invoices WHERE id = $1`,
    [invoiceId],
  );
  if (!invoice.rows[0]) return;
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, event_key)
     VALUES ($1, 'talent_invoice_ready', $2, $3, $4, 'talent_invoice', $5)
     ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
    [invoice.rows[0].talent_id,
      updated ? "Your invoice draft was updated" : "Your invoice draft is ready",
      updated
        ? "An approved timesheet revision or Talent credit memo updated this draft. The 48-hour review window has restarted."
        : "Review your invoice draft. It will be sent automatically after 48 hours.",
      invoiceId, `talent_invoice_ready:${invoiceId}:${versionKey}`],
  );
}

async function insertInvoiceDraft(contract: any, period: { start: string; end: string }, startDate: string, now: Date) {
  const currency = billingCurrencyForSource(contract.rate_currency);
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const contractResult = await client.query(
      `SELECT hc.id, hc.status, hc.billing_mode, hc.effective_end_date, o.rate_currency
         FROM hiring_contracts hc JOIN offers o ON o.id = hc.offer_id
        WHERE hc.id = $1 FOR UPDATE OF hc`,
      [contract.id],
    );
    const lockedContract = contractResult.rows[0];
    if (!lockedContract || !["signed", "terminated"].includes(lockedContract.status)
      || !["tracked", "guaranteed"].includes(lockedContract.billing_mode)
      || (lockedContract.effective_end_date
        && period.end > dateString(lockedContract.effective_end_date))) {
      await client.query("ROLLBACK");
      return false;
    }
    billingCurrencyForSource(lockedContract.rate_currency);
    const locked = await client.query(
      `SELECT id FROM talent_invoices
        WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date
        FOR UPDATE`,
      [contract.id, period.start, period.end],
    );
    if (locked.rows.length) {
      await client.query("COMMIT");
      return false;
    }
    let amount: number;
    let hours: number | null = null;
    let standardHours: number | null = null;
    let hourlyEquivalent: number | null = null;
    let revisionId: string | null = null;
    if (contract.billing_mode === "tracked") {
      const timesheet = await client.query(
        `SELECT id, status, approved_revision_id FROM timesheet_periods
          WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date
          FOR UPDATE`,
        [contract.id, period.start, period.end],
      );
      const row = timesheet.rows[0];
      // A prior Client dispute does not pause automatic Talent invoice sending;
      // an approved revision remains the only source of tracked invoice hours.
      if (!row?.approved_revision_id) { await client.query("ROLLBACK"); return false; }
      revisionId = String(row.approved_revision_id);
      hours = await revisionHours(client, revisionId, period);
      const computed = trackedPeriodAmount(Number(contract.rate), contract.engagement_type, hours);
      amount = computed.amount;
      standardHours = computed.standardHours;
      hourlyEquivalent = computed.hourlyEquivalent;
    } else {
      const claim = await client.query(
        `SELECT status FROM guaranteed_nonperformance_claims
          WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date`,
        [contract.id, period.start, period.end],
      );
      if (claim.rows[0]?.status === "open" || claim.rows[0]?.status === "approved") {
        await client.query("ROLLBACK");
        return false;
      }
      amount = guaranteedPeriodAmount(Number(contract.rate), period, startDate);
    }
    const currentDate = dateInZone(now);
    const autoSendAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const paymentDate = payoutDateForPeriod(period, currentDate);
    const inserted = await client.query(
      `INSERT INTO talent_invoices
         (hiring_contract_id, offer_id, talent_id, client_id, billing_mode,
          period_start, period_end, currency, monthly_rate, amount, base_amount,
          credit_amount, hours,
          standard_hours, hourly_equivalent, commission_rate, timesheet_revision_id,
          status, drafted_at, auto_send_at, payout_due_on)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$10,0,$11,$12,$13,0.2000,$14,
               'draft',$15,$16,$17::date)
       ON CONFLICT (hiring_contract_id, period_start, period_end) DO NOTHING
       RETURNING id`,
      [contract.id, contract.offer_id, contract.talent_id, contract.client_id, contract.billing_mode,
        period.start, period.end, currency, Number(contract.rate).toFixed(2), amount.toFixed(2),
        hours, standardHours, hourlyEquivalent, revisionId, now, autoSendAt, paymentDate],
    );
    if (inserted.rows[0]) {
      if (contract.billing_mode === "guaranteed") {
        await client.query(
          `UPDATE guaranteed_nonperformance_claims SET talent_invoice_id = $4
            WHERE hiring_contract_id = $1 AND period_start = $2::date
              AND period_end = $3::date AND talent_invoice_id IS NULL`,
          [contract.id, period.start, period.end, inserted.rows[0].id],
        );
      }
      const applied = await applyCreditMemosToDraft(client, inserted.rows[0].id, now);
      await notifyInvoiceDraft(
        client,
        inserted.rows[0].id,
        `${revisionId ?? "guaranteed"}:${applied.creditAmount.toFixed(2)}`,
      );
    }
    await client.query("COMMIT");
    return Boolean(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function schedulePayoutIfCovered(client: any, invoiceId: string) {
  const invoiceResult = await client.query(
    `SELECT ti.*, o.rate_currency AS source_currency
       FROM talent_invoices ti
       LEFT JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
       LEFT JOIN offers o ON o.id = hc.offer_id
      WHERE ti.id = $1 FOR UPDATE OF ti`,
    [invoiceId],
  );
  const invoice = invoiceResult.rows[0];
  if (!invoice || invoice.status !== "sent") return { scheduled: false, reason: "invoice_not_sent" };
  if (!isUsdCurrency(invoice.currency) || !isUsdCurrency(invoice.source_currency)) {
    return { scheduled: false, reason: "unsupported_invoice_currency" };
  }
  const currency = billingCurrencyForSource(invoice.currency);
  const exists = await client.query(`SELECT id FROM payouts WHERE talent_invoice_id = $1`, [invoiceId]);
  if (exists.rows.length) return { scheduled: true };
  const depositResult = await client.query(
    `SELECT amount, currency FROM security_deposits
      WHERE hiring_contract_id = $1 AND status = 'held' FOR UPDATE`,
    [invoice.hiring_contract_id],
  );
  const deposit = depositResult.rows[0];
  if (!deposit || !isUsdCurrency(deposit.currency)) {
    return { scheduled: false, reason: "held_deposit_missing_or_currency_mismatch" };
  }
  const replenishments = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS amount FROM security_deposit_replenishments
      WHERE hiring_contract_id = $1 AND currency = $2`,
    [invoice.hiring_contract_id, currency],
  );
  const heldCoverage = Number(deposit.amount) + Number(replenishments.rows[0]?.amount ?? 0);
  // Invoice.amount is an immutable draft snapshot that already includes all
  // memo applications; payout scheduling never applies or rewrites credits.
  const payoutAmount = roundMoney(Number(invoice.amount));
  const outstanding = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS amount FROM payouts
      WHERE hiring_contract_id = $1 AND currency = $2
        AND status IN ('pending', 'scheduled', 'disbursed', 'failed')`,
    [invoice.hiring_contract_id, currency],
  );
  if (heldCoverage < Number(outstanding.rows[0]?.amount ?? 0) + payoutAmount) {
    return { scheduled: false, reason: "insufficient_held_deposit" };
  }
  if (payoutAmount > 0) {
    await client.query(
      `INSERT INTO payouts
         (hiring_contract_id, talent_id, talent_invoice_id, amount, currency, status, payout_due_on)
       VALUES ($1, $2, $3, $4, $5, 'scheduled', $6::date)
       ON CONFLICT (talent_invoice_id) WHERE talent_invoice_id IS NOT NULL DO NOTHING`,
      [invoice.hiring_contract_id, invoice.talent_id, invoice.id, payoutAmount.toFixed(2), currency, invoice.payout_due_on],
    );
  }
  return { scheduled: true };
}

async function sendInvoice(invoiceId: string, onlyTalentId?: string) {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const contractIdResult = await client.query(
      `SELECT hiring_contract_id FROM talent_invoices WHERE id = $1`,
      [invoiceId],
    );
    const contractId = contractIdResult.rows[0]?.hiring_contract_id;
    if (!contractId) {
      await client.query("ROLLBACK");
      return { notFound: true };
    }
    const contractResult = await client.query(
      `SELECT hc.id, hc.status, hc.billing_mode, hc.effective_end_date, o.rate_currency
         FROM hiring_contracts hc JOIN offers o ON o.id = hc.offer_id
        WHERE hc.id = $1 FOR UPDATE OF hc`,
      [contractId],
    );
    const contract = contractResult.rows[0];
    const result = await client.query(
      `SELECT id, status, talent_id, period_start, period_end, timesheet_revision_id, currency
         FROM talent_invoices WHERE id = $1 FOR UPDATE`,
      [invoiceId],
    );
    const invoice = result.rows[0];
    if (!invoice || (onlyTalentId && invoice.talent_id !== onlyTalentId)) {
      await client.query("ROLLBACK");
      return { notFound: true };
    }
    if (!contract || !["signed", "terminated"].includes(contract.status)
      || !["draft", "sent"].includes(invoice.status)
      || (contract.effective_end_date
        && dateString(invoice.period_end) > dateString(contract.effective_end_date))) {
      await client.query("ROLLBACK");
      return { notSendable: true };
    }
    if (invoice.status === "draft"
      && (!isUsdCurrency(invoice.currency) || !isUsdCurrency(contract.rate_currency))) {
      await client.query("ROLLBACK");
      return { notSendable: true, reason: "unsupported_invoice_currency" };
    }
    if (invoice.status === "draft" && contract.billing_mode === "tracked"
      && contract.effective_end_date
      && dateString(invoice.period_end) === dateString(contract.effective_end_date)) {
      const finalTimesheet = await client.query(
        `SELECT approved_revision_id FROM timesheet_periods
          WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date
          FOR UPDATE`,
        [contractId, invoice.period_start, invoice.period_end],
      );
      if (!finalTimesheet.rows[0]?.approved_revision_id
        || finalTimesheet.rows[0].approved_revision_id !== invoice.timesheet_revision_id) {
        await client.query("ROLLBACK");
        return { notSendable: true };
      }
    }
    if (invoice.status === "draft") {
      await client.query(
        `UPDATE talent_invoices SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`,
        [invoiceId],
      );
    }
    const payout = await schedulePayoutIfCovered(client, invoiceId);
    await client.query("COMMIT");
    return { sent: true, payout };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function draftCreditApplications(client: any, invoiceId: string) {
  const result = await client.query(
    `SELECT credit_memo_id, SUM(amount) AS amount
       FROM (
         SELECT credit_memo_id, amount FROM talent_credit_memo_applications
          WHERE talent_invoice_id = $1
         UNION ALL
         SELECT credit_memo_id, amount FROM talent_credit_memo_applications_v2
          WHERE talent_invoice_id = $1
       ) applications
      GROUP BY credit_memo_id HAVING SUM(amount) <> 0`,
    [invoiceId],
  );
  return result.rows.map((row: any) => ({ creditMemoId: row.credit_memo_id, amount: Number(row.amount) }));
}

async function appendDraftCreditApplication(client: any, memoId: string, invoiceId: string, amount: number) {
  if (Math.abs(amount) < 0.01) return;
  await client.query(
    `INSERT INTO talent_credit_memo_applications_v2 (credit_memo_id, talent_invoice_id, amount)
     VALUES ($1,$2,$3)`,
    [memoId, invoiceId, amount.toFixed(2)],
  );
}

export async function rebuildDraftInvoicesForTermination(
  client: any,
  contractId: string,
  effectiveEndDate: string,
) {
  const contractResult = await client.query(
    `SELECT hc.id, hc.status, hc.billing_mode, hc.effective_start_date,
            hc.billing_activated_at, o.rate, o.rate_currency, o.engagement_type
       FROM hiring_contracts hc JOIN offers o ON o.id = hc.offer_id
      WHERE hc.id = $1`,
    [contractId],
  );
  const contract = contractResult.rows[0];
  if (!contract || contract.status !== "signed"
    || !["tracked", "guaranteed"].includes(contract.billing_mode)) {
    throw Object.assign(new Error("The signed contract is not eligible for draft invoice rebuilding"), { code: "terminationDraftInvalidContract" });
  }
  billingCurrencyForSource(contract.rate_currency);
  const now = new Date();
  const today = dateInZone(now);
  const effectiveStart = contract.effective_start_date
    ? dateString(contract.effective_start_date)
    : contract.billing_activated_at ? dateInZone(new Date(contract.billing_activated_at)) : null;
  if (!effectiveStart) {
    throw Object.assign(new Error("The contract has no effective billing start date for draft invoice rebuilding"), { code: "terminationDraftUnrebuildable" });
  }
  const activationDate = contract.billing_activated_at
    ? dateInZone(new Date(contract.billing_activated_at))
    : effectiveStart;
  const startDate = effectiveStart > activationDate ? effectiveStart : activationDate;
  const drafts = await client.query(
    `SELECT id, period_start, period_end, currency, base_amount, credit_amount,
            timesheet_revision_id
       FROM talent_invoices
      WHERE hiring_contract_id = $1 AND status = 'draft'
        AND (period_start > $2::date OR period_end > $2::date)
      ORDER BY period_start, id FOR UPDATE`,
    [contractId, effectiveEndDate],
  );
  for (const original of drafts.rows) {
    billingCurrencyForSource(original.currency);
    const originalStart = dateString(original.period_start);
    const originalEnd = dateString(original.period_end);
    if (originalStart > effectiveEndDate) {
      for (const application of await draftCreditApplications(client, original.id)) {
        await appendDraftCreditApplication(client, application.creditMemoId, original.id, -application.amount);
      }
      await client.query(
        `UPDATE talent_invoices SET status = 'void', updated_at = now() WHERE id = $1 AND status = 'draft'`,
        [original.id],
      );
      continue;
    }

    const finalPeriod = { start: originalStart, end: effectiveEndDate };
    let canonicalId = original.id;
    const collision = await client.query(
      `SELECT id, status FROM talent_invoices
        WHERE hiring_contract_id = $1 AND period_start = $2::date
          AND period_end = $3::date AND id <> $4
        FOR UPDATE`,
      [contractId, originalStart, effectiveEndDate, original.id],
    );
    if (collision.rows[0]) {
      if (collision.rows[0].status !== "draft") {
        throw Object.assign(new Error("A final-period invoice already exists in a non-draft state"), { code: "terminationDraftUnrebuildable" });
      }
      canonicalId = collision.rows[0].id;
      for (const application of await draftCreditApplications(client, original.id)) {
        await appendDraftCreditApplication(client, application.creditMemoId, original.id, -application.amount);
        await appendDraftCreditApplication(client, application.creditMemoId, canonicalId, application.amount);
      }
      await client.query(
        `UPDATE talent_invoices SET status = 'void', updated_at = now() WHERE id = $1 AND status = 'draft'`,
        [original.id],
      );
    }

    const canonicalResult = await client.query(
      `SELECT id, period_start, period_end, currency, base_amount, credit_amount,
              timesheet_revision_id
         FROM talent_invoices WHERE id = $1 AND status = 'draft' FOR UPDATE`,
      [canonicalId],
    );
    const invoice = canonicalResult.rows[0];
    if (!invoice) continue;
    const applications = await draftCreditApplications(client, canonicalId);
    const creditAmount = roundMoney(applications.reduce((sum: number, app: any) => sum + app.amount, 0));
    let hours: number | null = null;
    let standardHours: number | null = null;
    let hourlyEquivalent: number | null = null;
    let baseAmount: number;
    if (contract.billing_mode === "tracked") {
      if (!invoice.timesheet_revision_id) {
        throw Object.assign(new Error("A Tracked draft crossing the contract end date has no approved revision"), { code: "terminationDraftUnrebuildable" });
      }
      hours = await revisionHours(client, String(invoice.timesheet_revision_id), finalPeriod);
      const computed = trackedPeriodAmount(Number(contract.rate), contract.engagement_type, hours);
      baseAmount = computed.amount;
      standardHours = computed.standardHours;
      hourlyEquivalent = computed.hourlyEquivalent;
    } else {
      baseAmount = guaranteedPeriodAmount(Number(contract.rate), finalPeriod, startDate);
    }
    const totalAmount = roundMoney(baseAmount + creditAmount);
    if (totalAmount < 0) {
      throw Object.assign(new Error("Existing immutable credit applications exceed the shortened draft amount"), { code: "terminationDraftCreditConflict" });
    }
    const payoutDate = payoutDateForPeriod(finalPeriod, today);
    await client.query(
      `UPDATE talent_invoices
          SET period_end = $2::date, base_amount = $3, amount = $4, credit_amount = $5,
              hours = $6, standard_hours = $7, hourly_equivalent = $8,
              drafted_at = $9, auto_send_at = $10, payout_due_on = $11::date, updated_at = now()
        WHERE id = $1 AND status = 'draft'`,
      [canonicalId, effectiveEndDate, baseAmount.toFixed(2), totalAmount.toFixed(2),
        creditAmount.toFixed(2), hours, standardHours, hourlyEquivalent, now,
        new Date(now.getTime() + 48 * 60 * 60 * 1000), payoutDate],
    );
    const applied = await applyCreditMemosToDraft(client, canonicalId, now);
    await notifyInvoiceDraft(
      client, canonicalId,
      `termination:${effectiveEndDate}:${invoice.timesheet_revision_id ?? "guaranteed"}:${applied.creditAmount.toFixed(2)}`,
      true,
    );
  }
}

async function reconcileTrackedCorrections(now: Date) {
  const changed = await query(
    `SELECT ti.id AS invoice_id, ti.hiring_contract_id, ti.talent_id, ti.currency,
            ti.period_start, ti.period_end,
            ti.status, ti.base_amount AS original_amount, ti.timesheet_revision_id AS original_revision_id,
            tp.approved_revision_id AS corrected_revision_id, o.rate, o.rate_currency, o.engagement_type
       FROM talent_invoices ti
       JOIN timesheet_periods tp ON tp.hiring_contract_id = ti.hiring_contract_id
        AND tp.period_start = ti.period_start AND tp.period_end = ti.period_end
       JOIN offers o ON o.id = ti.offer_id
      WHERE ti.billing_mode = 'tracked' AND ti.status IN ('draft', 'sent')
        AND tp.approved_revision_id IS NOT NULL
        AND (
          tp.approved_revision_id IS DISTINCT FROM ti.timesheet_revision_id
          OR (ti.status = 'sent' AND EXISTS (
            SELECT 1 FROM talent_credit_memos cm WHERE cm.original_invoice_id = ti.id
          ))
        )`,
  );
  for (const row of changed.rows) {
    if (!isUsdCurrency(row.currency) || !isUsdCurrency(row.rate_currency)) {
      console.error(`Tracked correction blocked for invoice ${row.invoice_id}: non-USD source currency`);
      continue;
    }
    const currency = billingCurrencyForSource(row.rate_currency);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const lockedContract = await client.query(
        `SELECT hc.id, hc.effective_end_date
           FROM hiring_contracts hc
          WHERE hc.id = $1 FOR UPDATE`,
        [row.hiring_contract_id],
      );
      const invoice = await client.query(
        `SELECT id, hiring_contract_id, status, amount, base_amount, credit_amount,
                period_start, period_end, timesheet_revision_id
           FROM talent_invoices WHERE id = $1 FOR UPDATE`,
        [row.invoice_id],
      );
      const period = await client.query(
        `SELECT tp.approved_revision_id
           FROM timesheet_periods tp JOIN talent_invoices ti
             ON ti.hiring_contract_id = tp.hiring_contract_id
            AND ti.period_start = tp.period_start AND ti.period_end = tp.period_end
          WHERE ti.id = $1 FOR UPDATE OF tp`,
        [row.invoice_id],
      );
      const current = invoice.rows[0];
      const correctedRevisionId = period.rows[0]?.approved_revision_id;
      if (!current || !correctedRevisionId || current.status === "void"
        || (current.status === "draft" && correctedRevisionId === current.timesheet_revision_id)) {
        await client.query("COMMIT");
        continue;
      }
      const invoiceEnd = dateString(current.period_end);
      const contractEnd = lockedContract.rows[0]?.effective_end_date
        ? dateString(lockedContract.rows[0].effective_end_date)
        : null;
      const correctionEnd = contractEnd && contractEnd < invoiceEnd ? contractEnd : invoiceEnd;
      const correctedHours = await revisionHours(client, correctedRevisionId, {
        start: dateString(current.period_start),
        end: correctionEnd,
      });
      const computed = trackedPeriodAmount(Number(row.rate), row.engagement_type, correctedHours);
      if (current.status === "draft") {
        const revisedAmount = roundMoney(computed.amount + Number(current.credit_amount));
        await client.query(
          `UPDATE talent_invoices
              SET base_amount = $2, amount = $3, hours = $4, standard_hours = $5,
                  hourly_equivalent = $6, timesheet_revision_id = $7,
                  drafted_at = now(), auto_send_at = now() + interval '48 hours', updated_at = now()
            WHERE id = $1`,
          [row.invoice_id, computed.amount.toFixed(2), revisedAmount.toFixed(2), correctedHours,
            computed.standardHours, computed.hourlyEquivalent, correctedRevisionId],
        );
        const applied = await applyCreditMemosToDraft(client, row.invoice_id, now);
        await notifyInvoiceDraft(
          client,
          row.invoice_id,
          `${correctedRevisionId}:${applied.creditAmount.toFixed(2)}`,
          true,
        );
        await client.query("COMMIT");
        continue;
      }
      const prior = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS amount FROM talent_credit_memos WHERE original_invoice_id = $1`,
        [row.invoice_id],
      );
      const delta = roundMoney(computed.amount - Number(row.original_amount) - Number(prior.rows[0]?.amount ?? 0));
      if (Math.abs(delta) >= 0.01) {
        await client.query(
          `INSERT INTO talent_credit_memos
             (original_invoice_id, corrected_revision_id, talent_id, hiring_contract_id, currency, amount)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [row.invoice_id, correctedRevisionId, row.talent_id, row.hiring_contract_id, currency, delta.toFixed(2)],
        );
      }
      // Compare the net memo balance with the currently approved revision on
      // every sent invoice that has correction history. A reversion to the
      // original revision therefore creates a signed compensating memo. The
      // invoice lock plus net-balance check makes retries idempotent.
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

async function applyAvailableCreditsToDrafts(now: Date) {
  const drafts = await query(
    `SELECT id FROM talent_invoices WHERE status = 'draft'
      ORDER BY period_start, created_at, id`,
  );
  for (const draft of drafts.rows) {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const applied = await applyCreditMemosToDraft(client, draft.id, now);
      if ("blockedReason" in applied) {
        console.error(`Talent credit application blocked for invoice ${draft.id}: ${applied.blockedReason}`);
      }
      if (applied.appliedIds.length) {
        await notifyInvoiceDraft(
          client,
          draft.id,
          `credit:${applied.appliedIds.join(",")}:${applied.creditAmount.toFixed(2)}`,
          true,
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

async function readyClientsForMonth(monthStart: string) {
  const monthEnd = addCalendarDays(addCalendarDays(monthStart, monthLength(monthStart)), -1);
  const contracts = await query(
    `SELECT hc.id, hc.billing_mode, hc.effective_start_date, hc.billing_activated_at,
            hc.effective_end_date, js.client_id
       FROM hiring_contracts hc
       JOIN job_submissions js ON js.id = hc.submission_id
      WHERE hc.status IN ('signed', 'terminated') AND hc.billing_mode IN ('tracked', 'guaranteed')
        AND hc.effective_start_date IS NOT NULL AND hc.billing_activated_at IS NOT NULL
      ORDER BY js.client_id, hc.id`,
  );
  const readiness = new Map<string, boolean>();
  for (const contract of contracts.rows) {
    const effectiveStart = dateString(contract.effective_start_date);
    const activationDate = dateInZone(new Date(contract.billing_activated_at));
    const startDate = effectiveStart > activationDate ? effectiveStart : activationDate;
    const effectiveEndDate = contract.effective_end_date ? dateString(contract.effective_end_date) : null;
    if (startDate > monthEnd || (effectiveEndDate && effectiveEndDate < monthStart)) continue;
    let ready = true;
    const expected = periodsThrough(startDate, monthEnd, effectiveEndDate)
      .filter((period) => period.start >= monthStart && period.end <= monthEnd);
    for (const period of expected) {
      if (contract.billing_mode === "guaranteed") {
        const claim = await query(
          `SELECT status FROM guaranteed_nonperformance_claims
            WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date`,
          [contract.id, period.start, period.end],
        );
        if (claim.rows[0]?.status === "approved") continue;
        if (claim.rows[0]?.status === "open") { ready = false; break; }
      } else {
        const timesheet = await query(
          `SELECT approved_revision_id FROM timesheet_periods
            WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date`,
          [contract.id, period.start, period.end],
        );
        if (!timesheet.rows[0]?.approved_revision_id) { ready = false; break; }
      }
      const invoice = await query(
        `SELECT id FROM talent_invoices
          WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date
            AND status = 'sent'`,
        [contract.id, period.start, period.end],
      );
      if (!invoice.rows.length) { ready = false; break; }
    }
    readiness.set(contract.client_id, (readiness.get(contract.client_id) ?? true) && ready);
  }
  return Array.from(readiness.entries()).filter(([, ready]) => ready).map(([clientId]) => clientId);
}

async function generateClientMonthlyInvoices(monthStart: string) {
  const monthEnd = addCalendarDays(addCalendarDays(monthStart, monthLength(monthStart)), -1);
  const readyClients = await readyClientsForMonth(monthStart);
  if (!readyClients.length) return;
  const result = await query(
    `SELECT ti.*, o.rate_currency AS source_currency
       FROM talent_invoices ti
       LEFT JOIN offers o ON o.id = ti.offer_id
      WHERE ti.period_start >= $1::date AND ti.period_start <= $2::date
        AND ti.status = 'sent' AND ti.client_id = ANY($3::varchar[])
      ORDER BY ti.client_id, ti.currency, ti.period_start, ti.id`,
    [monthStart, monthEnd, readyClients],
  );
  const groups = new Map<string, any[]>();
  const blockedClients = new Map<string, Set<string>>();
  for (const invoice of result.rows) {
    if (!isUsdCurrency(invoice.currency) || !isUsdCurrency(invoice.source_currency)) {
      const currencies = blockedClients.get(invoice.client_id) ?? new Set<string>();
      currencies.add(`invoice=${String(invoice.currency || "missing")}, offer=${String(invoice.source_currency || "missing")}`);
      blockedClients.set(invoice.client_id, currencies);
      continue;
    }
    const key = invoice.client_id;
    groups.set(key, [...(groups.get(key) ?? []), invoice]);
  }
  for (const [clientId, currencies] of Array.from(blockedClients.entries())) {
    console.error(
      `Monthly Client invoice generation blocked for client ${clientId}, month ${monthStart}: `
      + `legacy non-USD source invoice currency (${Array.from(currencies).join(", ")})`,
    );
    groups.delete(clientId);
  }
  for (const invoices of Array.from(groups.values())) {
    const currency = billingCurrencyForSource(invoices[0].source_currency);
    for (const invoice of invoices) {
      billingCurrencyForSource(invoice.currency);
      billingCurrencyForSource(invoice.source_currency);
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const clientId = invoices[0].client_id;
      const existing = await client.query(
        `SELECT id, currency FROM client_monthly_invoices
          WHERE client_id = $1 AND invoice_month = $2::date
          FOR UPDATE`,
        [clientId, monthStart],
      );
      const legacyStatements = existing.rows.filter((row: any) => !isUsdCurrency(row.currency));
      if (legacyStatements.length) {
        await client.query("COMMIT");
        console.error(
          `Monthly Client invoice generation blocked for client ${clientId}, month ${monthStart}: `
          + `existing statement has non-USD currency (${legacyStatements.map((row: any) => row.currency).join(", ")})`,
        );
        continue;
      }
      if (existing.rows.length) { await client.query("COMMIT"); continue; }
      const subtotal = roundMoney(invoices.reduce(
        (sum: number, invoice: any) => sum + roundMoney(Number(invoice.base_amount) * (1 + Number(invoice.commission_rate))),
        0,
      ));
      const saved = await client.query(
        `INSERT INTO client_monthly_invoices (client_id, invoice_month, currency, subtotal, status)
         VALUES ($1,$2::date,$3,$4,'draft')
         ON CONFLICT (client_id, invoice_month, currency) DO NOTHING
         RETURNING id`,
        [clientId, monthStart, currency, subtotal.toFixed(2)],
      );
      if (!saved.rows[0]) { await client.query("COMMIT"); continue; }
      for (const invoice of invoices) {
        // Talent-only forward credit memos must never become Client credits.
        // The monthly Client statement uses the immutable underlying Talent
        // service amount, with the commission bundled into the all-in line.
        const clientAmount = roundMoney(Number(invoice.base_amount) * (1 + Number(invoice.commission_rate)));
        await client.query(
          `INSERT INTO client_monthly_invoice_lines
             (client_monthly_invoice_id, talent_invoice_id, talent_amount, commission_rate, client_amount)
           VALUES ($1,$2,$3,$4,$5)`,
          [saved.rows[0].id, invoice.id, invoice.base_amount, invoice.commission_rate, clientAmount.toFixed(2)],
        );
      }
      // Client-side late Guaranteed credits are applied only while constructing
      // a new draft statement. The immutable source invoice and any sent
      // statement are never edited; unused balances remain available to roll
      // forward to a later monthly statement.
      let statementTotal = subtotal;
      const creditMemos = await client.query(
        `SELECT cm.id, cm.all_in_amount
           FROM client_credit_memos cm
           JOIN talent_invoices source_invoice ON source_invoice.id = cm.original_talent_invoice_id
           JOIN hiring_contracts source_contract ON source_contract.id = source_invoice.hiring_contract_id
           JOIN offers source_offer ON source_offer.id = source_contract.offer_id
          WHERE cm.client_id = $1 AND cm.currency = $2
            AND LOWER(BTRIM(source_invoice.currency)) = 'usd'
            AND LOWER(BTRIM(source_offer.rate_currency)) = 'usd'
            AND (
              (
                date_trunc('month', cm.period_start)::date = $3::date
                AND NOT EXISTS (
                  SELECT 1
                    FROM client_monthly_invoice_lines source_line
                    JOIN client_monthly_invoices source_statement
                      ON source_statement.id = source_line.client_monthly_invoice_id
                   WHERE source_line.talent_invoice_id = cm.original_talent_invoice_id
                     AND source_statement.status = 'sent'
                )
              )
              OR (
                date_trunc('month', cm.period_start)::date < $3::date
                AND $3::date >= date_trunc(
                  'month', cm.created_at AT TIME ZONE 'America/New_York'
                )::date
              )
            )
          ORDER BY cm.created_at, cm.id
          FOR UPDATE`,
        [clientId, currency, monthStart],
      );
      for (const memo of creditMemos.rows) {
        const alreadyApplied = await client.query(
          `SELECT COALESCE(SUM(amount), 0) AS amount
             FROM client_credit_applications WHERE client_credit_memo_id = $1`,
          [memo.id],
        );
        const remaining = roundMoney(Number(memo.all_in_amount) - Number(alreadyApplied.rows[0]?.amount ?? 0));
        if (remaining <= 0 || statementTotal <= 0) continue;
        const applied = roundMoney(Math.min(remaining, statementTotal));
        if (applied <= 0) continue;
        await client.query(
          `INSERT INTO client_credit_applications
             (client_credit_memo_id, client_monthly_invoice_id, amount)
           VALUES ($1,$2,$3)
           ON CONFLICT (client_credit_memo_id, client_monthly_invoice_id) DO NOTHING`,
          [memo.id, saved.rows[0].id, applied.toFixed(2)],
        );
        statementTotal = roundMoney(statementTotal - applied);
      }
      if (statementTotal !== subtotal) {
        await client.query(
          `UPDATE client_monthly_invoices SET subtotal = $2 WHERE id = $1 AND status = 'draft'`,
          [saved.rows[0].id, statementTotal.toFixed(2)],
        );
      }
      await client.query(
        `UPDATE client_monthly_invoices SET status = 'sent' WHERE id = $1 AND status = 'draft'`,
        [saved.rows[0].id],
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, event_key)
         VALUES ($1, 'monthly_client_invoice', 'Your monthly invoice is ready',
           'Your complete all-in invoice statement is available.', $2, 'client_monthly_invoice', $3)
         ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
        [clientId, saved.rows[0].id,
          `monthly_client_invoice:${saved.rows[0].id}:${subtotal.toFixed(2)}`],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

async function catchUpClientMonthlyInvoices(now: Date) {
  const today = dateInZone(now);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const earliest = await query(
    `SELECT MIN(GREATEST(
        hc.effective_start_date,
        (hc.billing_activated_at AT TIME ZONE '${BILLING_TIME_ZONE}')::date
      )) AS first_billable_date
       FROM hiring_contracts hc
      WHERE hc.status IN ('signed', 'terminated') AND hc.billing_mode IN ('tracked', 'guaranteed')
        AND hc.effective_start_date IS NOT NULL AND hc.billing_activated_at IS NOT NULL`,
  );
  if (!earliest.rows[0]?.first_billable_date) return;
  const firstDate = dateString(earliest.rows[0].first_billable_date);
  let month = `${firstDate.slice(0, 7)}-01`;
  while (month < currentMonth) {
    try {
      await generateClientMonthlyInvoices(month);
    } catch (error) {
      console.error(`Monthly Client invoice generation failed for ${month}:`, error);
    }
    const [year, monthNumber] = month.split("-").map(Number);
    month = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  }
}

export async function runTalentInvoiceAutomation(now = new Date()) {
  await reconcileTrackedCorrections(now);
  const today = dateInZone(now);
  const contracts = await query(
    `SELECT hc.id, hc.offer_id, hc.billing_mode, hc.submission_id,
            hc.effective_start_date, hc.billing_activated_at, hc.effective_end_date,
            o.rate, o.rate_currency, o.engagement_type,
            js.talent_id, js.client_id, j.time_zone
       FROM hiring_contracts hc
       JOIN offers o ON o.id = hc.offer_id
       JOIN job_submissions js ON js.id = hc.submission_id
       JOIN jobs j ON j.id = js.job_id
      WHERE hc.status IN ('signed', 'terminated') AND hc.billing_mode IN ('tracked', 'guaranteed')
      ORDER BY hc.created_at`,
  );
  for (const contract of contracts.rows) {
    if (!isUsdCurrency(contract.rate_currency)) {
      console.error(`Talent invoice generation blocked for contract ${contract.id}: unsupported source currency ${String(contract.rate_currency || "missing")}`);
      continue;
    }
    const rate = validMoney(contract.rate);
    if (rate === null || rate <= 0) {
      console.error(`Talent invoice generation blocked for contract ${contract.id}: invalid signed offer rate`);
      continue;
    }
    if (!contract.effective_start_date || !contract.billing_activated_at) {
      console.error(`Talent invoice generation blocked for contract ${contract.id}: signed contract has no immutable effective start/activation snapshot`);
      continue;
    }
    const effectiveStart = dateString(contract.effective_start_date);
    const activationDate = dateInZone(new Date(contract.billing_activated_at));
    const startDate = effectiveStart > activationDate ? effectiveStart : activationDate;
    const effectiveEndDate = contract.effective_end_date ? dateString(contract.effective_end_date) : null;
    const through = effectiveEndDate && effectiveEndDate < today ? effectiveEndDate : today;
    if (startDate > through) continue;
    if (contract.billing_mode === "tracked") await ensureTrackedPeriods(contract, startDate, through, today);
    for (const period of periodsThrough(startDate, through, effectiveEndDate).filter((item) => item.end < today)) {
      if (contract.billing_mode === "guaranteed" && now < claimDeadlineForPeriod(period.end)) continue;
      try {
        await insertInvoiceDraft(contract, period, startDate, now);
      } catch (error) {
        console.error(`Talent invoice generation failed for contract ${contract.id}, period ${period.start}:`, error);
      }
    }
  }
  await applyAvailableCreditsToDrafts(now);
  // Retry already-sent invoices before sending newer drafts so available held
  // collateral is reserved for the oldest outstanding obligations first.
  const sentInvoices = await query(
    `SELECT id FROM talent_invoices ti
      WHERE status = 'sent' AND NOT EXISTS
        (SELECT 1 FROM payouts p WHERE p.talent_invoice_id = ti.id)
      ORDER BY sent_at, period_start`,
  );
  for (const invoice of sentInvoices.rows) {
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await schedulePayoutIfCovered(client, invoice.id);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`Payout scheduling failed for Talent invoice ${invoice.id}:`, error);
    } finally { client.release(); }
  }
  const sentDrafts = await query(
    `SELECT id FROM talent_invoices WHERE status = 'draft' AND auto_send_at <= $1 ORDER BY auto_send_at`,
    [now],
  );
  for (const invoice of sentDrafts.rows) {
    try { await sendInvoice(invoice.id); }
    catch (error) { console.error(`Automatic Talent invoice send failed for ${invoice.id}:`, error); }
  }
  await catchUpClientMonthlyInvoices(now);
}

export function registerTalentInvoiceRoutes(app: Express, options: Options) {
  const talentAuth = [options.authenticateJWT, options.requireTalent];
  const clientAuth = [options.authenticateJWT, options.requireClient];
  const adminAuth = [options.authenticateJWT, options.requireAdmin, options.requireAdminSubRole(["talent_acquisition"])];

  app.get("/api/talent/invoices", ...talentAuth, async (req: any, res) => {
    try {
      const talentId = await options.getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
      const result = await query(
        `SELECT id, period_start, period_end, currency, amount, base_amount, credit_amount,
                status, drafted_at, auto_send_at, sent_at, payout_due_on,
                billing_mode, hours, created_at
           FROM talent_invoices WHERE talent_id = $1
          ORDER BY period_start DESC, created_at DESC`,
        [talentId],
      );
      return res.json({
        invoices: result.rows.map((row: any) => ({
          ...row,
          payout_due_on: row.payout_due_on ? dateString(row.payout_due_on) : null,
        })),
      });
    } catch (error) {
      console.error("GET Talent invoices failed", error);
      return res.status(500).json({ error: "Failed to load Talent invoices" });
    }
  });

  app.get("/api/talent/invoices/:id", ...talentAuth, async (req: any, res) => {
    try {
      const talentId = await options.getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
      const invoice = await query(
        `SELECT id, period_start, period_end, currency, amount, base_amount, credit_amount,
                status, drafted_at, auto_send_at, sent_at, payout_due_on, billing_mode, hours
           FROM talent_invoices WHERE id = $1 AND talent_id = $2`,
        [req.params.id, talentId],
      );
      if (!invoice.rows.length) return res.status(404).json({ error: "Invoice not found" });
      const adjustments = await query(
        `SELECT cm.id AS credit_memo_id, cm.amount AS memo_amount, app.amount AS applied_amount,
                original.period_start AS source_period_start, original.period_end AS source_period_end,
                app.created_at
           FROM talent_credit_memo_applications_v2 app
           JOIN talent_credit_memos cm ON cm.id = app.credit_memo_id
           JOIN talent_invoices original ON original.id = cm.original_invoice_id
          WHERE app.talent_invoice_id = $1 AND cm.talent_id = $2
          UNION ALL
         SELECT cm.id, cm.amount, app.amount, original.period_start, original.period_end, app.created_at
           FROM talent_credit_memo_applications app
           JOIN talent_credit_memos cm ON cm.id = app.credit_memo_id
           JOIN talent_invoices original ON original.id = cm.original_invoice_id
          WHERE app.talent_invoice_id = $1 AND cm.talent_id = $2
          ORDER BY created_at, credit_memo_id`,
        [req.params.id, talentId],
      );
      return res.json({
        invoice: {
          ...invoice.rows[0],
          payout_due_on: invoice.rows[0].payout_due_on ? dateString(invoice.rows[0].payout_due_on) : null,
        },
        creditAdjustments: adjustments.rows,
      });
    } catch (error) {
      console.error("GET Talent invoice failed", error);
      return res.status(500).json({ error: "Failed to load Talent invoice" });
    }
  });

  app.post("/api/talent/invoices/:id/send", ...talentAuth, async (req: any, res) => {
    try {
      const talentId = await options.getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
      const sent = await sendInvoice(req.params.id, talentId);
      if (sent.notFound) return res.status(404).json({ error: "Invoice not found" });
      if (sent.notSendable) return res.status(409).json({
        error: sent.reason === "unsupported_invoice_currency"
          ? "Existing non-USD invoices cannot enter new billing workflows"
          : "Invoice cannot be sent after its contract end date",
        ...(sent.reason ? { code: sent.reason } : {}),
      });
      return res.json({ sent: true, payoutScheduled: sent.payout?.scheduled ?? false, payoutBlock: sent.payout?.reason ?? null });
    } catch (error) {
      console.error("POST Talent invoice send failed", error);
      return res.status(500).json({ error: "Failed to send Talent invoice" });
    }
  });

  app.get("/api/talent/credit-memos", ...talentAuth, async (req: any, res) => {
    try {
      const talentId = await options.getTalentBillingUserId(req);
      if (!talentId) return res.status(404).json({ error: "Talent profile not found" });
      const result = await query(
        `SELECT cm.id, cm.currency, cm.amount, cm.created_at,
                ti.period_start AS original_period_start, ti.period_end AS original_period_end,
                cm.amount - COALESCE(SUM(app.amount), 0) AS remaining_amount
           FROM talent_credit_memos cm
           JOIN talent_invoices ti ON ti.id = cm.original_invoice_id
           LEFT JOIN (
             SELECT credit_memo_id, amount FROM talent_credit_memo_applications
             UNION ALL
             SELECT credit_memo_id, amount FROM talent_credit_memo_applications_v2
           ) app ON app.credit_memo_id = cm.id
          WHERE cm.talent_id = $1
          GROUP BY cm.id, ti.period_start, ti.period_end
          ORDER BY cm.created_at DESC`,
        [talentId],
      );
      return res.json({ creditMemos: result.rows });
    } catch (error) {
      console.error("GET Talent credit memos failed", error);
      return res.status(500).json({ error: "Failed to load Talent credit memos" });
    }
  });

  app.post("/api/client/guaranteed-claims", ...clientAuth, async (req: any, res) => {
    const { hiringContractId, periodStart, reason } = req.body ?? {};
    if (typeof hiringContractId !== "string" || typeof periodStart !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/.test(periodStart)
      || typeof reason !== "string" || !reason.trim() || reason.trim().length > 2000) {
      return res.status(422).json({ error: "hiringContractId, periodStart, and a claim reason up to 2000 characters are required" });
    }
    const period = halfMonthPeriod(periodStart);
    if (period.start !== periodStart) return res.status(422).json({ error: "periodStart must be the first day of a half-month period" });
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const own = await client.query(
        `SELECT hc.id, hc.effective_start_date, hc.billing_activated_at, o.rate_currency
           FROM hiring_contracts hc
           JOIN offers o ON o.id = hc.offer_id
          JOIN job_submissions js ON js.id = hc.submission_id
         WHERE hc.id = $1 AND js.client_id = $2 AND hc.status = 'signed'
           AND hc.billing_mode = 'guaranteed' FOR UPDATE OF hc`,
        [hiringContractId, req.user.id],
      );
      if (!own.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Guaranteed contract not found" });
      }
      try {
        billingCurrencyForSource(own.rows[0].rate_currency);
      } catch (error: any) {
        await client.query("ROLLBACK");
        return res.status(error.status ?? 400).json({ error: error.message, code: error.code });
      }
      if (!own.rows[0].effective_start_date || !own.rows[0].billing_activated_at) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Guaranteed contract has no immutable effective start/activation snapshot" });
      }
      const effectiveStart = dateString(own.rows[0].effective_start_date);
      const activationDate = dateInZone(new Date(own.rows[0].billing_activated_at));
      const billableStart = effectiveStart > activationDate ? effectiveStart : activationDate;
      if (period.end < billableStart) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Claim period predates the contract's billable start" });
      }
      const now = new Date();
      if (dateInZone(now) < period.start) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Claims can only be filed for a period that has begun" });
      }
      if (now >= claimDeadlineForPeriod(period.end)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "The Client claim deadline for this period has passed" });
      }
      const existingInvoice = await client.query(
        `SELECT id FROM talent_invoices
          WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date`,
        [hiringContractId, period.start, period.end],
      );
      if (existingInvoice.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "An invoice draft already exists for this period" });
      }
      const inserted = await client.query(
        `INSERT INTO guaranteed_nonperformance_claims
           (hiring_contract_id, client_id, period_start, period_end, reason)
         VALUES ($1,$2,$3::date,$4::date,$5) RETURNING id, status, created_at`,
        [hiringContractId, req.user.id, period.start, period.end, reason.trim()],
      );
      await client.query("COMMIT");
      return res.status(201).json({ claim: inserted.rows[0] });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23505") return res.status(409).json({ error: "A claim already exists for this period" });
      console.error("POST Client guaranteed claim failed", error);
      return res.status(500).json({ error: "Failed to submit guaranteed invoice claim" });
    } finally { client.release(); }
  });

  app.get("/api/client/late-guaranteed-invoices", ...clientAuth, async (req: any, res) => {
    try {
      const result = await query(
        `SELECT ti.id AS talent_invoice_id, ti.hiring_contract_id, ti.period_start,
                ti.period_end, ti.currency, j.title AS job_title
           FROM talent_invoices ti
           JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE ti.client_id = $1 AND js.client_id = $1
            AND ti.billing_mode = 'guaranteed' AND ti.status = 'sent'
            AND NOT EXISTS (
              SELECT 1 FROM client_late_guaranteed_claims c
               WHERE c.original_talent_invoice_id = ti.id
            )
          ORDER BY ti.period_start DESC, j.title`,
        [req.user.id],
      );
      return res.json({ invoices: result.rows });
    } catch (error) {
      console.error("GET Client late Guaranteed claim periods failed", error);
      return res.status(500).json({ error: "Failed to load late claim periods" });
    }
  });

  app.post("/api/client/late-guaranteed-claims", ...clientAuth, async (req: any, res) => {
    const { talentInvoiceId, reason } = req.body ?? {};
    if (typeof talentInvoiceId !== "string" || typeof reason !== "string"
      || !reason.trim() || reason.trim().length > 2000) {
      return res.status(422).json({ error: "talentInvoiceId and a claim reason up to 2000 characters are required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const invoice = await client.query(
        `SELECT ti.id, ti.hiring_contract_id, ti.client_id, ti.period_start, ti.period_end,
                ti.currency, ti.status, ti.billing_mode, js.client_id AS contract_client,
                o.rate_currency AS source_currency
           FROM talent_invoices ti
           JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
           JOIN offers o ON o.id = hc.offer_id
           JOIN job_submissions js ON js.id = hc.submission_id
          WHERE ti.id = $1 AND ti.client_id = $2 AND js.client_id = $2
            AND ti.billing_mode = 'guaranteed'
          FOR UPDATE OF ti`,
        [talentInvoiceId, req.user.id],
      );
      const source = invoice.rows[0];
      if (!source || source.status !== "sent") {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Sent Guaranteed Talent invoice not found" });
      }
      try {
        billingCurrencyForSource(source.currency);
        billingCurrencyForSource(source.source_currency);
      } catch (error: any) {
        await client.query("ROLLBACK");
        return res.status(error.status ?? 400).json({ error: error.message, code: error.code });
      }
      if (new Date() < claimDeadlineForPeriod(dateString(source.period_end))) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Late claims can only be filed after the Client claim deadline" });
      }
      const inserted = await client.query(
        `INSERT INTO client_late_guaranteed_claims
           (hiring_contract_id, original_talent_invoice_id, client_id, period_start, period_end, reason)
         VALUES ($1,$2,$3,$4::date,$5::date,$6)
         RETURNING id, status, period_start, period_end, created_at`,
        [source.hiring_contract_id, source.id, req.user.id, source.period_start, source.period_end, reason.trim()],
      );
      await client.query("COMMIT");
      return res.status(201).json({ claim: inserted.rows[0] });
    } catch (error: any) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23505") return res.status(409).json({ error: "A late claim already exists for this invoice period" });
      console.error("POST Client late Guaranteed claim failed", error);
      return res.status(500).json({ error: "Failed to submit late Guaranteed claim" });
    } finally { client.release(); }
  });

  app.get("/api/client/late-guaranteed-claims", ...clientAuth, async (req: any, res) => {
    try {
      const result = await query(
        `SELECT c.id, c.hiring_contract_id, c.original_talent_invoice_id AS talent_invoice_id,
                c.period_start, c.period_end, c.reason, c.status, c.decision_reason,
                c.created_at, c.decided_at, j.title AS job_title,
                cm.id AS client_credit_memo_id, cm.currency, cm.all_in_amount,
                COALESCE(SUM(app.amount), 0) AS applied_amount
           FROM client_late_guaranteed_claims c
           JOIN hiring_contracts hc ON hc.id = c.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN client_credit_memos cm ON cm.late_claim_id = c.id
           LEFT JOIN client_credit_applications app ON app.client_credit_memo_id = cm.id
          WHERE c.client_id = $1 AND js.client_id = $1
          GROUP BY c.id, j.title, cm.id, cm.currency, cm.all_in_amount
          ORDER BY c.created_at DESC`,
        [req.user.id],
      );
      return res.json({ claims: result.rows });
    } catch (error) {
      console.error("GET Client late Guaranteed claims failed", error);
      return res.status(500).json({ error: "Failed to load late claim history" });
    }
  });

  app.get("/api/admin/late-guaranteed-claims", ...adminAuth, async (_req: any, res) => {
    try {
      const result = await query(
        `SELECT c.*, ti.currency, ti.amount AS talent_invoice_amount,
                ti.base_amount, ti.commission_rate, j.title AS job_title,
                js.talent_id
           FROM client_late_guaranteed_claims c
           JOIN talent_invoices ti ON ti.id = c.original_talent_invoice_id
           JOIN hiring_contracts hc ON hc.id = c.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE c.status = 'open'
          ORDER BY c.created_at`,
      );
      return res.json({ claims: result.rows });
    } catch (error) {
      console.error("GET Admin late Guaranteed claims failed", error);
      return res.status(500).json({ error: "Failed to load late claim queue" });
    }
  });

  app.post("/api/admin/late-guaranteed-claims/:id/decision", ...adminAuth, async (req: any, res) => {
    const { decision, reason } = req.body ?? {};
    if (!["approve", "reject"].includes(decision) || typeof reason !== "string" || !reason.trim()) {
      return res.status(422).json({ error: "decision (approve or reject) and reason are required" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const claim = await client.query(
        `SELECT c.*, ti.currency, ti.base_amount, ti.commission_rate, ti.status AS invoice_status,
                o.rate_currency AS source_currency
           FROM client_late_guaranteed_claims c
           JOIN talent_invoices ti ON ti.id = c.original_talent_invoice_id
           JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
           JOIN offers o ON o.id = hc.offer_id
          WHERE c.id = $1 FOR UPDATE OF c, ti`,
        [req.params.id],
      );
      if (!claim.rows.length || claim.rows[0].status !== "open") {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Open late Guaranteed claim not found" });
      }
      const row = claim.rows[0];
      if (row.invoice_status !== "sent") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "The original Talent invoice must remain sent" });
      }
      let creditMemoCurrency: typeof BILLING_CURRENCY | null = null;
      if (decision === "approve") {
        try {
          creditMemoCurrency = billingCurrencyForSource(row.currency);
          billingCurrencyForSource(row.source_currency);
        } catch (error: any) {
          await client.query("ROLLBACK");
          return res.status(error.status ?? 400).json({ error: error.message, code: error.code });
        }
      }
      const saved = await client.query(
        `UPDATE client_late_guaranteed_claims
            SET status = $2, decision_reason = $3, decided_by = $4, decided_at = now()
          WHERE id = $1 AND status = 'open'
          RETURNING id, status, decision_reason, decided_at`,
        [row.id, decision === "approve" ? "approved" : "rejected", reason.trim(), req.user.id],
      );
      if (decision === "approve") {
        const currency = creditMemoCurrency!;
        const snapshot = await client.query(
          `SELECT l.client_amount
             FROM client_monthly_invoice_lines l
             JOIN client_monthly_invoices i ON i.id = l.client_monthly_invoice_id
            WHERE l.talent_invoice_id = $1
            ORDER BY i.created_at LIMIT 1`,
          [row.original_talent_invoice_id],
        );
        const allInAmount = snapshot.rows.length
          ? Number(snapshot.rows[0].client_amount)
          : roundMoney(Number(row.base_amount) * (1 + Number(row.commission_rate)));
        if (allInAmount <= 0) throw new Error("Original Client invoice snapshot has no positive all-in amount");
        const memo = await client.query(
          `INSERT INTO client_credit_memos
             (late_claim_id, hiring_contract_id, original_talent_invoice_id, client_id,
              currency, period_start, period_end, all_in_amount)
           VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8)
           RETURNING id`,
          [row.id, row.hiring_contract_id, row.original_talent_invoice_id, row.client_id,
            currency, row.period_start, row.period_end, allInAmount.toFixed(2)],
        );
        // If the original month has a statement still in draft, it is safe to
        // adjust that statement before send. Sent statements are never selected;
        // their memo balance is carried to a later generated statement.
        const draft = await client.query(
          `SELECT i.id, i.subtotal
             FROM client_monthly_invoices i
             JOIN client_credit_memos cm ON cm.id = $1
            WHERE i.client_id = $3 AND i.currency = $4 AND i.status = 'draft'
              AND (
                (i.invoice_month = date_trunc('month', $5::date)::date AND EXISTS (
                  SELECT 1 FROM client_monthly_invoice_lines l
                   WHERE l.client_monthly_invoice_id = i.id
                     AND l.talent_invoice_id = $2
                ))
                OR (
                  i.invoice_month > date_trunc('month', $5::date)::date
                  AND i.invoice_month >= date_trunc(
                    'month', cm.created_at AT TIME ZONE 'America/New_York'
                  )::date
                )
              )
            ORDER BY CASE WHEN i.invoice_month = date_trunc('month', $5::date)::date THEN 0 ELSE 1 END,
                     i.invoice_month, i.created_at
            LIMIT 1
            FOR UPDATE OF i`,
          [memo.rows[0].id, row.original_talent_invoice_id, row.client_id, currency, row.period_start],
        );
        if (draft.rows.length) {
          const available = roundMoney(Number(draft.rows[0].subtotal));
          const applied = roundMoney(Math.min(allInAmount, available));
          if (applied > 0) {
            await client.query(
              `INSERT INTO client_credit_applications
                 (client_credit_memo_id, client_monthly_invoice_id, amount)
               VALUES ($1,$2,$3)`,
              [memo.rows[0].id, draft.rows[0].id, applied.toFixed(2)],
            );
            await client.query(
              `UPDATE client_monthly_invoices SET subtotal = $2
                WHERE id = $1 AND status = 'draft'`,
              [draft.rows[0].id, roundMoney(available - applied).toFixed(2)],
            );
          }
        }
      }
      await client.query("COMMIT");
      return res.json({ claim: saved.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST Admin late Guaranteed claim decision failed", error);
      return res.status(500).json({ error: "Failed to adjudicate late Guaranteed claim" });
    } finally { client.release(); }
  });

  app.get("/api/admin/client-credit-memos", ...adminAuth, async (_req: any, res) => {
    try {
      const result = await query(
        `SELECT cm.id, cm.client_id, cm.hiring_contract_id, cm.original_talent_invoice_id,
                cm.currency, cm.period_start, cm.period_end, cm.all_in_amount, cm.created_at,
                c.status AS claim_status, c.reason,
                COALESCE(SUM(app.amount), 0) AS applied_amount,
                cm.all_in_amount - COALESCE(SUM(app.amount), 0) AS remaining_amount
           FROM client_credit_memos cm
           JOIN client_late_guaranteed_claims c ON c.id = cm.late_claim_id
           LEFT JOIN client_credit_applications app ON app.client_credit_memo_id = cm.id
          GROUP BY cm.id, c.status, c.reason
          ORDER BY cm.created_at DESC`,
      );
      const applications = await query(
        `SELECT app.client_credit_memo_id, app.client_monthly_invoice_id,
                app.amount, app.created_at, i.invoice_month, i.status
           FROM client_credit_applications app
           JOIN client_monthly_invoices i ON i.id = app.client_monthly_invoice_id
          ORDER BY app.created_at`,
      );
      return res.json({ creditMemos: result.rows, applications: applications.rows });
    } catch (error) {
      console.error("GET Admin Client credit ledger failed", error);
      return res.status(500).json({ error: "Failed to load Client credit ledger" });
    }
  });

  app.get("/api/client/guaranteed-contracts", ...clientAuth, async (req: any, res) => {
    try {
      const contracts = await query(
        `SELECT hc.id, hc.effective_start_date, hc.billing_activated_at,
                hc.effective_end_date, j.title AS job_title
           FROM hiring_contracts hc
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE js.client_id = $1 AND hc.status = 'signed'
            AND hc.billing_mode = 'guaranteed'
            AND hc.effective_start_date IS NOT NULL
          ORDER BY j.title, hc.id`,
        [req.user.id],
      );
      const today = dateInZone(new Date());
      const output = [];
      for (const contract of contracts.rows) {
        const effectiveStart = dateString(contract.effective_start_date);
        const activationDate = dateInZone(new Date(contract.billing_activated_at));
        const start = effectiveStart > activationDate ? effectiveStart : activationDate;
        const effectiveEndDate = contract.effective_end_date ? dateString(contract.effective_end_date) : null;
        const through = effectiveEndDate && effectiveEndDate < today ? effectiveEndDate : today;
        const periods = periodsThrough(start, through, effectiveEndDate);
        const eligiblePeriods = [];
        for (const period of periods) {
          const deadline = claimDeadlineForPeriod(period.end);
          if (new Date() >= deadline) continue;
          const existing = await query(
            `SELECT id, status FROM guaranteed_nonperformance_claims
              WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date`,
            [contract.id, period.start, period.end],
          );
          const invoice = await query(
            `SELECT id FROM talent_invoices
              WHERE hiring_contract_id = $1 AND period_start = $2::date AND period_end = $3::date`,
            [contract.id, period.start, period.end],
          );
          if (invoice.rows.length) continue;
          eligiblePeriods.push({
            periodStart: period.start,
            periodEnd: period.end,
            claimDeadline: deadline.toISOString(),
            status: existing.rows[0]?.status ?? "eligible",
            claimId: existing.rows[0]?.id ?? null,
          });
        }
        output.push({
          id: contract.id,
          jobTitle: contract.job_title,
          effectiveStartDate: effectiveStart,
          eligiblePeriods,
        });
      }
      return res.json({ contracts: output });
    } catch (error) {
      console.error("GET Client guaranteed contracts failed", error);
      return res.status(500).json({ error: "Failed to load Guaranteed contracts" });
    }
  });

  app.get("/api/client/guaranteed-claims", ...clientAuth, async (req: any, res) => {
    try {
      const result = await query(
        `SELECT gc.id, gc.hiring_contract_id, gc.period_start, gc.period_end,
                gc.reason, gc.status, gc.decision_reason, gc.created_at, gc.decided_at,
                j.title AS job_title
           FROM guaranteed_nonperformance_claims gc
           JOIN hiring_contracts hc ON hc.id = gc.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE gc.client_id = $1 AND js.client_id = $1
          ORDER BY gc.created_at DESC`,
        [req.user.id],
      );
      return res.json({ claims: result.rows });
    } catch (error) {
      console.error("GET Client guaranteed claims failed", error);
      return res.status(500).json({ error: "Failed to load Guaranteed claim history" });
    }
  });

  app.get("/api/admin/guaranteed-claims", ...adminAuth, async (_req: any, res) => {
    try {
      const result = await query(
        `SELECT gc.*, j.title AS job_title, js.talent_id
           FROM guaranteed_nonperformance_claims gc
           JOIN hiring_contracts hc ON hc.id = gc.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE gc.status = 'open' ORDER BY gc.created_at`,
      );
      return res.json({ claims: result.rows });
    } catch (error) {
      console.error("GET admin guaranteed claims failed", error);
      return res.status(500).json({ error: "Failed to load guaranteed claims" });
    }
  });

  app.get("/api/admin/talent-invoicing/blocked", ...adminAuth, async (_req: any, res) => {
    try {
      const contracts = await query(
        `SELECT hc.id AS hiring_contract_id, hc.billing_mode,
                hc.effective_start_date, hc.billing_activated_at,
                o.rate, o.rate_currency, o.engagement_type, js.talent_id, js.client_id
           FROM hiring_contracts hc
           JOIN offers o ON o.id = hc.offer_id
           JOIN job_submissions js ON js.id = hc.submission_id
          WHERE hc.status = 'signed'
            AND (hc.billing_mode IS NULL OR hc.billing_mode NOT IN ('tracked', 'guaranteed')
              OR hc.effective_start_date IS NULL OR hc.billing_activated_at IS NULL
              OR o.rate IS NULL OR o.rate_currency IS NULL
              OR LOWER(BTRIM(o.rate_currency)) <> 'usd'
              OR (hc.billing_mode = 'tracked' AND o.engagement_type NOT IN ('Standard', 'Lite')))
          ORDER BY hc.created_at`,
      );
      const payoutBlocks = await query(
        `SELECT ti.id AS invoice_id, ti.hiring_contract_id, ti.talent_id, ti.currency,
                o.rate_currency AS source_currency,
                ti.amount, d.status AS deposit_status, d.currency AS deposit_currency,
                d.amount AS deposit_amount,
                COALESCE((SELECT SUM(r.amount) FROM security_deposit_replenishments r
                  WHERE r.hiring_contract_id = ti.hiring_contract_id AND r.currency = ti.currency), 0) AS replenished_amount,
                COALESCE((SELECT SUM(p.amount) FROM payouts p
                  WHERE p.hiring_contract_id = ti.hiring_contract_id
                    AND p.currency = ti.currency
                    AND p.status IN ('pending', 'scheduled', 'disbursed', 'failed')), 0) AS reserved_payouts
           FROM talent_invoices ti
            LEFT JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
            LEFT JOIN offers o ON o.id = hc.offer_id
           LEFT JOIN security_deposits d ON d.hiring_contract_id = ti.hiring_contract_id
           WHERE ti.status = 'sent'
             AND NOT EXISTS (SELECT 1 FROM payouts p WHERE p.talent_invoice_id = ti.id)
          ORDER BY ti.sent_at`,
      );
      const blockedContracts = contracts.rows.map((row: any) => ({
        ...row,
        error: !row.billing_mode
          ? "Signed contract has no billing-mode snapshot"
          : !row.rate_currency
            ? "Signed offer has no invoice currency"
            : !isUsdCurrency(row.rate_currency)
              ? "New Talent invoices require a USD-priced signed offer; existing amounts cannot be converted or relabeled"
            : !row.effective_start_date || !row.billing_activated_at
              ? "Signed contract has no immutable effective start/activation snapshot"
              : !row.rate || Number(row.rate) <= 0
                ? "Signed offer has an invalid invoice rate"
                : "Signed offer has an unsupported engagement type",
      }));
      const blockedPayouts = payoutBlocks.rows.map((row: any) => ({
        ...row,
        error: !isUsdCurrency(row.currency) || !isUsdCurrency(row.source_currency)
          ? "Payout scheduling is blocked for an existing non-USD invoice"
          : row.deposit_status !== "held"
          ? "A held security deposit is required before payout scheduling"
          : !isUsdCurrency(row.deposit_currency)
            ? "A USD-held security deposit is required before new payouts can be scheduled"
            : Number(row.deposit_amount) + Number(row.replenished_amount) < Number(row.reserved_payouts) + Number(row.amount)
              ? "Held deposit does not cover this payout and existing reservations"
              : "Payout scheduling is pending; the automation worker will retry",
      }));
      return res.json({ blockedContracts, blockedPayouts });
    } catch (error) {
      console.error("GET admin Talent invoicing blockers failed", error);
      return res.status(500).json({ error: "Failed to load Talent invoicing blockers" });
    }
  });

  app.get("/api/admin/talent-invoices", ...adminAuth, async (_req: any, res) => {
    try {
      const result = await query(
        `SELECT ti.id, ti.hiring_contract_id, ti.talent_id, ti.client_id,
                j.title AS job_title, ti.billing_mode, ti.period_start, ti.period_end,
                ti.currency, ti.amount, ti.base_amount, ti.credit_amount, ti.status,
                ti.hours, ti.timesheet_revision_id, ti.payout_due_on,
                ti.drafted_at, ti.auto_send_at, ti.sent_at, ti.created_at,
                COALESCE(p.status, 'not_scheduled') AS payout_status,
                p.amount AS payout_amount
           FROM talent_invoices ti
           JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
           LEFT JOIN payouts p ON p.talent_invoice_id = ti.id
          ORDER BY ti.period_start DESC, ti.created_at DESC`,
      );
      const ids = result.rows.map((row: any) => row.id);
      const adjustments = ids.length
        ? await query(
          `SELECT invoice_id, credit_memo_id, memo_amount, applied_amount, created_at
             FROM (
               SELECT app.talent_invoice_id AS invoice_id, cm.id AS credit_memo_id,
                      cm.amount AS memo_amount, app.amount AS applied_amount, app.created_at
                 FROM talent_credit_memo_applications_v2 app
                 JOIN talent_credit_memos cm ON cm.id = app.credit_memo_id
               UNION ALL
               SELECT app.talent_invoice_id, cm.id, cm.amount, app.amount, app.created_at
                 FROM talent_credit_memo_applications app
                 JOIN talent_credit_memos cm ON cm.id = app.credit_memo_id
             ) application_rows
            WHERE invoice_id = ANY($1::uuid[])
            ORDER BY created_at, credit_memo_id`,
          [ids],
        )
        : { rows: [] };
      return res.json({
        invoices: result.rows.map((row: any) => ({
          ...row,
          payout_due_on: row.payout_due_on ? dateString(row.payout_due_on) : null,
        })),
        creditApplications: adjustments.rows,
      });
    } catch (error) {
      console.error("GET Admin Talent invoices failed", error);
      return res.status(500).json({ error: "Failed to load Talent invoices" });
    }
  });

  app.post("/api/admin/security-deposits/:id/replenishments", ...adminAuth, async (req: any, res) => {
    const amount = validMoney(req.body?.amount);
    let currency: typeof BILLING_CURRENCY;
    try {
      currency = requireUsdCurrency(req.body?.currency);
    } catch (error: any) {
      return res.status(error.status ?? 400).json({ error: error.message, code: error.code });
    }
    if (amount === null || amount <= 0) {
      return res.status(422).json({ error: "A positive amount and currency are required to record a held deposit replenishment" });
    }
    const client = await getClient();
    try {
      await client.query("BEGIN");
      const deposit = await client.query(
        `SELECT id, hiring_contract_id, currency, status
           FROM security_deposits WHERE id = $1 FOR UPDATE`,
        [req.params.id],
      );
      if (!deposit.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Security deposit not found" });
      }
      if (deposit.rows[0].status !== "held" || !isUsdCurrency(deposit.rows[0].currency)) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Replenishment currency must match a currently held security deposit" });
      }
      const saved = await client.query(
        `INSERT INTO security_deposit_replenishments
           (hiring_contract_id, amount, currency, recorded_by, reference)
         VALUES ($1,$2,$3,$4,$5) RETURNING id, amount, currency, reference, created_at`,
        [deposit.rows[0].hiring_contract_id, amount.toFixed(2), currency, req.user.id,
          typeof req.body?.reference === "string" ? req.body.reference.trim().slice(0, 500) || null : null],
      );
      await client.query("COMMIT");
      return res.status(201).json({ replenishment: saved.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      console.error("POST Admin security deposit replenishment failed", error);
      return res.status(500).json({ error: "Failed to record security deposit replenishment" });
    } finally {
      client.release();
    }
  });

  app.post("/api/admin/guaranteed-claims/:id/decision", ...adminAuth, async (req: any, res) => {
    const { decision, reason } = req.body ?? {};
    if (Object.hasOwn(req.body ?? {}, "deductionAmount") || Object.hasOwn(req.body ?? {}, "deduction_amount")) {
      return res.status(422).json({ error: "Guaranteed claim decisions are binary; partial deductions are not supported" });
    }
    if (!["approve", "reject"].includes(decision) || typeof reason !== "string" || !reason.trim()) {
      return res.status(422).json({ error: "decision (approve or reject) and reason are required" });
    }
    try {
      const saved = await query(
        `UPDATE guaranteed_nonperformance_claims
            SET status = $2, decision_reason = $3,
                decided_by = $4, decided_at = now()
          WHERE id = $1 AND status = 'open'
          RETURNING id, status, decision_reason, decided_at`,
        [req.params.id, decision === "approve" ? "approved" : "rejected", reason.trim(), req.user.id],
      );
      if (!saved.rows.length) return res.status(404).json({ error: "Open guaranteed claim not found" });
      return res.json({ claim: saved.rows[0] });
    } catch (error) {
      console.error("POST admin guaranteed claim decision failed", error);
      return res.status(500).json({ error: "Failed to decide guaranteed claim" });
    }
  });

  app.get("/api/client/monthly-invoices", ...clientAuth, async (req: any, res) => {
    try {
      const result = await query(
        `SELECT i.id, i.invoice_month, i.currency, i.subtotal, i.status, i.created_at,
                COALESCE((SELECT SUM(a.amount) FROM client_credit_applications a
                  WHERE a.client_monthly_invoice_id = i.id), 0) AS applied_credits
           FROM client_monthly_invoices i WHERE i.client_id = $1
          ORDER BY invoice_month DESC, created_at DESC`,
        [req.user.id],
      );
      return res.json({ invoices: result.rows });
    } catch (error) {
      console.error("GET Client monthly invoices failed", error);
      return res.status(500).json({ error: "Failed to load monthly invoices" });
    }
  });

  app.get("/api/client/monthly-invoices/:id", ...clientAuth, async (req: any, res) => {
    try {
      const result = await query(
        `SELECT i.id, i.invoice_month, i.currency, i.subtotal, i.status, i.created_at,
                COALESCE((SELECT SUM(a.amount) FROM client_credit_applications a
                  WHERE a.client_monthly_invoice_id = i.id), 0) AS applied_credits
           FROM client_monthly_invoices i WHERE i.id = $1 AND i.client_id = $2`,
        [req.params.id, req.user.id],
      );
      if (!result.rows.length) return res.status(404).json({ error: "Monthly invoice not found" });
      const lines = await query(
        `SELECT ti.period_start, ti.period_end, j.title AS job_title, l.client_amount
           FROM client_monthly_invoice_lines l
           JOIN talent_invoices ti ON ti.id = l.talent_invoice_id
           JOIN hiring_contracts hc ON hc.id = ti.hiring_contract_id
           JOIN job_submissions js ON js.id = hc.submission_id
           JOIN jobs j ON j.id = js.job_id
          WHERE l.client_monthly_invoice_id = $1 ORDER BY ti.period_start`,
        [req.params.id],
      );
      const credits = await query(
        `SELECT app.amount, cm.id AS client_credit_memo_id,
                cm.period_start, cm.period_end, app.created_at
           FROM client_credit_applications app
           JOIN client_credit_memos cm ON cm.id = app.client_credit_memo_id
          WHERE app.client_monthly_invoice_id = $1
          ORDER BY app.created_at`,
        [req.params.id],
      );
      return res.json({ invoice: result.rows[0], lines: lines.rows, appliedCredits: credits.rows });
    } catch (error) {
      console.error("GET Client monthly invoice failed", error);
      return res.status(500).json({ error: "Failed to load monthly invoice" });
    }
  });

  // Catch-up is idempotent and safe across restarts; auto-send only transitions
  // the Talent-side draft, and never waits on an open Tracked timesheet dispute.
  const tick = () => runTalentInvoiceAutomation().catch((error) => console.error("Talent invoice automation failed", error));
  if (options.startAutomation !== false) {
    void tick();
    const timer = setInterval(tick, 15 * 60 * 1000);
    timer.unref?.();
  }
}