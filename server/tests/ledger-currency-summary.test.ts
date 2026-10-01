import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BILLING_CURRENCY, isUsdCurrency, requireUsdCurrency } from "../../shared/currency";
import { buildLedgerCurrencySummary, ledgerCurrencySummarySql, type LedgerSummaryRow } from "../services/ledgerCurrencySummary";

describe("USD-only new currency policy", () => {
  it("defaults to USD worldwide without region or exchange-rate parameters", () => {
    assert.equal(BILLING_CURRENCY, "USD");
    assert.equal(requireUsdCurrency(), "USD");
    assert.equal(requireUsdCurrency(" usd "), "USD");
  });
  it("rejects PHP and other currencies rather than converting or relabeling", () => {
    for (const currency of ["PHP", "EUR", "GBP", "OTHER", "", null, 10]) {
      assert.equal(isUsdCurrency(currency), false);
      assert.throws(() => requireUsdCurrency(currency), (err: any) => err.code === "USD_ONLY" && err.status === 400);
    }
  });
});

describe("ledger denomination-safe summaries", () => {
  it("empty ledgers explicitly return USD zero amounts", () => {
    const summary = buildLedgerCurrencySummary([]);
    assert.equal(summary.currency, "USD");
    assert.equal(summary.gtv, "0");
    assert.equal(summary.outstanding_invoices, "0");
    assert.equal(summary.pending_payouts, "0");
    assert.equal(summary.mixedCurrencies, false);
    assert.deepEqual(summary.currencyWarnings, []);
  });
  it("USD totals retain the exact PostgreSQL decimal strings", () => {
    const summary = buildLedgerCurrencySummary([
      { metric: "gtv", currency: "USD", amount: "1234.56", deposits_at_risk: 2 },
      { metric: "outstanding_invoices", currency: "USD", amount: "234.56", deposits_at_risk: 2 },
      { metric: "pending_payouts", currency: "USD", amount: "100.01", deposits_at_risk: 2 },
    ]);
    assert.equal(summary.gtv, "1234.56");
    assert.equal(summary.pending_payouts, "100.01");
    assert.equal(summary.deposits_at_risk, 2);
  });
  it("mixed currencies produce denomination-specific amounts, a flag and no misleading total", () => {
    const rows: LedgerSummaryRow[] = [
      { metric: "gtv", currency: "USD", amount: "100", deposits_at_risk: 0 },
      { metric: "gtv", currency: "PHP", amount: "30000", deposits_at_risk: 0 },
      { metric: "outstanding_invoices", currency: "USD", amount: "100", deposits_at_risk: 0 },
      { metric: "pending_payouts", currency: "PHP", amount: "20000", deposits_at_risk: 0 },
    ];
    const before = structuredClone(rows);
    const summary = buildLedgerCurrencySummary(rows);
    assert.equal(summary.gtv, null);
    assert.equal(summary.outstanding_invoices, "100");
    assert.equal(summary.pending_payouts, null);
    assert.equal(summary.mixedCurrencies, true);
    assert.match(summary.currencyWarnings.join(" "), /Mixed currencies/);
    assert.deepEqual(summary.currencyTotals.gtv, [
      { currency: "USD", amount: "100" }, { currency: "PHP", amount: "30000" },
    ]);
    assert.deepEqual(rows, before, "historical amounts/currencies must not be changed");
  });
  it("PHP-only and unknown denominations never silently become USD", () => {
    for (const currency of ["PHP", null, ""]) {
      const summary = buildLedgerCurrencySummary([
        { metric: "gtv", currency, amount: "30000", deposits_at_risk: 0 },
      ]);
      assert.equal(summary.gtv, null);
      assert.ok(summary.currencyWarnings.length);
    }
  });
  it("SQL groups each metric by currency and carries invoice/payout currencies independently", () => {
    const sql = ledgerCurrencySummarySql("WHERE ip.status = $1");
    assert.match(sql, /GROUP BY metric,/);
    assert.match(sql, /inv\.currency AS invoice_currency/);
    assert.match(sql, /p\.currency AS payout_currency/);
    assert.match(sql, /THEN talent_rate_currency ELSE invoice_currency END/);
    assert.match(sql, /payout_amount, payout_currency/);
    assert.match(sql, /WHERE ip\.status = \$1/);
  });
});