import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BILLING_CURRENCY, requireUsdCurrency } from "../../shared/currency.ts";
import { billingCurrencyForSource } from "../routes/talentInvoices.ts";

describe("USD-only Talent invoice billing", () => {
  it("defaults new billing currency to USD and accepts USD source currency case-insensitively", () => {
    assert.equal(requireUsdCurrency(), "USD");
    assert.equal(billingCurrencyForSource(" usd "), BILLING_CURRENCY);
  });

  it("blocks a legacy non-USD source instead of relabeling its amount", () => {
    assert.throws(
      () => billingCurrencyForSource("PHP"),
      (error: any) => error.code === "USD_ONLY"
        && error.status === 400
        && error.message === "New pricing and billing records must use USD; existing amounts cannot be converted or relabeled.",
    );
  });
});