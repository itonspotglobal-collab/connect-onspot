import { BILLING_CURRENCY } from "../../shared/currency";

const METRICS = ["gtv", "outstanding_invoices", "pending_payouts"] as const;
type Metric = typeof METRICS[number];

export interface LedgerCurrencyTotal {
  currency: string;
  amount: string;
}

export interface LedgerSummaryRow {
  metric: Metric;
  currency: string | null;
  amount: string;
  deposits_at_risk: number;
}

/** PostgreSQL sums within a denomination only; no exchange rates or mixed totals. */
export function ledgerCurrencySummarySql(filter: "" | "WHERE ip.status = $1"): string {
  return `
    WITH ledger_base AS (
      SELECT ip.client_invoice_amount, ip.talent_rate_currency,
             inv.status AS invoice_status, inv.amount AS invoice_amount,
             inv.currency AS invoice_currency,
             p.status AS payout_status, p.amount AS payout_amount, p.currency AS payout_currency
        FROM invoice_periods ip
        LEFT JOIN LATERAL (
          SELECT status, amount, currency FROM invoices
           WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1
        ) inv ON true
        LEFT JOIN LATERAL (
          SELECT status, amount, currency FROM payouts
           WHERE period_id = ip.id ORDER BY created_at DESC LIMIT 1
        ) p ON true
        ${filter}
    ), metric_amounts AS (
      SELECT 'gtv' AS metric, client_invoice_amount AS amount, talent_rate_currency AS currency
        FROM ledger_base
      UNION ALL
      SELECT 'outstanding_invoices',
             CASE WHEN invoice_status IS NULL OR invoice_status IN ('draft','sent','overdue')
                  THEN COALESCE(invoice_amount, client_invoice_amount) ELSE 0 END,
             CASE WHEN invoice_amount IS NULL THEN talent_rate_currency ELSE invoice_currency END
        FROM ledger_base
      UNION ALL
      SELECT 'pending_payouts', payout_amount, payout_currency
        FROM ledger_base WHERE payout_status IN ('pending','scheduled')
    )
    SELECT metric, COALESCE(NULLIF(UPPER(TRIM(currency)), ''), 'UNKNOWN') AS currency,
           SUM(COALESCE(amount, 0))::text AS amount,
           (SELECT COUNT(DISTINCT sd.id)::int FROM security_deposits sd
             WHERE sd.status IN ('drawn','suspended') AND sd.hiring_contract_id IN (
               SELECT ip.hiring_contract_id FROM invoice_periods ip ${filter}
             )) AS deposits_at_risk
      FROM metric_amounts
     GROUP BY metric, COALESCE(NULLIF(UPPER(TRIM(currency)), ''), 'UNKNOWN')
     ORDER BY metric, currency`;
}

/** Legacy rows remain readable, but never acquire a misleading USD total. */
export function buildLedgerCurrencySummary(rows: LedgerSummaryRow[]) {
  const currencyTotals: Record<Metric, LedgerCurrencyTotal[]> = {
    gtv: [], outstanding_invoices: [], pending_payouts: [],
  };
  for (const row of rows) {
    if (!METRICS.includes(row.metric)) throw new Error("Unexpected ledger summary metric");
    currencyTotals[row.metric].push({
      currency: row.currency?.trim().toUpperCase() || "UNKNOWN",
      amount: row.amount,
    });
  }
  const currencies = new Set(rows.map(row => row.currency?.trim().toUpperCase() || "UNKNOWN"));
  const currencyWarnings: string[] = [];
  if (currencies.size > 1) {
    currencyWarnings.push(`Mixed currencies (${Array.from(currencies).sort().join(", ")}): amounts are kept separate; no conversion or combined total was performed.`);
  }
  for (const metric of METRICS) {
    const groups = currencyTotals[metric];
    if (groups.some(group => group.currency !== BILLING_CURRENCY)) {
      currencyWarnings.push(`${metric} contains historical non-USD or unknown currency. Review its denomination-specific amounts before using a total.`);
    }
  }
  const usdTotal = (metric: Metric): string | null => {
    const groups = currencyTotals[metric];
    if (groups.some(group => group.currency !== BILLING_CURRENCY)) return null;
    return groups[0]?.amount ?? "0";
  };
  return {
    currency: BILLING_CURRENCY,
    gtv: usdTotal("gtv"),
    outstanding_invoices: usdTotal("outstanding_invoices"),
    pending_payouts: usdTotal("pending_payouts"),
    deposits_at_risk: Number(rows[0]?.deposits_at_risk ?? 0),
    currencyTotals,
    mixedCurrencies: currencies.size > 1,
    currencyWarnings,
  };
}