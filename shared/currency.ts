/** New pricing and billing use USD worldwide. Historical denominations are immutable. */
export const BILLING_CURRENCY = "USD" as const;

export function isUsdCurrency(value: unknown): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === BILLING_CURRENCY;
}

export function requireUsdCurrency(value: unknown = BILLING_CURRENCY): typeof BILLING_CURRENCY {
  if (!isUsdCurrency(value)) {
    throw Object.assign(
      new Error("New pricing and billing records must use USD; existing amounts cannot be converted or relabeled."),
      { code: "USD_ONLY", status: 400 },
    );
  }
  return BILLING_CURRENCY;
}